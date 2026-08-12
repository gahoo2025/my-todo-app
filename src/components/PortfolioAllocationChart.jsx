import { useMemo } from 'react'
import { aggregateByCategory } from '../lib/portfolioClassify'

const yen = new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', maximumFractionDigits: 0 })

// 家族の保有銘柄一覧（複数人分をフラットにした配列）から、
// 「個別株 / 投信・日本 / 投信・米国 / 投信・全世界 / 投信・先進国(除く日本) / 投信・新興国」の
// 内訳をドーナツ円グラフ＋凡例で表示する。
export default function PortfolioAllocationChart({ holdings }) {
  const slices = useMemo(() => aggregateByCategory(holdings ?? []), [holdings])

  if (slices.length === 0) {
    return <p className="text-[12px] text-[#AEAEB2] py-6 text-center">内訳を表示できる保有銘柄データがありません</p>
  }

  const r = 15.915 // 円周が100になる半径（stroke-dasharrayをそのままパーセントで指定できる）
  let cumulative = 0
  const arcs = slices.map(s => {
    const dasharray = `${s.pct} ${100 - s.pct}`
    const dashoffset = 25 - cumulative // 12時方向から時計回りに開始
    cumulative += s.pct
    return { ...s, dasharray, dashoffset }
  })

  return (
    <div className="flex flex-col sm:flex-row items-start gap-6 max-w-md">
      <div className="relative w-[160px] h-[160px] flex-shrink-0 mx-auto sm:mx-0">
        <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
          {arcs.map(a => (
            <circle
              key={a.category}
              cx="18" cy="18" r={r}
              fill="none"
              stroke={a.color}
              strokeWidth="5.5"
              strokeDasharray={a.dasharray}
              strokeDashoffset={a.dashoffset}
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[10px] text-[#8E8E93]">投信 / 個別株</span>
          <span className="text-[13px] font-semibold text-[#1C1C1E]">内訳</span>
        </div>
      </div>
      <div className="w-full sm:min-w-0 space-y-2">
        {arcs.map(a => (
          <div key={a.category} className="flex items-center gap-2.5 text-[12px]">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: a.color }} />
            <span className="text-[#1C1C1E] flex-shrink-0">{a.category}</span>
            <span className="flex-1 border-b border-dotted border-black/[0.08] mx-0.5 translate-y-[2px]" />
            <span className="text-[#8E8E93] flex-shrink-0 tabular-nums">{a.pct.toFixed(1)}%</span>
            <span className="text-[#1C1C1E] font-medium flex-shrink-0 tabular-nums w-[88px] text-right">{yen.format(a.amount)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
