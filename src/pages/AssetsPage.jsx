import { useState } from 'react'
import MarketLogSection from '../components/MarketLog'
import WatchStocksSection from '../components/WatchStocks'

// サブ機能の定義（今後ここに追加していく）
const SUB_FEATURES = [
  { id: 'marketlog', label: 'マーケットログ' },
  { id: 'watch',     label: '監視銘柄' },
]

export default function AssetsPage({ embedded }) {
  const [sub, setSub] = useState('marketlog')

  const body = (
    <>
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
