import { useState, useMemo } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useStockList } from '../hooks/useStockList'

const numFmt = new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 2 })

// 最終判定の内容から色分けバッジのスタイルを決める
function judgementBadge(v) {
  if (!v) return { bg: 'bg-black/[0.05]', text: 'text-[#8E8E93]' }
  if (v.includes('購入候補') || v.includes('買い')) return { bg: 'bg-[#34C759]/12', text: 'text-[#248A3D]' }
  if (v.includes('一次除外') || v.includes('対象外') || v.includes('恒久除外') || v.includes('除外')) {
    return { bg: 'bg-black/[0.05]', text: 'text-[#8E8E93]' }
  }
  return { bg: 'bg-[#007AFF]/10', text: 'text-[#007AFF]' }
}

export default function StockListView() {
  const { user } = useAuth()
  const { items, loading, importing, importResult, importList } = useStockList(user?.id)
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState(null)

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
          <div className="mt-3">
            <p className="text-[12px] text-[#34C759]">✓ {importResult.imported}件を取り込みました</p>
            {importResult.warnings?.length > 0 && (
              <ul className="mt-1 space-y-0.5">
                {importResult.warnings.map((w, i) => <li key={i} className="text-[11px] text-[#FF9500]">⚠ {w}</li>)}
              </ul>
            )}
          </div>
        )}
        {importResult?.debug && (
          <details className="mt-3">
            <summary className="text-[11px] text-[#007AFF]">デバッグ情報</summary>
            <pre className="mt-2 p-2 rounded-[8px] bg-black/[0.04] text-[10px] text-[#636366] overflow-x-auto whitespace-pre-wrap break-all">
              {JSON.stringify(importResult.debug, null, 2)}
            </pre>
          </details>
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
            {filtered.map(it => {
              const isOpen = expanded === it.symbol_code
              const badge = judgementBadge(it.final_judgement)
              const hasDetail = it.layer1_judgement || it.layer2_status || it.layer2_signal
              return (
                <div key={it.symbol_code}>
                  <button
                    onClick={() => setExpanded(isOpen ? null : it.symbol_code)}
                    className="w-full px-4 py-3 text-left active:bg-black/[0.02] transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[14px] font-semibold text-[#1C1C1E] truncate">
                          {it.symbol_name || '（銘柄名なし）'}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <span className="text-[11px] text-[#AEAEB2] tabular-nums">{it.symbol_code}</span>
                          {it.category && (
                            <span className="text-[11px] font-medium px-1.5 py-0.5 rounded-full bg-[#007AFF]/10 text-[#007AFF]">{it.category}</span>
                          )}
                          {it.sector && <span className="text-[11px] text-[#8E8E93]">{it.sector}</span>}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        {it.latest_price != null && (
                          <p className="text-[15px] font-semibold text-[#1C1C1E] tabular-nums">{numFmt.format(it.latest_price)}円</p>
                        )}
                        {it.dividend_yield != null && (
                          <p className="text-[11px] text-[#8E8E93] tabular-nums">利回り{numFmt.format(it.dividend_yield)}%</p>
                        )}
                      </div>
                    </div>
                    {it.final_judgement && (
                      <p className={`mt-2 inline-block text-[11px] font-semibold px-2 py-1 rounded-full ${badge.bg} ${badge.text}`}>
                        {it.final_judgement}
                      </p>
                    )}
                  </button>
                  {isOpen && hasDetail && (
                    <div className="px-4 pb-3 space-y-1.5 bg-black/[0.02] mx-4 mb-3 rounded-[10px] p-3">
                      {it.layer1_judgement && (
                        <p className="text-[12px] text-[#636366]"><span className="font-semibold text-[#8E8E93]">Layer1</span> {it.layer1_judgement}</p>
                      )}
                      {it.layer2_status && (
                        <p className="text-[12px] text-[#636366]"><span className="font-semibold text-[#8E8E93]">Layer2状況</span> {it.layer2_status}</p>
                      )}
                      {it.layer2_signal && (
                        <p className="text-[12px] text-[#636366]"><span className="font-semibold text-[#8E8E93]">Layer2信号</span> {it.layer2_signal}</p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
