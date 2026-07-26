import { useAuth } from '../hooks/useAuth'
import { useMarketIndices, INDEX_SYMBOLS } from '../hooks/useMarketIndices'

function formatDate(s) {
  if (!s) return ''
  const [y, m, d] = s.split('-')
  return `${y}/${Number(m)}/${Number(d)}`
}

const numFmt = new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 2 })

export default function MarketIndexData() {
  const { user } = useAuth()
  const { latestBySymbol, counts, loading, importing, importResult, importFromSheet } = useMarketIndices(user?.id)

  return (
    <div className="space-y-3">
      <div className="ios-card px-4 py-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[15px] font-semibold text-[#1C1C1E]">指標データの取り込み</p>
            <p className="text-[12px] text-[#8E8E93] mt-0.5">Googleスプレッドシートから過去データを取り込みます</p>
          </div>
          <button
            onClick={importFromSheet}
            disabled={importing}
            className="flex-shrink-0 px-4 py-2.5 rounded-[10px] bg-[#007AFF] text-white text-[14px] font-semibold disabled:opacity-40 active:opacity-70 transition-opacity"
          >
            {importing ? '取り込み中…' : '取り込む'}
          </button>
        </div>

        {importResult?.error && (
          <p className="mt-3 text-[12px] text-[#FF3B30]">⚠ {importResult.error}</p>
        )}
        {importResult?.success && (
          <p className="mt-3 text-[12px] text-[#34C759]">
            ✓ {importResult.inserted}件のデータを取り込みました
          </p>
        )}
      </div>

      <div className="ios-card overflow-hidden">
        <div className="px-4 pt-3 pb-1">
          <p className="text-[12px] font-semibold text-[#8E8E93]">最新値</p>
        </div>
        {loading ? (
          <p className="px-4 py-6 text-center text-[13px] text-[#AEAEB2]">読み込み中…</p>
        ) : (
          <div className="divide-y divide-black/[0.04]">
            {INDEX_SYMBOLS.map(({ id, label }) => {
              const latest = latestBySymbol[id]
              const count = counts[id] ?? 0
              return (
                <div key={id} className="flex items-center justify-between px-4 py-2.5">
                  <div>
                    <p className="text-[14px] font-medium text-[#1C1C1E]">{label}</p>
                    {count > 0 && <p className="text-[11px] text-[#AEAEB2]">{count}件保存済み</p>}
                  </div>
                  <div className="text-right">
                    {latest ? (
                      <>
                        <p className="text-[15px] font-semibold text-[#1C1C1E] tabular-nums">{numFmt.format(Number(latest.value))}</p>
                        <p className="text-[11px] text-[#AEAEB2]">{formatDate(latest.trade_date)}</p>
                      </>
                    ) : (
                      <p className="text-[13px] text-[#AEAEB2]">未取り込み</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
