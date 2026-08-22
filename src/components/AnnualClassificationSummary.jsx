import { useState, useMemo, useEffect } from 'react'

const yen = new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 0 })
const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

function PivotTable({ title, rows, months, totalsByMonth, grandTotal, accentClass }) {
  if (rows.length === 0) return null
  return (
    <div className="ios-card p-0 overflow-hidden">
      <p className="px-4 pt-3.5 pb-2 text-[13px] font-semibold text-[#1C1C1E]">{title}</p>
      <div className="overflow-x-auto">
        <table className="min-w-full text-[12px] tabular-nums">
          <thead>
            <tr className="border-t border-black/[0.05]">
              <th className="sticky left-0 bg-white text-left font-medium text-[#8E8E93] px-3 py-2 whitespace-nowrap">取引先</th>
              {months.map(m => (
                <th key={m} className="text-right font-medium text-[#8E8E93] px-2 py-2 whitespace-nowrap">{m}月</th>
              ))}
              <th className="text-right font-semibold text-[#1C1C1E] px-3 py-2 whitespace-nowrap">年合計</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.institution} className="border-t border-black/[0.04]">
                <td className="sticky left-0 bg-white text-left text-[#1C1C1E] px-3 py-2 whitespace-nowrap">{row.institution}</td>
                {months.map(m => (
                  <td key={m} className="text-right text-[#1C1C1E] px-2 py-2 whitespace-nowrap">
                    {row.byMonth[m] ? yen.format(row.byMonth[m]) : '—'}
                  </td>
                ))}
                <td className={`text-right font-semibold px-3 py-2 whitespace-nowrap ${accentClass}`}>{yen.format(row.total)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-black/[0.08]">
              <td className="sticky left-0 bg-white text-left font-semibold text-[#1C1C1E] px-3 py-2.5 whitespace-nowrap">合計</td>
              {months.map(m => (
                <td key={m} className="text-right font-semibold text-[#1C1C1E] px-2 py-2.5 whitespace-nowrap">
                  {totalsByMonth[m] ? yen.format(totalsByMonth[m]) : '—'}
                </td>
              ))}
              <td className={`text-right font-bold px-3 py-2.5 whitespace-nowrap ${accentClass}`}>{yen.format(grandTotal)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

// 取引先別・月別の年間収支：選んだ年の1年分を、取引先（行）×月（列）のピボット表で出金/入金それぞれ表示する
export default function AnnualClassificationSummary({ entries, loading }) {
  const [selectedYear, setSelectedYear] = useState(null)

  const availableYears = useMemo(() => {
    const set = new Set(entries.map(e => e.billing_month?.slice(0, 4)).filter(Boolean))
    return [...set].sort((a, b) => b.localeCompare(a))
  }, [entries])

  useEffect(() => {
    if (availableYears.length === 0) return
    if (!selectedYear || !availableYears.includes(selectedYear)) {
      setSelectedYear(availableYears[0])
    }
  }, [availableYears, selectedYear])

  const yearIndex = availableYears.indexOf(selectedYear)

  // (方向) -> 取引先 -> 月 -> 合計金額 に集計
  const pivot = useMemo(() => {
    const build = direction => {
      const byInstitution = new Map()
      for (const e of entries) {
        if (e.direction !== direction) continue
        if (!selectedYear || e.billing_month?.slice(0, 4) !== selectedYear) continue
        const month = Number(e.billing_month.slice(4, 6))
        const inst = e.institution
        if (!byInstitution.has(inst)) byInstitution.set(inst, { institution: inst, byMonth: {}, total: 0 })
        const row = byInstitution.get(inst)
        const amount = Number(e.amount) || 0
        row.byMonth[month] = (row.byMonth[month] || 0) + amount
        row.total += amount
      }
      const rows = [...byInstitution.values()].sort((a, b) => b.total - a.total)
      const totalsByMonth = {}
      let grandTotal = 0
      for (const row of rows) {
        for (const m of MONTHS) {
          if (row.byMonth[m]) totalsByMonth[m] = (totalsByMonth[m] || 0) + row.byMonth[m]
        }
        grandTotal += row.total
      }
      return { rows, totalsByMonth, grandTotal }
    }
    return { out: build('出金'), inn: build('入金') }
  }, [entries, selectedYear])

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
          onChange={e => setSelectedYear(e.target.value)}
          className="flex-1 text-center px-3 py-2 rounded-[10px] bg-white text-[15px] font-semibold text-[#1C1C1E] shadow-[0_1px_2px_rgba(0,0,0,0.06)] focus:outline-none"
        >
          {availableYears.map(y => (
            <option key={y} value={y}>{y}年</option>
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

      <PivotTable
        title="支出（取引先別・月別）"
        rows={pivot.out.rows}
        months={MONTHS}
        totalsByMonth={pivot.out.totalsByMonth}
        grandTotal={pivot.out.grandTotal}
        accentClass="text-[#1C1C1E]"
      />
      <PivotTable
        title="収入（取引先別・月別）"
        rows={pivot.inn.rows}
        months={MONTHS}
        totalsByMonth={pivot.inn.totalsByMonth}
        grandTotal={pivot.inn.grandTotal}
        accentClass="text-[#248A3D]"
      />
    </div>
  )
}
