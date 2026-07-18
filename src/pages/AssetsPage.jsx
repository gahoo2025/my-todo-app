import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useStockAnalyses } from '../hooks/useStockAnalyses'
import { useAssetBalances } from '../hooks/useAssetBalances'
import Markdown from '../components/Markdown'
import MarketLogSection from '../components/MarketLog'

// サブ機能の定義（今後ここに追加していく）
const SUB_FEATURES = [
  { id: 'stocks',    label: '個別銘柄' },
  { id: 'marketlog', label: 'マーケットログ' },
]

// 資産残高の種類
const BALANCE_KINDS = [
  { id: 'stock', label: '株式',    color: 'text-[#007AFF]' },
  { id: 'fund',  label: '投資信託', color: 'text-[#AF52DE]' },
]

const yen = new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', maximumFractionDigits: 0 })

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatDate(s) {
  if (!s) return ''
  const [y, m, d] = s.split('-')
  return `${y}/${Number(m)}/${Number(d)}`
}

// ── 個別銘柄 分析の追加・編集モーダル ──
function AnalysisModal({ item, onSave, onDelete, onClose }) {
  const isNew = !item.id
  const [title, setTitle] = useState(item.title ?? '')
  const [memo, setMemo] = useState(item.memo ?? '')
  const [analyzedOn, setAnalyzedOn] = useState(item.analyzed_on ?? todayStr())
  const [memoPreview, setMemoPreview] = useState(false)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!title.trim()) return
    setSaving(true)
    await onSave({
      title: title.trim(),
      memo: memo.trim() || null,
      analyzed_on: analyzedOn || todayStr(),
    })
    setSaving(false)
    onClose()
  }

  async function handleDelete() {
    if (!window.confirm('この分析を削除しますか？')) return
    await onDelete()
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-[2px] flex items-end md:items-center md:justify-center z-40" onClick={onClose}>
      <div
        className="w-full bg-[#F2F2F7] rounded-t-[16px] md:rounded-[16px] max-w-lg mx-auto shadow-2xl max-h-[92vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-[#F2F2F7]/90 backdrop-blur-xl px-4 py-3 flex items-center justify-between border-b border-black/5 rounded-t-[16px]">
          <button onClick={onClose} className="ios-toolbar-btn">キャンセル</button>
          <h2 className="text-[16px] font-semibold text-[#1C1C1E]">{isNew ? '銘柄分析を追加' : '銘柄分析を編集'}</h2>
          <button
            onClick={handleSave}
            disabled={saving || !title.trim()}
            className="ios-toolbar-btn font-semibold disabled:opacity-30"
          >
            {saving ? '保存中…' : '保存'}
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* タイトル（企業名・銘柄コード） */}
          <div className="ios-card overflow-hidden">
            <input
              autoFocus
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="企業名・銘柄コード（例: トヨタ自動車 7203）"
              className="w-full px-4 py-3 text-[16px] text-[#1C1C1E] placeholder:text-[#AEAEB2] bg-transparent focus:outline-none"
            />
          </div>

          {/* 分析日 */}
          <div className="ios-card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-[15px] text-[#1C1C1E]">分析日</span>
              <input
                type="date"
                value={analyzedOn}
                onChange={e => setAnalyzedOn(e.target.value)}
                className="text-[15px] text-[#8E8E93] bg-transparent focus:outline-none text-right"
              />
            </div>
          </div>

          {/* 分析結果メモ（Markdown対応） */}
          <div className="ios-card overflow-hidden">
            <div className="flex items-center justify-between px-4 pt-2.5">
              <span className="text-[13px] font-semibold text-[#8E8E93]">分析結果</span>
              {memo.trim() && (
                <button
                  type="button"
                  onClick={() => setMemoPreview(p => !p)}
                  className={`text-[12px] font-medium px-2 py-0.5 rounded-full transition-colors ${
                    memoPreview ? 'text-[#007AFF] bg-[#007AFF]/10' : 'text-[#8E8E93] bg-black/[0.04]'
                  }`}
                >
                  {memoPreview ? '編集' : 'プレビュー'}
                </button>
              )}
            </div>
            {memoPreview ? (
              <div className="px-4 py-3 min-h-[120px]">
                <Markdown className="!text-[14px]">{memo}</Markdown>
              </div>
            ) : (
              <textarea
                rows={8}
                value={memo}
                onChange={e => setMemo(e.target.value)}
                placeholder="分析結果を入力…（Markdown / 表に対応）"
                className="w-full px-4 py-3 text-[14px] text-[#1C1C1E] placeholder:text-[#AEAEB2] bg-transparent focus:outline-none resize-none leading-relaxed"
              />
            )}
          </div>

          {!isNew && (
            <button
              onClick={handleDelete}
              className="w-full py-3 rounded-[12px] text-[#FF3B30] text-[15px] font-medium bg-[#FF3B30]/[0.08] active:opacity-70 transition-opacity"
            >
              削除
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function AnalysisCard({ item, onOpen }) {
  return (
    <div
      onClick={() => onOpen(item)}
      className="ios-card px-4 py-4 cursor-pointer active:scale-[0.99] transition-transform"
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[16px] font-semibold text-[#1C1C1E] leading-snug break-words">{item.title}</p>
          <p className="text-[12px] text-[#8E8E93] mt-0.5">分析日 {formatDate(item.analyzed_on)}</p>
          {item.memo && (
            <div className="mt-2 max-h-[200px] overflow-hidden">
              <Markdown>{item.memo}</Markdown>
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

// ── 個別銘柄 サブ機能 ──
function StockAnalyses() {
  const { user } = useAuth()
  const { analyses, loading, addAnalysis, updateAnalysis, deleteAnalysis } = useStockAnalyses(user?.id)
  const [modal, setModal] = useState(null)

  async function handleSave(data) {
    if (modal.item.id) await updateAnalysis(modal.item.id, data)
    else await addAnalysis(data)
  }

  return (
    <>
      {loading ? (
        <div className="text-center py-20 text-[#AEAEB2] text-[13px]">読み込み中…</div>
      ) : analyses.length === 0 ? (
        <div className="text-center py-24">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#767680]/10 flex items-center justify-center">
            <svg className="w-7 h-7 text-[#AEAEB2]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 17l6-6 4 4 8-8M21 7v4m0-4h-4" />
            </svg>
          </div>
          <p className="text-[15px] font-medium text-[#8E8E93]">分析がありません</p>
          <p className="text-[13px] text-[#AEAEB2] mt-1">＋ボタンから銘柄分析を追加できます</p>
        </div>
      ) : (
        <div className="space-y-2">
          {analyses.map(a => (
            <AnalysisCard key={a.id} item={a} onOpen={item => setModal({ item })} />
          ))}
        </div>
      )}

      {/* 新規追加ボタン（PC） */}
      <button
        onClick={() => setModal({ item: {} })}
        className="hidden md:block w-full mt-4 py-2.5 rounded-[12px] bg-[#007AFF] text-white font-semibold text-[14px] active:opacity-70 transition-opacity shadow-[0_2px_8px_rgba(0,122,255,0.3)]"
      >
        ＋ 銘柄分析を追加
      </button>

      {/* モバイル FAB */}
      <button
        onClick={() => setModal({ item: {} })}
        className="md:hidden fixed bottom-20 right-5 w-[54px] h-[54px] bg-[#007AFF] text-white rounded-full shadow-[0_4px_16px_rgba(0,122,255,0.4)] flex items-center justify-center active:scale-90 transition-transform z-30"
        aria-label="銘柄分析を追加"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
          <path strokeLinecap="round" d="M12 5v14m-7-7h14" />
        </svg>
      </button>

      {modal && (
        <AnalysisModal
          item={modal.item}
          onSave={handleSave}
          onDelete={() => deleteAnalysis(modal.item.id)}
          onClose={() => setModal(null)}
        />
      )}
    </>
  )
}

// ── 資産額サマリー（株式・投資信託の最新残高） ──
function AssetSummary() {
  const { user } = useAuth()
  const { latestByKind, loading } = useAssetBalances(user?.id)

  const rows = BALANCE_KINDS.map(k => ({ ...k, bal: latestByKind[k.id] }))
  const total = rows.reduce((sum, r) => sum + (r.bal ? Number(r.bal.amount) : 0), 0)
  const hasAny = rows.some(r => r.bal)

  return (
    <div className="ios-card overflow-hidden mb-3">
      <div className="px-4 pt-3.5 pb-2 border-b border-black/[0.05]">
        <p className="text-[12px] font-semibold text-[#8E8E93]">現在の資産額</p>
        <p className="text-[28px] font-bold text-[#1C1C1E] leading-tight mt-0.5 tabular-nums">
          {loading ? '—' : yen.format(total)}
        </p>
      </div>
      <div className="divide-y divide-black/[0.04]">
        {rows.map(r => (
          <div key={r.id} className="flex items-center justify-between px-4 py-2.5">
            <span className={`text-[15px] font-medium ${r.color}`}>{r.label}</span>
            <div className="text-right">
              <p className="text-[15px] font-semibold text-[#1C1C1E] tabular-nums">
                {r.bal ? yen.format(Number(r.bal.amount)) : '未登録'}
              </p>
              {r.bal && (
                <p className="text-[11px] text-[#AEAEB2]">{formatDate(r.bal.as_of)} 時点</p>
              )}
            </div>
          </div>
        ))}
      </div>
      {!loading && !hasAny && (
        <p className="px-4 py-3 text-[12px] text-[#AEAEB2]">
          残高はAPIから登録できます（株式・投資信託）。
        </p>
      )}
    </div>
  )
}

export default function AssetsPage({ embedded }) {
  const [sub, setSub] = useState('stocks')

  const body = (
    <>
      {/* 資産額サマリー */}
      <AssetSummary />

      {/* サブ機能セグメント */}
      <div className="sticky top-below-header z-[5] -mx-4 px-4 pt-2 pb-2.5 bg-[#F2F2F7]/85 backdrop-blur-xl flex gap-2 overflow-x-auto">
        {SUB_FEATURES.map(f => (
          <button
            key={f.id}
            onClick={() => setSub(f.id)}
            className={`flex-shrink-0 px-3.5 h-8 rounded-full text-[13px] font-medium transition-all duration-200 ${
              sub === f.id
                ? 'bg-[#1C1C1E] text-white'
                : 'bg-white text-[#1C1C1E] shadow-[0_1px_2px_rgba(0,0,0,0.06)]'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="mt-3">
        {sub === 'stocks' && <StockAnalyses />}
        {sub === 'marketlog' && <MarketLogSection />}
      </div>
    </>
  )

  if (embedded) {
    return (
      <main className="max-w-lg md:max-w-2xl mx-auto px-4 py-4 pb-28 md:pb-10">
        {body}
      </main>
    )
  }
  return (
    <div className="min-h-screen">
      <main className="max-w-lg md:max-w-2xl mx-auto px-4 py-4 pb-10">{body}</main>
    </div>
  )
}
