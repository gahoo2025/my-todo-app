import { useState, useMemo } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useMarketLogs } from '../hooks/useMarketLogs'
import { parseMarketLog, analyzeBlocks } from '../lib/marketLogParser'
import Markdown from './Markdown'

function pad(n) { return String(n).padStart(2, '0') }

function toDatetimeLocalValue(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function fromDatetimeLocalValue(str) {
  const d = str ? new Date(str) : new Date()
  return d.toISOString()
}

function formatEntryAt(iso) {
  const d = new Date(iso)
  const wd = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()]
  return `${d.getMonth() + 1}/${d.getDate()}(${wd}) ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function firstLines(text, n = 2) {
  if (!text) return ''
  return text.split('\n').filter(Boolean).slice(0, n).join(' ')
}

function StockChip({ stock }) {
  const isOutlook = stock.block === 'outlook'
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${
      isOutlook ? 'text-[#007AFF] bg-[#007AFF]/10' : 'text-[#636366] bg-black/[0.05]'
    }`}>
      {stock.name}
      <span className="opacity-70">({stock.code})</span>
      {stock.score && <span className="opacity-70">{stock.score}点</span>}
    </span>
  )
}

// ── 新規登録・編集エディタ ──
function EntryEditor({ initial, onSave, onClose }) {
  const [entryAtLocal, setEntryAtLocal] = useState(
    initial?.entry_at ? toDatetimeLocalValue(new Date(initial.entry_at)) : toDatetimeLocalValue(new Date())
  )
  const [actual, setActual] = useState(initial?.actual ?? '')
  const [outlook, setOutlook] = useState(initial?.outlook ?? '')
  const [bulkMode, setBulkMode] = useState(false)
  const [bulkText, setBulkText] = useState(initial?.raw_text ?? '')
  const [bulkNotice, setBulkNotice] = useState(null)
  const [savedRawText, setSavedRawText] = useState(initial?.raw_text ?? null)
  const [saving, setSaving] = useState(false)

  function handleAutoSplit() {
    if (!bulkText.trim()) return
    const parsed = parseMarketLog(bulkText)
    setActual(parsed.actual || bulkText.trim())
    setOutlook(parsed.outlook || '')
    setSavedRawText(bulkText)
    setBulkNotice(
      parsed.method === 'heuristic'
        ? '見出し（【実績】【見通し】等）が見つからなかったため、文の内容から自動判定しました。振り分け結果を確認してください。'
        : null
    )
    setBulkMode(false)
  }

  async function handleSave() {
    if (!actual.trim() && !outlook.trim()) return
    setSaving(true)
    try {
      const { stocks, todos } = analyzeBlocks(actual, outlook)
      const parsed = { actual: actual.trim() || null, outlook: outlook.trim() || null, stocks, todos }
      await onSave(parsed, fromDatetimeLocalValue(entryAtLocal), savedRawText)
      onClose()
    } catch (err) {
      alert('保存に失敗しました: ' + (err?.message ?? '不明なエラー'))
    } finally {
      setSaving(false)
    }
  }

  const isNew = !initial

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-[2px] flex items-end md:items-center md:justify-center z-40" onClick={onClose}>
      <div
        className="w-full bg-[#F2F2F7] rounded-t-[16px] md:rounded-[16px] max-w-lg md:max-w-xl mx-auto shadow-2xl max-h-[92vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-[#F2F2F7]/90 backdrop-blur-xl px-4 py-3 flex items-center justify-between border-b border-black/5 rounded-t-[16px]">
          <button onClick={onClose} className="ios-toolbar-btn">キャンセル</button>
          <h2 className="text-[16px] font-semibold text-[#1C1C1E]">{isNew ? '記録を追加' : '記録を編集'}</h2>
          <button
            onClick={handleSave}
            disabled={saving || (!actual.trim() && !outlook.trim())}
            className="ios-toolbar-btn font-semibold disabled:opacity-30"
          >
            {saving ? '保存中…' : '保存'}
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* 日時 */}
          <div className="ios-card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-[15px] text-[#1C1C1E]">日時</span>
              <input
                type="datetime-local"
                value={entryAtLocal}
                onChange={e => setEntryAtLocal(e.target.value)}
                className="text-[15px] text-[#8E8E93] bg-transparent focus:outline-none text-right"
              />
            </div>
          </div>

          {bulkMode ? (
            <div className="ios-card px-4 py-3 space-y-3">
              <p className="text-[13px] font-semibold text-[#8E8E93]">まとめて貼り付け</p>
              <textarea
                autoFocus
                value={bulkText}
                onChange={e => setBulkText(e.target.value)}
                placeholder={'【実績】\n（既に起きたこと）\n\n【見通し】\n（これから起きそうなこと）'}
                rows={12}
                className="w-full px-3 py-2.5 rounded-[10px] bg-black/[0.03] text-[14px] text-[#1C1C1E] placeholder:text-[#AEAEB2] focus:outline-none resize-none leading-relaxed"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setBulkMode(false)}
                  className="flex-1 py-2.5 rounded-[10px] bg-black/[0.05] text-[#1C1C1E] text-[13px] font-medium active:opacity-70 transition-opacity"
                >
                  戻る
                </button>
                <button
                  onClick={handleAutoSplit}
                  disabled={!bulkText.trim()}
                  className="flex-[2] py-2.5 rounded-[10px] bg-[#007AFF] text-white text-[14px] font-semibold disabled:opacity-30 active:opacity-70 transition-opacity"
                >
                  自動振り分け
                </button>
              </div>
            </div>
          ) : (
            <>
              <button
                onClick={() => { setBulkText(''); setBulkMode(true) }}
                className="w-full py-2 rounded-[10px] bg-white text-[#007AFF] text-[13px] font-medium shadow-[0_1px_2px_rgba(0,0,0,0.06)] active:opacity-70 transition-opacity"
              >
                📋 まとめて貼り付けて自動振り分け
              </button>

              {bulkNotice && (
                <div className="rounded-[12px] bg-[#FF9500]/10 px-4 py-3">
                  <p className="text-[12px] text-[#FF9500]">⚠ {bulkNotice}</p>
                </div>
              )}

              {/* 実績 */}
              <div className="ios-card overflow-hidden">
                <div className="px-4 pt-2.5 pb-1">
                  <span className="text-[12px] font-semibold text-[#636366]">【実績】既に起きたこと</span>
                </div>
                <textarea
                  value={actual}
                  onChange={e => setActual(e.target.value)}
                  placeholder="株価・指数の結果、決算、ニュースなど"
                  rows={5}
                  className="w-full px-4 py-2 text-[14px] text-[#1C1C1E] placeholder:text-[#AEAEB2] bg-transparent focus:outline-none resize-none leading-relaxed"
                />
              </div>

              {/* 見通し */}
              <div className="ios-card overflow-hidden border-l-[3px] border-[#007AFF]">
                <div className="px-4 pt-2.5 pb-1">
                  <span className="text-[12px] font-semibold text-[#007AFF]">【見通し】これから起きそうなこと</span>
                </div>
                <textarea
                  value={outlook}
                  onChange={e => setOutlook(e.target.value)}
                  placeholder="今後の相場観、注目イベント、想定シナリオなど"
                  rows={5}
                  className="w-full px-4 py-2 text-[14px] text-[#1C1C1E] placeholder:text-[#AEAEB2] bg-transparent focus:outline-none resize-none leading-relaxed"
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── 一覧カード ──
function EntryCard({ entry, onOpen }) {
  return (
    <div
      onClick={() => onOpen(entry)}
      className="ios-card px-4 py-4 cursor-pointer active:scale-[0.99] transition-transform"
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0 space-y-1.5">
          <p className="text-[12px] text-[#AEAEB2]">{formatEntryAt(entry.entry_at)}</p>
          {entry.actual && (
            <p className="text-[13px] text-[#3C3C43] leading-snug line-clamp-2">
              <span className="text-[11px] font-semibold text-[#8E8E93] mr-1">実績</span>
              {firstLines(entry.actual)}
            </p>
          )}
          {entry.outlook && (
            <p className="text-[13px] text-[#3C3C43] leading-snug line-clamp-2">
              <span className="text-[11px] font-semibold text-[#007AFF] mr-1">見通し</span>
              {firstLines(entry.outlook)}
            </p>
          )}
          {entry.stocks.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {entry.stocks.slice(0, 4).map((s, i) => <StockChip key={i} stock={s} />)}
              {entry.stocks.length > 4 && (
                <span className="text-[11px] text-[#AEAEB2]">+{entry.stocks.length - 4}</span>
              )}
            </div>
          )}
        </div>
        <svg className="w-4 h-4 text-[#C7C7CC] flex-shrink-0 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </div>
  )
}

