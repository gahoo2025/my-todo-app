import { useState, useMemo } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useWatchStocks } from '../hooks/useWatchStocks'
import { useStockDirectorySearch } from '../hooks/useStockDirectorySearch'

const PURPOSE_PRESETS = ['高配当', '割安', '短期', '中長期', '成長株', 'テーマ株']
const PURPOSE_COLORS = ['#007AFF', '#AF52DE', '#FF9500', '#34C759', '#FF3B30', '#5AC8FA']

function purposeColor(p) {
  const i = PURPOSE_PRESETS.indexOf(p)
  const color = i >= 0 ? PURPOSE_COLORS[i] : '#8E8E93'
  return { text: color, bg: `${color}1A` }
}

const yen = new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', maximumFractionDigits: 0 })

function targetPriceLabel(item) {
  const min = item.target_price_min != null ? Number(item.target_price_min) : null
  const max = item.target_price_max != null ? Number(item.target_price_max) : null
  if (min == null && max == null) return null
  if (min != null && max != null && min !== max) return `${yen.format(min)}〜${yen.format(max)}`
  return yen.format(min ?? max)
}

// 配当利回り(%) = 配当金(1株あたり) ÷ 株価 × 100
function calcDividendYield(dividendPerShare, price) {
  const d = Number(dividendPerShare)
  const p = Number(price)
  if (!d || !p) return null
  return (d / p) * 100
}

