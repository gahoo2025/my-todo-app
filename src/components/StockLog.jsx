import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useStockLogs } from '../hooks/useStockLogs'
import { parseStockLog } from '../lib/stockLogParser'
import Markdown from './Markdown'

const STATUS_STYLE = {
  '実行中': { text: 'text-[#007AFF]', bg: 'bg-[#007AFF]/10' },
  '保留':   { text: 'text-[#FF9500]', bg: 'bg-[#FF9500]/10' },
  '除外':   { text: 'text-[#8E8E93]', bg: 'bg-[#8E8E93]/10' },
}
const DEFAULT_STATUS_STYLE = { text: 'text-[#AF52DE]', bg: 'bg-[#AF52DE]/10' }

const SAMPLE_PLACEHOLDER = `## 週次サマリー 2026-07-14〜07-18

### 相場動向
（Claude.aiで生成した相場動向のテキストをここに貼り付け）

### スクリーニング結果
- 銘柄名(コード) 82点 → 実行中
- 銘柄名(コード) → 保留

### TODO
- [ ] 7/20 決算を確認する`

function formatWeekTitle(entry) {
  return entry.week_label || entry.record_date
}

function StockBadge({ status }) {
  const style = STATUS_STYLE[status] ?? DEFAULT_STATUS_STYLE
  return (
    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${style.text} ${style.bg}`}>
      {status}
    </span>
  )
}

// ── 貼り付け→解析→保存 モーダル（新規登録・編集共通） ──
function StockLogEditor({ initialRawText = '', onSave, onClose }) {
  const [rawText, setRawText] = useState(initialRawText)
  const [parsed, setParsed] = useState(null)
  const [saving, setSaving] = useState(false)

  function handleParse() {
    if (!rawText.trim()) return
    setParsed(parseStockLog(rawText))
  }

  async function handleSave() {
    if (!parsed) return
    setSaving(true)
    try {
      await onSave(parsed, rawText)
      onClose()
    } catch (err) {
      alert('保存に失敗しました: ' + (err?.message ?? '不明なエラー'))
    } finally {
      setSaving(false)
    }
  }

  const step = parsed ? 2 : 1

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-[2px] flex items-end md:items-center md:justify-center z-40" onClick={onClose}>
      <div
        className="w-full bg-[#F2F2F7] rounded-t-[16px] md:rounded-[16px] max-w-lg md:max-w-xl mx-auto shadow-2xl max-h-[92vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-[#F2F2F7]/90 backdrop-blur-xl px-4 py-3 flex items-center justify-between border-b border-black/5 rounded-t-[16px]">
          <button onClick={onClose} className="ios-toolbar-btn">キャンセル</button>
          <h2 className="text-[16px] font-semibold text-[#1C1C1E]">記録を貼り付け</h2>
          <span className="w-[46px]" />
        </div>

        {/* ステップインジケーター */}
        <div className="flex items-center gap-2 px-4 pt-3">
          {['貼り付け', '確認・保存'].map((label, i) => (
            <div key={label} className="flex items-center gap-2 flex-1">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 ${
                step === i + 1 ? 'bg-[#007AFF] text-white' : step > i + 1 ? 'bg-[#34C759] text-white' : 'bg-black/[0.08] text-[#8E8E93]'
              }`}>
                {step > i + 1 ? '✓' : i + 1}
              </div>
              <span className={`text-[12px] ${step === i + 1 ? 'text-[#1C1C1E] font-semibold' : 'text-[#8E8E93]'}`}>{label}</span>
              {i === 0 && <div className="flex-1 h-px bg-black/10" />}
            </div>
          ))}
        </div>

        <div className="p-4 space-y-4">
          {step === 1 ? (
            <>
              <textarea
                autoFocus
                value={rawText}
                onChange={e => setRawText(e.target.value)}
                placeholder={SAMPLE_PLACEHOLDER}
                rows={16}
                className="w-full px-4 py-3 rounded-[12px] bg-white text-[14px] text-[#1C1C1E] placeholder:text-[#AEAEB2] focus:outline-none resize-none leading-relaxed font-mono"
              />
              <button
                onClick={handleParse}
                disabled={!rawText.trim()}
                className="w-full py-3 rounded-[12px] bg-[#007AFF] text-white font-semibold text-[15px] disabled:opacity-30 active:opacity-70 transition-opacity"
              >
                解析してプレビュー
              </button>
            </>
          ) : (
            <>
              {parsed.parseFailed && (
                <div className="rounded-[12px] bg-[#FF9500]/10 px-4 py-3">
                  <p className="text-[13px] font-medium text-[#FF9500]">⚠ 想定の形式を検出できませんでした</p>
                  <p className="text-[12px] text-[#8E8E93] mt-1">全文をそのまま「相場動向」として保存します。</p>
                </div>
              )}
              {!parsed.parseFailed && parsed.warnings.length > 0 && (
                <div className="rounded-[12px] bg-[#FF9500]/10 px-4 py-3">
                  <p className="text-[13px] font-medium text-[#FF9500]">⚠ 一部の行を解析できませんでした</p>
                  <ul className="mt-1 space-y-0.5">
                    {parsed.warnings.map((w, i) => (
                      <li key={i} className="text-[11px] text-[#8E8E93]">{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="ios-card px-4 py-3">
                <p className="text-[13px] font-semibold text-[#8E8E93] mb-1">週タイトル</p>
                <p className="text-[16px] font-semibold text-[#1C1C1E]">{parsed.weekLabel || parsed.recordDate}</p>
              </div>

              <div className="ios-card px-4 py-3">
                <p className="text-[13px] font-semibold text-[#8E8E93] mb-2">相場動向</p>
                {parsed.marketSummary
                  ? <Markdown>{parsed.marketSummary}</Markdown>
                  : <p className="text-[13px] text-[#AEAEB2]">（記載なし）</p>}
              </div>

              <div className="ios-card px-4 py-3">
                <p className="text-[13px] font-semibold text-[#8E8E93] mb-2">
                  スクリーニング結果（{parsed.stocks.length}件）
                </p>
                {parsed.stocks.length === 0 ? (
                  <p className="text-[13px] text-[#AEAEB2]">（記載なし）</p>
                ) : (
                  <div className="divide-y divide-black/[0.04] -mx-4">
                    {parsed.stocks.map((s, i) => (
                      <div key={i} className="flex items-center justify-between px-4 py-2">
                        <div className="min-w-0">
                          <p className="text-[14px] text-[#1C1C1E] truncate">{s.name} <span className="text-[#8E8E93]">({s.code})</span></p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-[12px] text-[#8E8E93] tabular-nums">{s.score ?? '-'}</span>
                          <StockBadge status={s.status} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="ios-card px-4 py-3">
                <p className="text-[13px] font-semibold text-[#8E8E93] mb-2">
                  TODO（{parsed.todos.length}件）
                </p>
                {parsed.todos.length === 0 ? (
                  <p className="text-[13px] text-[#AEAEB2]">（記載なし）</p>
                ) : (
                  <div className="space-y-1.5">
                    {parsed.todos.map((t, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className={`w-4 h-4 rounded-[4px] border flex-shrink-0 flex items-center justify-center ${
                          t.done ? 'bg-[#34C759] border-[#34C759]' : 'border-[#C7C7CC]'
                        }`}>
                          {t.done && <span className="text-white text-[10px]">✓</span>}
                        </span>
                        <span className={`text-[13px] ${t.done ? 'line-through text-[#AEAEB2]' : 'text-[#1C1C1E]'}`}>
                          {t.date && <span className="text-[#8E8E93] mr-1.5">{t.date}</span>}
                          {t.content}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setParsed(null)}
                  className="flex-1 py-3 rounded-[12px] bg-black/[0.05] text-[#1C1C1E] font-medium text-[14px] active:opacity-70 transition-opacity"
                >
                  戻る
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-[2] py-3 rounded-[12px] bg-[#007AFF] text-white font-semibold text-[15px] disabled:opacity-40 active:opacity-70 transition-opacity"
                >
                  {saving ? '保存中…' : '保存'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── 記録カード（一覧） ──
function LogCard({ entry, onOpen }) {
  const preview = (entry.market_summary ?? '').split('\n').filter(Boolean).slice(0, 2).join(' ')
  return (
    <div
      onClick={() => onOpen(entry)}
      className="ios-card px-4 py-4 cursor-pointer active:scale-[0.99] transition-transform"
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[16px] font-semibold text-[#1C1C1E] leading-snug">{formatWeekTitle(entry)}</p>
          {preview && (
            <p className="text-[13px] text-[#8E8E93] leading-relaxed line-clamp-2 mt-1">{preview}</p>
          )}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {entry.stocks.length > 0 && (
              <span className="text-[11px] text-[#8E8E93]">📊 {entry.stocks.length}銘柄</span>
            )}
            {entry.todos.length > 0 && (
              <span className="text-[11px] text-[#8E8E93]">
                ☑ {entry.todos.filter(t => t.done).length}/{entry.todos.length}
              </span>
            )}
          </div>
        </div>
        <svg className="w-4 h-4 text-[#C7C7CC] flex-shrink-0 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </div>
  )
}

// ── 詳細モーダル ──
function LogDetailModal({ entry, onClose, onToggleTodo, onDelete, onEdit }) {
  async function handleDelete() {
    if (!window.confirm('この記録を削除しますか？')) return
    await onDelete(entry.id)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-[2px] flex items-end md:items-center md:justify-center z-40" onClick={onClose}>
      <div
        className="w-full bg-[#F2F2F7] rounded-t-[16px] md:rounded-[16px] max-w-lg md:max-w-xl mx-auto shadow-2xl max-h-[92vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-[#F2F2F7]/90 backdrop-blur-xl px-4 py-3 flex items-center justify-between border-b border-black/5 rounded-t-[16px]">
          <button onClick={onClose} className="ios-toolbar-btn">閉じる</button>
          <h2 className="text-[16px] font-semibold text-[#1C1C1E] truncate px-2">{formatWeekTitle(entry)}</h2>
          <button onClick={() => onEdit(entry)} className="ios-toolbar-btn font-semibold">編集</button>
        </div>

        <div className="p-4 space-y-4">
          <div className="ios-card px-4 py-3">
            <p className="text-[13px] font-semibold text-[#8E8E93] mb-2">相場動向</p>
            {entry.market_summary
              ? <Markdown>{entry.market_summary}</Markdown>
              : <p className="text-[13px] text-[#AEAEB2]">（記載なし）</p>}
          </div>

          {entry.stocks.length > 0 && (
            <div>
              <p className="text-[13px] font-semibold text-[#8E8E93] mb-2 px-1">スクリーニング結果</p>
              <div className="space-y-2">
                {entry.stocks.map(s => (
                  <div key={s.id} className="ios-card px-4 py-3 flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-[14px] font-medium text-[#1C1C1E] truncate">{s.name}</p>
                      <p className="text-[12px] text-[#8E8E93]">{s.code}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-[13px] text-[#8E8E93] tabular-nums">
                        {s.score != null ? `${s.score}点` : '-'}
                      </span>
                      <StockBadge status={s.status} />
                    </div>
                  </div>
                ))}
              </div>
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
                      {t.todo_date && <span className="text-[#8E8E93] mr-1.5">{t.todo_date}</span>}
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
  const [codeQuery, setCodeQuery] = useState(null)

  const byCode = {}
  for (const entry of entries) {
    for (const s of entry.stocks) {
      const key = s.code
      if (!byCode[key]) byCode[key] = { code: s.code, name: s.name, history: [] }
      byCode[key].name = s.name // 最新の名称で上書き（entriesは降順のためentries[0]が最新）
      byCode[key].history.push({
        record_date: entry.record_date,
        week_label: entry.week_label,
        score: s.score,
        status: s.status,
      })
    }
  }
  const codes = Object.values(byCode).sort((a, b) => b.history.length - a.history.length)
  const selected = codeQuery ? byCode[codeQuery] : null

  if (selected) {
    return (
      <div className="ios-card px-4 py-4">
        <button onClick={() => setCodeQuery(null)} className="text-[13px] text-[#007AFF] mb-3 active:opacity-50">
          ← 銘柄一覧に戻る
        </button>
        <p className="text-[17px] font-semibold text-[#1C1C1E]">{selected.name}</p>
        <p className="text-[12px] text-[#8E8E93] mb-3">{selected.code}</p>
        <div className="divide-y divide-black/[0.04]">
          {selected.history.map((h, i) => (
            <div key={i} className="flex items-center justify-between py-2.5">
              <span className="text-[13px] text-[#1C1C1E]">{h.week_label || h.record_date}</span>
              <div className="flex items-center gap-2">
                <span className="text-[12px] text-[#8E8E93] tabular-nums">{h.score != null ? `${h.score}点` : '-'}</span>
                <StockBadge status={h.status} />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="ios-card px-4 py-4">
      <button onClick={onBack} className="text-[13px] text-[#007AFF] mb-3 active:opacity-50">
        ← 記録一覧に戻る
      </button>
      {codes.length === 0 ? (
        <p className="text-[13px] text-[#AEAEB2] py-6 text-center">まだ銘柄の記録がありません</p>
      ) : (
        <div className="divide-y divide-black/[0.04]">
          {codes.map(c => (
            <button
              key={c.code}
              onClick={() => setCodeQuery(c.code)}
              className="w-full flex items-center justify-between py-2.5 text-left active:opacity-60"
            >
              <div className="min-w-0">
                <p className="text-[14px] font-medium text-[#1C1C1E] truncate">{c.name}</p>
                <p className="text-[12px] text-[#8E8E93]">{c.code}</p>
              </div>
              <span className="text-[12px] text-[#8E8E93] flex-shrink-0">{c.history.length}回言及</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── メイン（AssetsPage のサブ機能として組み込み） ──
export default function StockLogSection() {
  const { user } = useAuth()
  const { entries, loading, addEntry, replaceEntry, toggleTodo, deleteEntry } = useStockLogs(user?.id)
  const [editing, setEditing] = useState(null)  // null | { mode: 'new' } | { mode: 'edit', entry }
  const [viewing, setViewing] = useState(null)
  const [showCrossView, setShowCrossView] = useState(false)

  async function handleSaveNew(parsed, rawText) {
    await addEntry(parsed, rawText)
  }

  async function handleSaveEdit(parsed, rawText) {
    const updated = await replaceEntry(editing.entry.id, parsed, rawText)
    if (updated) setViewing(updated)
  }

  return (
    <>
      {showCrossView ? (
        <CrossView entries={entries} onBack={() => setShowCrossView(false)} />
      ) : (
        <>
          <button
            onClick={() => setShowCrossView(true)}
            className="w-full mb-3 py-2.5 rounded-[12px] bg-white text-[#1C1C1E] text-[13px] font-medium shadow-[0_1px_2px_rgba(0,0,0,0.06)] active:opacity-70 transition-opacity"
          >
            🔍 銘柄で横断的に見る
          </button>

          {loading ? (
            <div className="text-center py-20 text-[#AEAEB2] text-[13px]">読み込み中…</div>
          ) : entries.length === 0 ? (
            <div className="text-center py-24">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#767680]/10 flex items-center justify-center">
                <svg className="w-7 h-7 text-[#AEAEB2]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-[15px] font-medium text-[#8E8E93]">記録がありません</p>
              <p className="text-[13px] text-[#AEAEB2] mt-1">＋ボタンから週次サマリーを貼り付けて登録できます</p>
            </div>
          ) : (
            <div className="space-y-2">
              {entries.map(e => (
                <LogCard key={e.id} entry={e} onOpen={setViewing} />
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
        <LogDetailModal
          entry={viewing}
          onClose={() => setViewing(null)}
          onToggleTodo={toggleTodo}
          onDelete={deleteEntry}
          onEdit={entry => { setViewing(null); setEditing({ mode: 'edit', entry }) }}
        />
      )}

      {editing?.mode === 'new' && (
        <StockLogEditor onSave={handleSaveNew} onClose={() => setEditing(null)} />
      )}
      {editing?.mode === 'edit' && (
        <StockLogEditor
          initialRawText={editing.entry.raw_text}
          onSave={handleSaveEdit}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  )
}
