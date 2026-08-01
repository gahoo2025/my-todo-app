import { useState, useMemo } from 'react'

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土']

function formatDate(s) {
  if (!s) return ''
  const [y, m, d] = s.split('-').map(Number)
  const wd = WEEKDAY_LABELS[new Date(y, m - 1, d).getDay()]
  return `${y}/${m}/${d}(${wd})`
}

const yen = new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', maximumFractionDigits: 0 })

const PERIODS = [
  { id: '3m',  label: '3か月',  days: 90 },
  { id: '6m',  label: '6か月',  days: 180 },
  { id: '1y',  label: '1年',    days: 365 },
  { id: 'all', label: '全期間', days: null },
]

function filterLastNDays(points, days) {
  if (!points.length || days == null) return points
  const lastDate = new Date(points[points.length - 1].trade_date)
  const cutoff = new Date(lastDate)
  cutoff.setDate(cutoff.getDate() - days)
  return points.filter(p => new Date(p.trade_date) >= cutoff)
}

// 資産推移の折れ線グラフ（人物・家族合計どちらにも使う汎用コンポーネント）
export default function AssetHistoryChart({ points }) {
  const [periodId, setPeriodId] = useState('all')
  const period = PERIODS.find(p => p.id === periodId)
  const filtered = useMemo(() => filterLastNDays(points, period.days), [points, period.days])

  const chart = useMemo(() => {
    if (filtered.length < 2) return null
    let min = Infinity
    let max = -Infinity
    for (const p of filtered) {
      const v = Number(p.value)
      if (v < min) min = v
      if (v > max) max = v
    }
    const pad = Math.max((max - min) * 0.08, 1)
    const lo = min - pad
    const hi = max + pad
    const w = 100
    const h = 100
    const step = w / (filtered.length - 1)
    const toY = v => h - ((v - lo) / (hi - lo)) * h
    const linePoints = filtered.map((p, i) => ({ x: i * step, y: toY(Number(p.value)) }))
    return { linePoints, lo, hi }
  }, [filtered])

  // PC表示時のみ縦軸(金額)・横軸(日付)の目盛りを出す
  const xTicks = useMemo(() => {
    if (filtered.length < 2) return []
    const n = Math.min(6, filtered.length)
    const idx = Array.from({ length: n }, (_, i) => Math.round((i * (filtered.length - 1)) / (n - 1)))
    return [...new Set(idx)].map(i => ({ pct: (i / (filtered.length - 1)) * 100, date: filtered[i].trade_date }))
  }, [filtered])

  return (
    <div>
      <div className="flex gap-1.5 mb-2">
        {PERIODS.map(p => (
          <button
            key={p.id}
            onClick={() => setPeriodId(p.id)}
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
              periodId === p.id ? 'bg-[#1C1C1E] text-white' : 'bg-black/[0.04] text-[#8E8E93]'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      {chart ? (
        <>
          <div className="relative h-[140px] md:h-[300px] md:pl-16 md:pb-5">
            {/* 縦軸（PCのみ） */}
            <div className="hidden md:flex flex-col justify-between absolute left-0 top-0 bottom-5 w-14 text-[10px] text-[#8E8E93] text-right pr-2">
              <span>{yen.format(chart.hi)}</span>
              <span>{yen.format((chart.hi + chart.lo) / 2)}</span>
              <span>{yen.format(chart.lo)}</span>
            </div>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full overflow-visible">
              <polyline
                fill="none"
                stroke="#007AFF"
                strokeWidth="1.3"
                vectorEffect="non-scaling-stroke"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={chart.linePoints.map(c => `${c.x},${c.y}`).join(' ')}
              />
            </svg>
            {/* 横軸（PCのみ） */}
            <div className="hidden md:block absolute left-16 right-0 bottom-0 h-5 text-[10px] text-[#8E8E93]">
              {xTicks.map(t => (
                <span key={t.date} className="absolute -translate-x-1/2 top-0" style={{ left: `${t.pct}%` }}>
                  {formatDate(t.date)}
                </span>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between mt-2 text-[11px] text-[#AEAEB2]">
            <span>{formatDate(filtered[0].trade_date)}・{yen.format(Number(filtered[0].value))}</span>
            <span>{formatDate(filtered[filtered.length - 1].trade_date)}・{yen.format(Number(filtered[filtered.length - 1].value))}</span>
          </div>
        </>
      ) : (
        <p className="text-[13px] text-[#AEAEB2] py-6 text-center">この期間はデータが2件以上ありません</p>
      )}
    </div>
  )
}