// ── 詳細モーダル ──
function DetailModal({ entry, onClose, onToggleTodo, onDelete, onEdit }) {
  async function handleDelete() {
    if (!window.confirm('この記録を削除しますか？')) return
    await onDelete(entry.id)
    onClose()
  }

  const actualStocks = entry.stocks.filter(s => s.block === 'actual')
  const outlookStocks = entry.stocks.filter(s => s.block === 'outlook')

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-[2px] flex items-end md:items-center md:justify-center z-40" onClick={onClose}>
      <div
        className="w-full bg-[#F2F2F7] rounded-t-[16px] md:rounded-[16px] max-w-lg md:max-w-xl mx-auto shadow-2xl max-h-[92vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-[#F2F2F7]/90 backdrop-blur-xl px-4 py-3 flex items-center justify-between border-b border-black/5 rounded-t-[16px]">
          <button onClick={onClose} className="ios-toolbar-btn">閉じる</button>
          <h2 className="text-[15px] font-semibold text-[#1C1C1E]">{formatEntryAt(entry.entry_at)}</h2>
          <button onClick={() => onEdit(entry)} className="ios-toolbar-btn font-semibold">編集</button>
        </div>

        <div className="p-4 space-y-4">
          {entry.actual && (
            <div className="ios-card px-4 py-3">
              <p className="text-[12px] font-semibold text-[#636366] mb-2">【実績】</p>
              <Markdown>{entry.actual}</Markdown>
            </div>
          )}
          {entry.outlook && (
            <div className="ios-card px-4 py-3 border-l-[3px] border-[#007AFF]">
              <p className="text-[12px] font-semibold text-[#007AFF] mb-2">【見通し】</p>
              <Markdown>{entry.outlook}</Markdown>
            </div>
          )}

          {(actualStocks.length > 0 || outlookStocks.length > 0) && (
            <div className="ios-card px-4 py-3">
              <p className="text-[13px] font-semibold text-[#8E8E93] mb-2">言及された銘柄</p>
              {actualStocks.length > 0 && (
                <div className="mb-2">
                  <p className="text-[11px] text-[#8E8E93] mb-1">実績で言及</p>
                  <div className="flex flex-wrap gap-1.5">
                    {actualStocks.map(s => <StockChip key={s.id} stock={s} />)}
                  </div>
                </div>
              )}
              {outlookStocks.length > 0 && (
                <div>
                  <p className="text-[11px] text-[#8E8E93] mb-1">見通しで言及</p>
                  <div className="flex flex-wrap gap-1.5">
                    {outlookStocks.map(s => <StockChip key={s.id} stock={s} />)}
                  </div>
                </div>
              )}
            </div>
          )}

          {entry.todos.length > 0 && (
            <div className="ios-card px-4 py-3">
              <p className="text-[13px] font-semibold text-[#8E8E93] mb-2">TODO</p>
              <div className="space-y-2">
                {entry.todos.map(t => (
                  <button
                    key={t.id}
                    onClick={() => onToggleTodo(t.id, t.done)}
                    className="flex items-center gap-2.5 w-full text-left"
                  >
                    <span className={`w-[18px] h-[18px] rounded-[5px] border-[1.5px] flex-shrink-0 flex items-center justify-center transition-colors ${
                      t.done ? 'bg-[#34C759] border-[#34C759]' : 'border-[#C7C7CC]'
                    }`}>
                      {t.done && <span className="text-white text-[11px]">✓</span>}
                    </span>
                    <span className={`text-[14px] ${t.done ? 'line-through text-[#AEAEB2]' : 'text-[#1C1C1E]'}`}>
                      {t.content}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={handleDelete}
            className="w-full py-3 rounded-[12px] text-[#FF3B30] text-[15px] font-medium bg-[#FF3B30]/[0.08] active:opacity-70 transition-opacity"
          >
            記録を削除
          </button>
        </div>
      </div>
    </div>
  )
}

// ── 銘柄横断ビュー ──
function CrossView({ entries, onBack }) {
  const [selectedCode, setSelectedCode] = useState(null)

  const byCode = {}
  for (const entry of entries) {
    for (const s of entry.stocks) {
      if (!byCode[s.code]) byCode[s.code] = { code: s.code, name: s.name, actual: [], outlook: [] }
      byCode[s.code].name = s.name
      const bucket = s.block === 'outlook' ? byCode[s.code].outlook : byCode[s.code].actual
      bucket.push({ entry_at: entry.entry_at, score: s.score, entryId: entry.id })
    }
  }
  const codes = Object.values(byCode).sort((a, b) =>
    (b.actual.length + b.outlook.length) - (a.actual.length + a.outlook.length)
  )
  const selected = selectedCode ? byCode[selectedCode] : null

  if (selected) {
    return (
      <div className="ios-card px-4 py-4">
        <button onClick={() => setSelectedCode(null)} className="text-[13px] text-[#007AFF] mb-3 active:opacity-50">
          ← 銘柄一覧に戻る
        </button>
        <p className="text-[17px] font-semibold text-[#1C1C1E]">{selected.name}</p>
        <p className="text-[12px] text-[#8E8E93] mb-3">{selected.code}</p>

        {selected.actual.length > 0 && (
          <div className="mb-3">
            <p className="text-[12px] font-semibold text-[#636366] mb-1.5">実績タイムライン</p>
            <div className="divide-y divide-black/[0.04]">
              {selected.actual.map((h, i) => (
                <div key={i} className="flex items-center justify-between py-2">
                  <span className="text-[13px] text-[#1C1C1E]">{formatEntryAt(h.entry_at)}</span>
                  {h.score && <span className="text-[12px] text-[#8E8E93]">{h.score}点</span>}
                </div>
              ))}
            </div>
          </div>
        )}
        {selected.outlook.length > 0 && (
          <div>
            <p className="text-[12px] font-semibold text-[#007AFF] mb-1.5">見通しタイムライン</p>
            <div className="divide-y divide-black/[0.04]">
              {selected.outlook.map((h, i) => (
                <div key={i} className="flex items-center justify-between py-2">
                  <span className="text-[13px] text-[#1C1C1E]">{formatEntryAt(h.entry_at)}</span>
                  {h.score && <span className="text-[12px] text-[#8E8E93]">{h.score}点</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="ios-card px-4 py-4">
      <button onClick={onBack} className="text-[13px] text-[#007AFF] mb-3 active:opacity-50">
        ← 記録一覧に戻る
      </button>
      {codes.length === 0 ? (
        <p className="text-[13px] text-[#AEAEB2] py-6 text-center">まだ銘柄の言及がありません</p>
      ) : (
        <div className="divide-y divide-black/[0.04]">
          {codes.map(c => (
            <button
              key={c.code}
              onClick={() => setSelectedCode(c.code)}
              className="w-full flex items-center justify-between py-2.5 text-left active:opacity-60"
            >
              <div className="min-w-0">
                <p className="text-[14px] font-medium text-[#1C1C1E] truncate">{c.name}</p>
                <p className="text-[12px] text-[#8E8E93]">{c.code}</p>
              </div>
              <span className="text-[11px] text-[#8E8E93] flex-shrink-0">
                実績{c.actual.length}・見通し{c.outlook.length}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── メイン ──
export default function MarketLogSection() {
  const { user } = useAuth()
  const { entries, loading, addEntry, replaceEntry, toggleTodo, deleteEntry } = useMarketLogs(user?.id)
  const [editing, setEditing] = useState(null) // null | { mode: 'new' } | { mode: 'edit', entry }
  const [viewing, setViewing] = useState(null)
  const [showCrossView, setShowCrossView] = useState(false)
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return entries
    return entries.filter(e => {
      const haystack = [
        e.actual, e.outlook,
        ...e.stocks.map(s => `${s.name} ${s.code}`),
      ].filter(Boolean).join(' ').toLowerCase()
      return haystack.includes(q)
    })
  }, [entries, query])

  async function handleSaveNew(parsed, entryAt, rawText) {
    await addEntry(parsed, entryAt, rawText)
  }

  async function handleSaveEdit(parsed, entryAt, rawText) {
    const updated = await replaceEntry(editing.entry.id, parsed, entryAt, rawText)
    if (updated) setViewing(updated)
  }

  return (
    <>
      {showCrossView ? (
        <CrossView entries={entries} onBack={() => setShowCrossView(false)} />
      ) : (
        <>
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="キーワード・銘柄コードで検索"
              className="flex-1 px-3 py-2.5 rounded-[10px] bg-white text-[14px] text-[#1C1C1E] placeholder:text-[#AEAEB2] shadow-[0_1px_2px_rgba(0,0,0,0.06)] focus:outline-none"
            />
            <button
              onClick={() => setShowCrossView(true)}
              className="flex-shrink-0 px-3 py-2.5 rounded-[10px] bg-white text-[#1C1C1E] text-[13px] font-medium shadow-[0_1px_2px_rgba(0,0,0,0.06)] active:opacity-70 transition-opacity"
            >
              🔍 銘柄別
            </button>
          </div>

          {loading ? (
            <div className="text-center py-20 text-[#AEAEB2] text-[13px]">読み込み中…</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-24">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#767680]/10 flex items-center justify-center">
                <svg className="w-7 h-7 text-[#AEAEB2]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14" />
                </svg>
              </div>
              <p className="text-[15px] font-medium text-[#8E8E93]">
                {query ? '該当する記録がありません' : '記録がありません'}
              </p>
              {!query && (
                <p className="text-[13px] text-[#AEAEB2] mt-1">＋ボタンから実績・見通しを記録できます</p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map(e => (
                <EntryCard key={e.id} entry={e} onOpen={setViewing} />
              ))}
            </div>
          )}
        </>
      )}

      {/* 新規追加ボタン（PC） */}
      <button
        onClick={() => setEditing({ mode: 'new' })}
        className="hidden md:block w-full mt-4 py-2.5 rounded-[12px] bg-[#007AFF] text-white font-semibold text-[14px] active:opacity-70 transition-opacity shadow-[0_2px_8px_rgba(0,122,255,0.3)]"
      >
        ＋ 新規登録
      </button>

      {/* モバイル FAB */}
      <button
        onClick={() => setEditing({ mode: 'new' })}
        className="md:hidden fixed bottom-20 right-5 w-[54px] h-[54px] bg-[#007AFF] text-white rounded-full shadow-[0_4px_16px_rgba(0,122,255,0.4)] flex items-center justify-center active:scale-90 transition-transform z-30"
        aria-label="記録を追加"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
          <path strokeLinecap="round" d="M12 5v14m-7-7h14" />
        </svg>
      </button>

      {viewing && (
        <DetailModal
          entry={viewing}
          onClose={() => setViewing(null)}
          onToggleTodo={toggleTodo}
          onDelete={deleteEntry}
          onEdit={entry => { setViewing(null); setEditing({ mode: 'edit', entry }) }}
        />
      )}

      {editing?.mode === 'new' && (
        <EntryEditor onSave={handleSaveNew} onClose={() => setEditing(null)} />
      )}
      {editing?.mode === 'edit' && (
        <EntryEditor
          initial={editing.entry}
          onSave={handleSaveEdit}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  )
}