// ── 銘柄検索（過去の入力履歴から候補を出す） ──
function StockSearchField({ userId, onPick }) {
  const [query, setQuery] = useState('')
  const { candidates, loading } = useStockDirectorySearch(userId, query)

  return (
    <div>
      <input
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="コードまたは企業名で検索…"
        className="w-full px-4 py-3 text-[15px] text-[#1C1C1E] placeholder:text-[#AEAEB2] bg-transparent focus:outline-none"
      />
      {query.trim() && (
        <div className="px-4 pb-3">
          {loading ? (
            <p className="text-[12px] text-[#AEAEB2]">検索中…</p>
          ) : candidates.length === 0 ? (
            <p className="text-[12px] text-[#AEAEB2]">
              過去の記録に一致がありません。下の欄に手入力してください。
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {candidates.map((c, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => { onPick(c); setQuery('') }}
                  className="text-[12px] font-medium px-2.5 py-1 rounded-full bg-[#007AFF]/10 text-[#007AFF] active:opacity-60 transition-opacity"
                >
                  {c.name}{c.code ? ` (${c.code})` : ''}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── 追加・編集モーダル ──
function WatchStockModal({ item, userId, availableTags, onSave, onDelete, onClose }) {
  const isNew = !item.id
  const [code, setCode] = useState(item.code ?? '')
  const [name, setName] = useState(item.name ?? '')
  const [purposes, setPurposes] = useState(item.purposes ?? [])
  const [customPurpose, setCustomPurpose] = useState('')
  const [targetPriceMin, setTargetPriceMin] = useState(item.target_price_min ?? '')
  const [targetPriceMax, setTargetPriceMax] = useState(item.target_price_max ?? '')
  const [dividendPerShare, setDividendPerShare] = useState(item.dividend_per_share ?? '')
  const [currentPrice, setCurrentPrice] = useState(item.current_price ?? '')
  const [shareholderBenefit, setShareholderBenefit] = useState(item.shareholder_benefit ?? '')
  const [memo, setMemo] = useState(item.memo ?? '')
  const [saving, setSaving] = useState(false)

  const previewYield = calcDividendYield(dividendPerShare, currentPrice)

  function togglePurpose(p) {
    setPurposes(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])
  }

  function addCustomPurpose() {
    const v = customPurpose.trim()
    if (!v || purposes.includes(v)) return
    setPurposes(prev => [...prev, v])
    setCustomPurpose('')
  }

  async function handleSave() {
    if (!code.trim() || !name.trim()) return
    setSaving(true)
    await onSave({
      code: code.trim(),
      name: name.trim(),
      purposes,
      target_price_min: targetPriceMin !== '' ? Number(targetPriceMin) : null,
      target_price_max: targetPriceMax !== '' ? Number(targetPriceMax) : null,
      dividend_per_share: dividendPerShare !== '' ? Number(dividendPerShare) : null,
      current_price: currentPrice !== '' ? Number(currentPrice) : null,
      shareholder_benefit: shareholderBenefit.trim() || null,
      memo: memo.trim() || null,
    })
    setSaving(false)
    onClose()
  }

  async function handleDelete() {
    if (!window.confirm('この監視銘柄を削除しますか？')) return
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
          <h2 className="text-[16px] font-semibold text-[#1C1C1E]">{isNew ? '監視銘柄を追加' : '監視銘柄を編集'}</h2>
          <button
            onClick={handleSave}
            disabled={saving || !code.trim() || !name.trim()}
            className="ios-toolbar-btn font-semibold disabled:opacity-30"
          >
            {saving ? '保存中…' : '保存'}
          </button>
        </div>

        <div className="p-4 space-y-4">
          {isNew && (
            <div className="ios-card overflow-hidden">
              <p className="px-4 pt-2.5 text-[12px] font-semibold text-[#8E8E93]">銘柄を検索して選択</p>
              <StockSearchField userId={userId} onPick={c => { setName(c.name); if (c.code) setCode(c.code) }} />
            </div>
          )}

          {/* コード・銘柄名（常に手入力・修正可能） */}
          <div className="ios-card overflow-hidden divide-y divide-black/[0.04]">
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-[15px] text-[#1C1C1E] flex-shrink-0">銘柄コード</span>
              <input
                type="text"
                value={code}
                onChange={e => setCode(e.target.value)}
                placeholder="例: 7203"
                className="flex-1 min-w-0 ml-3 text-[15px] text-[#1C1C1E] placeholder:text-[#AEAEB2] bg-transparent focus:outline-none text-right"
              />
            </div>
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-[15px] text-[#1C1C1E] flex-shrink-0">銘柄名</span>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="例: トヨタ自動車"
                className="flex-1 min-w-0 ml-3 text-[15px] text-[#1C1C1E] placeholder:text-[#AEAEB2] bg-transparent focus:outline-none text-right"
              />
            </div>
          </div>

          {/* 目的タグ */}
          <div className="ios-card overflow-hidden px-4 py-3">
            <p className="text-[12px] font-semibold text-[#8E8E93] mb-2">目的</p>
            <div className="flex flex-wrap gap-1.5">
              {Array.from(new Set([...(availableTags ?? PURPOSE_PRESETS), ...purposes])).map(p => {
                const active = purposes.includes(p)
                const isPreset = PURPOSE_PRESETS.includes(p)
                const c = purposeColor(p)
                // カスタムタグ（プリセット外）は専用の色がないため、選択時と未選択時が
                // 同じグレーで見分けがつかなかった。選択時ははっきり塗りつぶして区別する。
                const style = active
                  ? (isPreset ? { color: c.text, backgroundColor: c.bg } : { color: '#FFFFFF', backgroundColor: '#8E8E93' })
                  : { color: '#8E8E93', backgroundColor: 'rgba(0,0,0,0.04)' }
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => togglePurpose(p)}
                    className="text-[12px] font-medium px-2.5 py-1 rounded-full transition-colors"
                    style={style}
                  >
                    {active && !isPreset ? '✓ ' : ''}{p}
                  </button>
                )
              })}
            </div>
            <div className="flex items-center gap-2 mt-2.5">
              <input
                type="text"
                value={customPurpose}
                onChange={e => setCustomPurpose(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomPurpose() } }}
                placeholder="自由入力で目的を追加"
                className="flex-1 min-w-0 text-[13px] text-[#1C1C1E] placeholder:text-[#AEAEB2] bg-transparent focus:outline-none border-b border-black/10 py-1"
              />
              <button
                type="button"
                onClick={addCustomPurpose}
                className="flex-shrink-0 text-[13px] font-semibold text-[#007AFF] px-2 py-1 active:opacity-50 transition-opacity"
              >
                追加
              </button>
            </div>
          </div>

          {/* 目標株価（範囲入力可）・メモ */}
          <div className="ios-card overflow-hidden divide-y divide-black/[0.04]">
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-[15px] text-[#1C1C1E] flex-shrink-0">目標株価</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  inputMode="decimal"
                  value={targetPriceMin}
                  onChange={e => setTargetPriceMin(e.target.value)}
                  placeholder="下限"
                  className="w-16 min-w-0 text-[15px] text-[#1C1C1E] placeholder:text-[#AEAEB2] bg-transparent focus:outline-none text-right"
                />
                <span className="text-[13px] text-[#8E8E93]">〜</span>
                <input
                  type="number"
                  inputMode="decimal"
                  value={targetPriceMax}
                  onChange={e => setTargetPriceMax(e.target.value)}
                  placeholder="上限"
                  className="w-16 min-w-0 text-[15px] text-[#1C1C1E] placeholder:text-[#AEAEB2] bg-transparent focus:outline-none text-right"
                />
                <span className="text-[13px] text-[#8E8E93]">円</span>
              </div>
            </div>
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-[15px] text-[#1C1C1E] flex-shrink-0">現在株価</span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  inputMode="decimal"
                  value={currentPrice}
                  onChange={e => setCurrentPrice(e.target.value)}
                  placeholder="未設定"
                  className="w-24 min-w-0 text-[15px] text-[#1C1C1E] placeholder:text-[#AEAEB2] bg-transparent focus:outline-none text-right"
                />
                <span className="text-[13px] text-[#8E8E93]">円</span>
              </div>
            </div>
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-[15px] text-[#1C1C1E] flex-shrink-0">配当金（1株）</span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  inputMode="decimal"
                  value={dividendPerShare}
                  onChange={e => setDividendPerShare(e.target.value)}
                  placeholder="未設定"
                  className="w-24 min-w-0 text-[15px] text-[#1C1C1E] placeholder:text-[#AEAEB2] bg-transparent focus:outline-none text-right"
                />
                <span className="text-[13px] text-[#8E8E93]">円</span>
              </div>
            </div>
            {previewYield != null && (
              <div className="flex items-center justify-between px-4 py-2">
                <span className="text-[13px] text-[#8E8E93]">配当利回り</span>
                <span className="text-[14px] font-semibold text-[#34C759]">{previewYield.toFixed(2)}%</span>
              </div>
            )}
            <textarea
              rows={2}
              value={shareholderBenefit}
              onChange={e => setShareholderBenefit(e.target.value)}
              placeholder="優待内容（任意）"
              className="w-full px-4 py-3 text-[14px] text-[#1C1C1E] placeholder:text-[#AEAEB2] bg-transparent focus:outline-none resize-none leading-relaxed"
            />
            <textarea
              rows={2}
              value={memo}
              onChange={e => setMemo(e.target.value)}
              placeholder="メモ（任意）"
              className="w-full px-4 py-3 text-[14px] text-[#1C1C1E] placeholder:text-[#AEAEB2] bg-transparent focus:outline-none resize-none leading-relaxed"
            />
          </div>

          {!isNew && (
            <button
              onClick={handleDelete}
              className="w-full py-3 rounded-[12px] text-[#FF3B30] text-[15px] font-medium bg-[#FF3B30]/[0.08] active:opacity-70 transition-opacity"
            >
              監視銘柄を削除
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function WatchStockCard({ item, onOpen }) {
  const dividendYield = calcDividendYield(item.dividend_per_share, item.current_price)
  return (
    <div
      onClick={() => onOpen(item)}
      className="ios-card px-4 py-3.5 cursor-pointer active:scale-[0.99] transition-transform"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-[#1C1C1E] truncate">
            {item.name} <span className="text-[#8E8E93] font-normal">({item.code})</span>
          </p>
          {item.purposes?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {item.purposes.map(p => {
                const c = purposeColor(p)
                return (
                  <span key={p} className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                    style={{ color: c.text, backgroundColor: c.bg }}>
                    {p}
                  </span>
                )
              })}
            </div>
          )}
          {(dividendYield != null || item.shareholder_benefit) && (
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {dividendYield != null && (
                <span className="text-[11px] font-medium text-[#34C759]">
                  配当利回り {dividendYield.toFixed(2)}%
                </span>
              )}
              {item.shareholder_benefit && (
                <span className="text-[11px] text-[#8E8E93] truncate">🎁 {item.shareholder_benefit}</span>
              )}
            </div>
          )}
        </div>
        {targetPriceLabel(item) && (
          <div className="text-right flex-shrink-0">
            <p className="text-[11px] text-[#AEAEB2]">目標</p>
            <p className="text-[14px] font-semibold text-[#1C1C1E] tabular-nums">{targetPriceLabel(item)}</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default function WatchStocksSection() {
  const { user } = useAuth()
  const { stocks, loading, addStock, updateStock, deleteStock } = useWatchStocks(user?.id)
  const [modal, setModal] = useState(null)

  // プリセット＋過去に登録した銘柄で実際に使われたカスタムタグを、次回以降も選べるようにする
  const availableTags = useMemo(() => {
    const set = new Set(PURPOSE_PRESETS)
    for (const s of stocks) for (const p of s.purposes ?? []) set.add(p)
    return Array.from(set)
  }, [stocks])

  async function handleSave(data) {
    if (modal.item.id) await updateStock(modal.item.id, data)
    else await addStock(data)
  }

  return (
    <>
      {loading ? (
        <div className="text-center py-20 text-[#AEAEB2] text-[13px]">読み込み中…</div>
      ) : stocks.length === 0 ? (
        <div className="text-center py-24">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#767680]/10 flex items-center justify-center">
            <svg className="w-7 h-7 text-[#AEAEB2]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </div>
          <p className="text-[15px] font-medium text-[#8E8E93]">監視銘柄がありません</p>
          <p className="text-[13px] text-[#AEAEB2] mt-1">＋ボタンからコードや企業名で検索して追加できます</p>
        </div>
      ) : (
        <div className="space-y-2">
          {stocks.map(s => (
            <WatchStockCard key={s.id} item={s} onOpen={item => setModal({ item })} />
          ))}
        </div>
      )}

      {/* 新規追加ボタン（PC） */}
      <button
        onClick={() => setModal({ item: {} })}
        className="hidden md:block w-full mt-4 py-2.5 rounded-[12px] bg-[#007AFF] text-white font-semibold text-[14px] active:opacity-70 transition-opacity shadow-[0_2px_8px_rgba(0,122,255,0.3)]"
      >
        ＋ 監視銘柄を追加
      </button>

      {/* モバイル FAB */}
      <button
        onClick={() => setModal({ item: {} })}
        className="md:hidden fixed bottom-20 right-5 w-[54px] h-[54px] bg-[#007AFF] text-white rounded-full shadow-[0_4px_16px_rgba(0,122,255,0.4)] flex items-center justify-center active:scale-90 transition-transform z-30"
        aria-label="監視銘柄を追加"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
          <path strokeLinecap="round" d="M12 5v14m-7-7h14" />
        </svg>
      </button>

      {modal && (
        <WatchStockModal
          item={modal.item}
          userId={user?.id}
          availableTags={availableTags}
          onSave={handleSave}
          onDelete={() => deleteStock(modal.item.id)}
          onClose={() => setModal(null)}
        />
      )}
    </>
  )
}
