const yen = new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', maximumFractionDigits: 0 })

// 年別の総資産（証券+現金+保険）推移を棒グラフで表示する
export default function AssetYearlyTotalChart({ yearly }) {
  if (!yearly || yearly.length === 0) {
    return <p className="text-[12px] text-[#AEAEB2] py-6 text-center">年別の資産データがありません</p>
  }

  const max = Math.max(...yearly.map(y => y.total), 1)
  const first = yearly[0]
  const last = yearly[yearly.length - 1]

  return (
    <div>
      <div className="flex items-end gap-1.5 md:gap-2.5 h-[160px] md:h-[220px] overflow-x-auto">
        {yearly.map(y => {
          const heightPct = (y.total / max) * 100
          return (
            <div key={y.year} className="flex-1 min-w-[20px] flex flex-col items-center justify-end h-full">
              <span className="text-[9px] text-[#AEAEB2] mb-1 whitespace-nowrap tabular-nums">
                {(y.total / 10000).toFixed(0)}万
              </span>
              <div
                className="w-full max-w-[28px] rounded-t-[4px] bg-[#007AFF]"
                style={{ height: `${Math.max(heightPct, 2)}%` }}
                title={`${y.year}年（${y.as_of}時点）：${yen.format(y.total)}`}
              />
              <span className="text-[10px] text-[#8E8E93] mt-1.5">{y.year.slice(2)}</span>
            </div>
          )
        })}
      </div>
      <div className="flex items-center justify-between mt-3 text-[11px] text-[#AEAEB2]">
        <span>{first.year}年：{yen.format(first.total)}</span>
        <span>{last.year}年：{yen.format(last.total)}</span>
      </div>
    </div>
  )
}
