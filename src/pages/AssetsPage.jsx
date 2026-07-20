import { useAuth } from '../hooks/useAuth'
import { useFamilyAssetSummary } from '../hooks/useFamilyAssetSummary'
import { useState } from 'react'
import MarketLogSection from '../components/MarketLog'
import WatchStocksSection from '../components/WatchStocks'

// サブ機能の定義（今後ここに追加していく）
const SUB_FEATURES = [
  { id: 'marketlog', label: 'マーケットログ' },
  { id: 'watch',     label: '監視銘柄' },
]

const yen = new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', maximumFractionDigits: 0 })

function formatDateTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// ── 家族の資産集計（資産管理アプリからの連携） ──
function FamilyAssetSummary() {
  const { user } = useAuth()
  const { summary, loading, refetch } = useFamilyAssetSummary(user?.id)

  if (loading) return null

  const entries = summary ? Object.entries(summary.by_person ?? {}).filter(([, v]) => Number(v) > 0) : []
  const total = summary ? Number(summary.total) : 0

  return (
    <div className="ios-card overflow-hidden mb-3">
      <div className="px-4 pt-3.5 pb-2.5 border-b border-black/[0.05] flex items-start justify-between">
        <div>
          <p className="text-[12px] font-semibold text-[#8E8E93]">家族の純資産合計</p>
          <p className="text-[28px] font-bold text-[#1C1C1E] leading-tight mt-0.5 tabular-nums">
            {summary ? yen.format(total) : '—'}
          </p>
          {summary && <p className="text-[11px] text-[#AEAEB2] mt-1">{formatDateTime(summary.updated_at)} 時点</p>}
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
          {entries.map(([name, amount]) => (
            <div key={name} className="flex items-center justify-between px-4 py-2.5">
              <span className="text-[15px] font-medium text-[#1C1C1E]">{name}</span>
              <div className="text-right">
                <p className="text-[15px] font-semibold text-[#1C1C1E] tabular-nums">{yen.format(Number(amount))}</p>
                <p className="text-[11px] text-[#AEAEB2]">{total > 0 ? ((Number(amount) / total) * 100).toFixed(0) : 0}%</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="px-4 py-3 text-[12px] text-[#AEAEB2]">
          資産管理アプリから「連携を実行」すると、ここに家族の資産集計が表示されます。
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
