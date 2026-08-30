import { useState, useMemo, useEffect } from 'react'
import { niceTicks } from '../lib/chartTicks'
import { fiscalYearOf, computeNetByBillingMonth } from '../lib/journalTotals'

const yen = new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 0 })
// 年度＝4月始まり3月終わりで表示する（分類別年間収支と同じ並び）
const FISCAL_MONTHS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3]
// 比較する過去年度の本数（当年度＋この本数だけ過去に遡る。2026-08-30、本人指示で2年度分）
const COMPARE_YEARS_BACK = 2
const COMPARE_COLORS = ['#007AFF', '#8E8E93']
const BASE_COLOR = '#248A3D'
const POSITIVE_BAR = '#FF9500'
const NEGATIVE_BAR = '#FF3B30'

// 年度（4月始まり）内の「何ヶ月目か」に対応する実際のbilling_month（YYYYMM文字列）を返す
function fiscalMonthCodes(year) {
  return FISCAL_MONTHS.map(m => (m >= 4 ? `${year}${String(m).padStart(2, '0')}` : `${year + 1}${String(m).padStart(2, '0')}`))
}

// 指定年度の、月ごとの実質収支・累計収支のシリーズを作る。
// 実績が無い月（billing_monthのデータが1件も無い月）はnullにし、累計線はそこで止める
// （2026-08-30、本人確認：今後も収支が変わらないという誤解を避けるため、横ばいで
// 伸ばさず線を打ち切る仕様とした）。
function buildYearSeries(netByMonth, year) {
  const codes = fiscalMonthCodes(year)
  const monthly = codes.map(code => (netByMonth.has(code) ? netByMonth.get(code) : null))
  const lastActualIdx = monthly.reduce((last, v, i) => (v != null ? i : last), -1)
  let cum = 0
  const cumulative = monthly.map((v, i) => {
    if (i > lastActualIdx) return null
    cum += v ?? 0
    return cum
  })
  return { year, monthly, cumulative }
}

