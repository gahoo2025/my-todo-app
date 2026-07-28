import { useAuth } from '../hooks/useAuth'
import { useAssetTotalsSummary } from '../hooks/useAssetTotalsSummary'
import { useState } from 'react'
import MarketLogSection from '../components/MarketLog'
import WatchStocksSection from '../components/WatchStocks'
import MarketIndexData from '../components/MarketIndexData'
import AssetHoldingsImport from '../components/AssetHoldingsImport'

// サブ機能の定義（今後ここに追加していく）
// 資産管理（資産情報・家計情報）と投資管理（投資情報・監視銘柄・指標データ蓄積）の
// うち、投資管理のサブ機能をここに並べる
const SUB_FEATURES = [
  { id: 'marketlog', label: 'マーケットログ' },
  { id: 'watch',     label: '監視銘柄' },
  { id: 'indices',   label: '指標データ' },
]

const yen = new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', maximumFractionDigits: 0 })

function formatDate(s) {
  if (!s) return ''
  const [y, m, d] = s.split('-').map(Number)
  return `${y}/${m}/${d}`
}

// ── 家族の資産集計（資産ファイルの取り込みデータから集計） ──
function FamilyAssetSummary() {
  const { user } = useAuth()
  const { byPersonBroker, total, latestDate, loading, refetch } = useAssetTotalsSummary(user?.id)

  if (loading) return null

  const PERSON_ORDER = ['パパ', 'ママ', '長女', '次女', '長男']
  const entries = Object.entries(byPersonBroker)
    .map(([person, brokers]) => [person, Object.values(brokers).reduce((s, v) => s + v, 0), brokers])
    .filter(([, amount]) => amount > 0)
    .sort((a, b) => {
      const ia = PERSON_ORDER.indexOf(a[0])
      const ib = PERSON_ORDER.indexOf(b[0])
      if (ia === -1 && ib === -1) return 0
      if (ia === -1) return 1
      if (ib === -1) return -1
      return ia - ib
    })

  return (
    <div className="ios-card overflow-hidden mb-3">
      <div className="px-4 pt-3.5 pb-2.5 border-b border-black/[0.05] flex items-start justify-between">
        <div>
          <p className="text-[12px] font-semibold text-[#8E8E93]">家族の純資産合計</p>
          <p className="text-[28px] font-bold text-[#1C1C1E] leading-tight mt-0.5 tabular-nums">
            {entries.length > 0 ? yen.format(total) : '—'}
          </p>
          {latestDate && <p className="text-[11px] text-[#AEAEB2] mt-1">{formatDate(latestDate)} 時点</p>}
        </div>
        <button
          onClick={refetch}
          className="text-[12px] font-medium text-[#007AFF] px-2 py-1 -mr-2 active:opacity-50"
        >
          更新
        </button>
      </div>
      {entries.length > 0 ? (
        <div className="divide-y divide-black/[0.04]">
          {entries.map(([name, amount, brokers]) => {
            const breakdown = Object.entries(brokers).filter(([, v]) => v > 0)
            return (
              <div key={name} className="px-4 py-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[15px] font-medium text-[#1C1C1E]">{name}</span>
                  <div className="text-right">
                    <p className="text-[15px] font-semibold text-[#1C1C1E] tabular-nums">{yen.format(amount)}</p>
                    <p className="text-[11px] text-[#AEAEB2]">{total > 0 ? ((amount / total) * 100).toFixed(0) : 0}%</p>
                  </div>
                </div>
                {breakdown.length > 1 && (
                  <div className="mt-1.5 space-y-1 border-l-2 border-black/[0.06] pl-3">
                    {breakdown.map(([broker, brokerAmount]) => (
                      <div key={broker} className="flex items-center justify-between">
                        <span className="text-[12px] text-[#8E8E93]">{broker}証券</span>
                        <span className="text-[12px] text-[#8E8E93] tabular-nums">{yen.format(brokerAmount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <p className="px-4 py-3 text-[12px] text-[#AEAEB2]">
          下の「資産ファイルの取り込み」から取り込むと、ここに家族の資産集計が表示されます。
        </p>
      )}
    </div>
  )
}

export default function AssetsPage({ embedded }) {
  const [sub, setSub] = useState('marketlog')

  const body = (
    <>
      {/* 家族の資産集計（資産管理アプリからの連携） */}
      <FamilyAssetSummary />

      {/* 資産管理アプリのCSVファイル取り込み */}
      <AssetHoldingsImport />

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
        {sub === 'marketlog' && <MarketLogSection />}
        {sub === 'watch' && <WatchStocksSection />}
        {sub === 'indices' && <MarketIndexData />}
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
