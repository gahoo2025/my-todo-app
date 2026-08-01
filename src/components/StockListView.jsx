import { useState, useMemo } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useStockList } from '../hooks/useStockList'

const numFmt = new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 2 })

const JUDGEMENT_COLOR = {
  '恒久除外': 'text-[#8E8E93]',
  '除外': 'text-[#8E8E93]',
}
function judgementColor(v) {
  if (!v) return 'text-[#8E8E93]'
  if (JUDGEMENT_COLOR[v]) return JUDGEMENT_COLOR[v]
  if (v.includes('除外')) return 'text-[#8E8E93]'
  return 'text-[#1C1C1E]'
}

export default function StockListView() {
  const { user } = useAuth()
  const { items, loading, importing, importResult, importList } = useStockList(user?.id)
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter(it =>
      [it.symbol_code, it.symbol_name, it.category, it.sector].filter(Boolean).join(' ').toLowerCase().includes(q)
    )
  }, [items, query])

  return (
    <div className="space-y-3">
      <div className="ios-card px-4 py-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[15px] font-semibold text-[#1C1C1E]">銘柄リストの取り込み</p>
            <p className="text-[12px] text-[#8E8E93] mt-0.5">Googleドライブの銘柄リスト.csvを取り込みます</p>
          </div>
          <button
            onClick={importList}
            disabled={importing}
            className="flex-shrink-0 px-4 py-2.5 rounded-[10px] bg-[#007AFF] text-white text-[14px] font-semibold disabled:opacity-40 active:opacity-70 transition-opacity"
          >
            {importing ? '取り込み中…' : '取り込む'}
          </button>
        </div>
        {importResult?.error && (
          <div className="mt-3">
            <p className="text-[12px] text-[#FF3B30]">⚠ {importResult.error}</p>
            {importResult.warnings?.length > 0 && (
              <ul className="mt-1 space-y-0.5">
                {importResult.warnings.map((w, i) => <li key={i} className="text-[11px] text-[#FF9500]">⚠ {w}</li>)}
              </ul>
            )}
          </div>
        )}
        {importResult?.success && (
          <p className="mt-3 text-[12px] text-[#34C759]">✓ {importResult.imported}件を取り込みました</p>
        )}
      </div>

      <input
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="銘柄名・コード・分類・セクターで検索"
        className="w-full px-3 py-2.5 rounded-[10px] bg-white text-[14px] text-[#1C1C1E] placeholder:text-[#AEAEB2] shadow-[0_1px_2px_rgba(0,0,0,0.06)] focus:outline-none"
      />

      <div className="ios-card overflow-hidden">
        {loading ? (
          <p className="px-4 py-6 text-center text-[13px] text-[#AEAEB2]">読み込み中…</p>
        ) : filtered.length === 0 ? (
          <p className="px-4 py-6 text-center text-[13px] text-[#AEAEB2]">
            {items.length === 0 ? '「取り込む」から銘柄リストを取り込んでください' : '該当する銘柄がありません'}
          </p>
        ) : (
          <div className="divide-y divide-black/[0.04]">
            {filtered.map(it => (
              <div key={it.symbol_code} className="px-4 py-2.5">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-[14px] font-medium text-[#1C1C1E] truncate">
                      {it.symbol_name || '（銘柄名なし）'}
                      <span className="text-[12px] text-[#8E8E93] ml-1.5">{it.symbol_code}</span>
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      {it.category && (
                        <span className="text-[11px] font-medium px-1.5 py-0.5 rounded-full bg-[#007AFF]/10 text-[#007AFF]">{it.category}</span>
                      )}
                      {it.sector && <span className="text-[11px] text-[#8E8E93]">{it.sector}</span>}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-2">
                    {it.latest_price != null && (
                      <p className="text-[14px] text-[#1C1C1E] tabular-nums">{numFmt.format(it.latest_price)}円</p>
                    )}
                    {it.dividend_yield != null && (
                      <p className="text-[11px] text-[#8E8E93] tabular-nums">利回り{numFmt.format(it.dividend_yield)}%</p>
                    )}
                  </div>
                </div>
                {(it.layer1_judgement || it.layer2_status || it.layer2_signal || it.final_judgement) && (
                  <div className="mt-1.5 space-y-0.5 border-l-2 border-black/[0.06] pl-3">
                    {it.layer1_judgement && (
                      <p className="text-[11px] text-[#8E8E93]">Layer1: {it.layer1_judgement}</p>
                    )}
                    {(it.layer2_status || it.layer2_signal) && (
                      <p className="text-[11px] text-[#8E8E93]">
                        Layer2: {[it.layer2_status, it.layer2_signal].filter(Boolean).join(' / ')}
                      </p>
                    )}
                    {it.final_judgement && (
                      <p className={`text-[11px] font-medium ${judgementColor(it.final_judgement)}`}>
                        最終判定: {it.final_judgement}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