// 収支推移グラフ：当年度の月ごとの実質収支（棒）と、当年度・過去2年度の累計収支（折れ線）を、
// 年度内の「何ヶ月目か」で揃えて比較表示する（2026-08-30、本人指示により追加）
export default function FiscalYearBalanceChart({ entries, loading }) {
  const [selectedYear, setSelectedYear] = useState(null)

  const availableYears = useMemo(() => {
    const set = new Set(entries.filter(e => e.billing_month).map(e => fiscalYearOf(e.billing_month)))
    return [...set].sort((a, b) => b - a)
  }, [entries])

  useEffect(() => {
    if (availableYears.length === 0) return
    if (selectedYear == null || !availableYears.includes(selectedYear)) {
      setSelectedYear(availableYears[0])
    }
  }, [availableYears, selectedYear])

  const yearIndex = availableYears.indexOf(selectedYear)

  const netByMonth = useMemo(() => computeNetByBillingMonth(entries), [entries])

  const series = useMemo(() => {
    if (selectedYear == null) return null
    const compareYears = []
    for (let i = 1; i <= COMPARE_YEARS_BACK; i++) {
      const y = selectedYear - i
      if (availableYears.includes(y)) compareYears.push(y)
    }
    return {
      base: buildYearSeries(netByMonth, selectedYear),
      compares: compareYears.map(y => buildYearSeries(netByMonth, y)),
    }
  }, [netByMonth, selectedYear, availableYears])

  const chart = useMemo(() => {
    if (!series) return null
    const allValues = [
      ...series.base.monthly.filter(v => v != null),
      ...series.base.cumulative.filter(v => v != null),
      ...series.compares.flatMap(s => s.cumulative.filter(v => v != null)),
      0,
    ]
    const rawMin = Math.min(...allValues)
    const rawMax = Math.max(...allValues)
    const pad = Math.max((rawMax - rawMin) * 0.1, 1)
    const { niceMin, niceMax, ticks } = niceTicks(rawMin - pad, rawMax + pad, 4)
    const lo = niceMin
    const hi = niceMax
    const n = FISCAL_MONTHS.length
    const step = 100 / n
    const toY = v => 100 - ((v - lo) / (hi - lo)) * 100
    const zeroY = toY(0)
    const barCenters = FISCAL_MONTHS.map((_, i) => (i + 0.5) * step)
    const toLinePoints = arr => {
      const segments = []
      let current = []
      arr.forEach((v, i) => {
        if (v == null) {
          if (current.length) segments.push(current)
          current = []
          return
        }
        current.push({ x: barCenters[i], y: toY(v) })
      })
      if (current.length) segments.push(current)
      return segments
    }
    return {
      lo, hi, zeroY,
      yTicks: ticks.filter(t => t >= lo && t <= hi),
      barCenters,
      barWidth: step * 0.55,
      baseCumSegments: toLinePoints(series.base.cumulative),
      compareCumSegments: series.compares.map(s => toLinePoints(s.cumulative)),
      toY,
    }
  }, [series])

  if (loading) {
    return <p className="px-4 py-6 text-center text-[13px] text-[#AEAEB2]">読み込み中…</p>
  }
  if (availableYears.length === 0) {
    return <p className="px-4 py-6 text-center text-[13px] text-[#AEAEB2]">仕訳結果のデータがまだありません</p>
  }

  return (
    <div className="space-y-3">
      {/* ── 年選択 ── */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setSelectedYear(availableYears[yearIndex + 1])}
          disabled={yearIndex >= availableYears.length - 1}
          className="ios-icon-btn text-[#007AFF] disabled:opacity-30 disabled:pointer-events-none"
          aria-label="前の年"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <select
          value={selectedYear ?? ''}
          onChange={e => setSelectedYear(Number(e.target.value))}
          className="flex-1 text-center px-3 py-2 rounded-[10px] bg-white text-[15px] font-semibold text-[#1C1C1E] shadow-[0_1px_2px_rgba(0,0,0,0.06)] focus:outline-none"
        >
          {availableYears.map(y => (
            <option key={y} value={y}>{y}年度（{y}年4月〜{y + 1}年3月）</option>
          ))}
        </select>
        <button
          onClick={() => setSelectedYear(availableYears[yearIndex - 1])}
          disabled={yearIndex <= 0}
          className="ios-icon-btn text-[#007AFF] disabled:opacity-30 disabled:pointer-events-none"
          aria-label="次の年"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {series && chart && (
        <div className="ios-card p-4">
          <p className="text-[13px] font-semibold text-[#1C1C1E] mb-3">収支</p>

          {/* ── 凡例 ── */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mb-3 text-[10px] text-[#8E8E93]">
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-[2px]" style={{ backgroundColor: POSITIVE_BAR }} />
              <span>月ごと（{selectedYear}年度）</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-3 h-0.5" style={{ backgroundColor: BASE_COLOR }} />
              <span>累計（{selectedYear}年度）</span>
            </div>
            {series.compares.map((s, i) => (
              <div key={s.year} className="flex items-center gap-1">
                <span className="w-3 h-0.5 border-t border-dashed" style={{ borderColor: COMPARE_COLORS[i % COMPARE_COLORS.length] }} />
                <span>{s.year}年度</span>
              </div>
            ))}
          </div>

          {/* ── グラフ本体 ── */}
          <div className="relative h-[220px] md:pl-16">
            <div className="hidden md:block absolute left-0 top-0 bottom-0 w-14 text-[10px] text-[#8E8E93] text-right pr-2">
              {chart.yTicks.map(t => (
                <span key={t} className="absolute right-2 -translate-y-1/2" style={{ top: `${chart.toY(t)}%` }}>
                  {yen.format(t)}
                </span>
              ))}
            </div>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full overflow-visible">
              {chart.yTicks.map(t => (
                <line
                  key={t}
                  x1="0" y1={chart.toY(t)} x2="100" y2={chart.toY(t)}
                  stroke="#8E8E93" strokeOpacity={t === 0 ? 0.5 : 0.2} strokeWidth="1"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
              {/* 月ごとの棒（当年度のみ。黒字＝オレンジ、赤字＝赤） */}
              {series.base.monthly.map((v, i) => {
                if (v == null) return null
                const y0 = chart.zeroY
                const y1 = chart.toY(v)
                const top = Math.min(y0, y1)
                const height = Math.max(Math.abs(y1 - y0), 0.5)
                return (
                  <rect
                    key={i}
                    x={chart.barCenters[i] - chart.barWidth / 2}
                    y={top}
                    width={chart.barWidth}
                    height={height}
                    fill={v >= 0 ? POSITIVE_BAR : NEGATIVE_BAR}
                  >
                    <title>{`${FISCAL_MONTHS[i]}月：${yen.format(v)}`}</title>
                  </rect>
                )
              })}
              {/* 比較年度の累計（点線） */}
              {chart.compareCumSegments.map((segments, si) =>
                segments.map((seg, pi) => (
                  <polyline
                    key={`${si}-${pi}`}
                    fill="none"
                    stroke={COMPARE_COLORS[si % COMPARE_COLORS.length]}
                    strokeWidth="1.2"
                    strokeDasharray="4 3"
                    vectorEffect="non-scaling-stroke"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={seg.map(p => `${p.x},${p.y}`).join(' ')}
                  />
                ))
              )}
              {/* 当年度の累計（実線・最前面） */}
              {chart.baseCumSegments.map((seg, i) => (
                <polyline
                  key={i}
                  fill="none"
                  stroke={BASE_COLOR}
                  strokeWidth="1.6"
                  vectorEffect="non-scaling-stroke"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={seg.map(p => `${p.x},${p.y}`).join(' ')}
                />
              ))}
            </svg>
            <div className="absolute left-0 md:left-16 right-0 -bottom-5 flex text-[10px] text-[#8E8E93]">
              {FISCAL_MONTHS.map((m, i) => (
                <span key={m} className="flex-1 text-center">{m}月</span>
              ))}
            </div>
          </div>

          {/* ── 数値テーブル ── */}
          <div className="overflow-x-auto mt-7">
            <table className="min-w-full text-[11px] tabular-nums">
              <thead>
                <tr>
                  <th className="sticky left-0 bg-white text-left font-medium text-[#8E8E93] px-2 py-1.5 whitespace-nowrap"></th>
                  {fiscalMonthCodes(selectedYear).map(code => (
                    <th key={code} className="text-right font-medium text-[#8E8E93] px-2 py-1.5 whitespace-nowrap">{code}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-black/[0.06]">
                  <td className="sticky left-0 bg-white text-left font-medium text-[#1C1C1E] px-2 py-1.5 whitespace-nowrap">月ごと</td>
                  {series.base.monthly.map((v, i) => (
                    <td key={i} className="text-right text-[#1C1C1E] px-2 py-1.5 whitespace-nowrap">{v == null ? '－' : yen.format(v)}</td>
                  ))}
                </tr>
                <tr className="border-t border-black/[0.06] bg-black/[0.02]">
                  <td className="sticky left-0 bg-[#FAFAFA] text-left font-semibold text-[#1C1C1E] px-2 py-1.5 whitespace-nowrap">累計</td>
                  {series.base.cumulative.map((v, i) => (
                    <td key={i} className="text-right font-semibold text-[#1C1C1E] px-2 py-1.5 whitespace-nowrap">{v == null ? '－' : yen.format(v)}</td>
                  ))}
                </tr>
                {series.compares.map(s => (
                  <tr key={s.year} className="border-t border-black/[0.06]">
                    <td className="sticky left-0 bg-white text-left text-[#8E8E93] px-2 py-1.5 whitespace-nowrap">{s.year}年度</td>
                    {s.cumulative.map((v, i) => (
                      <td key={i} className="text-right text-[#8E8E93] px-2 py-1.5 whitespace-nowrap">{v == null ? '－' : yen.format(v)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
