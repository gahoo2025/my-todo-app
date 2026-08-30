import { useState, useMemo, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { JOURNAL_INSTITUTIONS } from '../hooks/useJournalEntries'
import { useJournalClassificationMap } from '../hooks/useJournalClassificationMap'
import { fiscalYearOf, isCardSettlementDup, isTransfer } from '../lib/journalTotals'

const yen = new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 0 })
// 年度＝4月始まり3月終わりで表示する
const FISCAL_MONTHS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3]
const UNCLASSIFIED = '（未分類）'
const UNMAPPED = '（未対応）'

// カード引き落とし二重計上の判定（src/lib/journalTotals.jsに共通化）の扱いは、
// 分類レベルによって変える（2026-08-30、本人指示）：
//   分類１ … 二重計上の明細行そのもの（横浜VISA・住友VISA・楽天カードえみ）は
//            分類１の値そのままなので、行として表示はするがグレー表示＋
//            「合計に含まず」の注記を付け、合計には含めない（監査用に見えるようにする）。
//   分類２／３ … 複数の分類１が同じ「－」等の1つのラベルに集約されるため、二重計上分を
//            行に含めると「一部だけ合計に含まれない」という分かりにくい表示になる
//            （実例：分類２「－」の中に、ATM・現金出金等の正当な「－」と、二重計上の
//            カード引き落とし行が混在してしまっていた）。そのため分類２／３では、
//            二重計上分は集計対象（行にも合計にも）に一切含めない。
// 「合計（移動を除く）」用の口座間移動の除外は、分類別年間収支と収支推移グラフ
// （FiscalYearBalanceChart）で数値が食い違わないよう、判定ロジック自体は
// src/lib/journalTotals.js に共通化してある。判定は必ず「変換前の生の分類１の値」に
// 対して行う（resolveClassificationで分類２／３に変換した後の値では判定しない。
// 理由はjournalTotals.js内のコメント参照）。

const LEVELS = [
  { id: '1', label: '分類１' },
  { id: '2', label: '分類２' },
  { id: '3', label: '分類３' },
]

// レベル１のときは分類１をそのまま返す（現行ロジックと完全に同じ結果になる恒等変換）。
// レベル２／３のときは journal_classification_map で分類１→分類２／３に変換する。
// マッピングが無い場合は「（未対応）」として可視化する。
function resolveClassification(level, institution, classification1, classificationMap) {
  if (level === '1') return classification1
  const entry = classificationMap.get(`${institution}|${classification1}`)
  if (!entry) return UNMAPPED
  return level === '2' ? entry.classification_2 : entry.classification_3
}

function PivotTable({ title, rows, months, totalsByMonth, grandTotal, totalsByMonthExclTransfer, grandTotalExclTransfer, accentClass, showExcludedStyle }) {
  if (rows.length === 0) return null
  return (
    <div className="ios-card p-0 overflow-hidden">
      <p className="px-4 pt-3.5 pb-2 text-[13px] font-semibold text-[#1C1C1E]">{title}</p>
      <div className="overflow-x-auto">
        <table className="min-w-full text-[12px] tabular-nums">
          <thead>
            <tr className="border-t border-black/[0.05]">
              <th className="sticky left-0 bg-white text-left font-medium text-[#8E8E93] px-3 py-2 whitespace-nowrap">分類</th>
              <th className="text-right font-semibold text-[#1C1C1E] px-3 py-2 whitespace-nowrap">年合計</th>
              {months.map(m => (
                <th key={m} className="text-right font-medium text-[#8E8E93] px-2 py-2 whitespace-nowrap">{m}月</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-black/[0.08] bg-black/[0.02]">
              <td className="sticky left-0 bg-[#FAFAFA] text-left font-semibold text-[#1C1C1E] px-3 py-2.5 whitespace-nowrap">合計</td>
              <td className={`text-right font-bold px-3 py-2.5 whitespace-nowrap ${accentClass}`}>{yen.format(grandTotal)}</td>
              {months.map(m => (
                <td key={m} className="text-right font-semibold text-[#1C1C1E] px-2 py-2.5 whitespace-nowrap">
                  {totalsByMonth[m] ? yen.format(totalsByMonth[m]) : '—'}
                </td>
              ))}
            </tr>
            <tr className="border-t border-black/[0.08] bg-black/[0.02]">
              <td className="sticky left-0 bg-[#FAFAFA] text-left font-semibold text-[#1C1C1E] px-3 py-2.5 whitespace-nowrap">合計（移動を除く）</td>
              <td className={`text-right font-bold px-3 py-2.5 whitespace-nowrap ${accentClass}`}>{yen.format(grandTotalExclTransfer)}</td>
              {months.map(m => (
                <td key={m} className="text-right font-semibold text-[#1C1C1E] px-2 py-2.5 whitespace-nowrap">
                  {totalsByMonthExclTransfer[m] ? yen.format(totalsByMonthExclTransfer[m]) : '—'}
                </td>
              ))}
            </tr>
            {rows.map(row => {
              // excludedTotalは分類１表示のときだけ入る（分類２／３では二重計上分は
              // そもそも行の集計に含めていない。build()参照）。ある分類名の行が、複数の
              // 取引先にまたがって存在する場合、そのうち一部の取引先分だけが二重計上の
              // 対象ということがあり得る（CARD_SETTLEMENT_PAIRS参照。2026-08-30、
              // 「楽天カード」問題を機に「楽天カードえみ」に改名したため現在該当ケースは
              // 無いが、同様のことが今後起こり得るため仕組みは残してある）。そのため
              // 行単位では「全額除外」「一部除外」「除外なし」の3通りを区別して表示する。
              const fullyExcluded = showExcludedStyle && row.excludedTotal > 0 && row.excludedTotal === row.total
              const partiallyExcluded = showExcludedStyle && row.excludedTotal > 0 && row.excludedTotal < row.total
              return (
                <tr key={row.classification} className="border-t border-black/[0.04]">
                  <td className={`sticky left-0 bg-white text-left px-3 py-2 whitespace-nowrap ${fullyExcluded ? 'text-[#AEAEB2]' : 'text-[#1C1C1E]'}`}>
                    {row.classification}
                    {fullyExcluded && <span className="ml-1 text-[10px]">（合計に含まず）</span>}
                    {partiallyExcluded && (
                      <span className="ml-1 text-[10px] text-[#AEAEB2]">（うち{yen.format(row.excludedTotal)}円は合計に含まず）</span>
                    )}
                  </td>
                  <td className={`text-right px-3 py-2 whitespace-nowrap ${fullyExcluded ? 'text-[#AEAEB2]' : `font-semibold ${accentClass}`}`}>
                    {yen.format(row.total)}
                  </td>
                  {months.map(m => (
                    <td key={m} className={`text-right px-2 py-2 whitespace-nowrap ${fullyExcluded ? 'text-[#C7C7CC]' : 'text-[#1C1C1E]'}`}>
                      {row.byMonth[m] ? yen.format(row.byMonth[m]) : '—'}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// 分類別・月別の年間収支：選んだ年・取引先の範囲を、分類（行）×月（列）のピボット表で出金/入金それぞれ表示する
export default function AnnualClassificationSummary({ entries, loading }) {
  const { user } = useAuth()
  const { map: classificationMap, loading: mapLoading } = useJournalClassificationMap(user?.id)
  const [selectedYear, setSelectedYear] = useState(null)
  const [institution, setInstitution] = useState('all')
  const [level, setLevel] = useState('1')

  const availableYears = useMemo(() => {
    const set = new Set(entries.filter(e => e.billing_month).map(e => fiscalYearOf(e.billing_month)))
    return [...set].sort((a, b) => b - a).map(String)
  }, [entries])

  useEffect(() => {
    if (availableYears.length === 0) return
    if (!selectedYear || !availableYears.includes(selectedYear)) {
      setSelectedYear(availableYears[0])
    }
  }, [availableYears, selectedYear])

  const yearIndex = availableYears.indexOf(selectedYear)

  // (方向) -> 分類 -> 月 -> 合計金額 に集計（取引先で絞り込んだ範囲内で）
  const pivot = useMemo(() => {
    const build = direction => {
      const byClassification = new Map()
      const totalsByMonth = {}
      const totalsByMonthExclTransfer = {}
      let grandTotal = 0
      let grandTotalExclTransfer = 0
      for (const e of entries) {
        if (e.direction !== direction) continue
        if (!e.billing_month || !selectedYear || String(fiscalYearOf(e.billing_month)) !== selectedYear) continue
        if (institution !== 'all' && e.institution !== institution) continue
        const rawCls = e.classification
        // 「合計」「合計（移動を除く）」は、表示レベルに関わらず常に変換前の生の分類１で、
        // かつ必ず取引先とセットで判定する（分類２／３では複数の分類１が同じ「－」に
        // 集約されるため、変換後の値だけでは判定できない。分類名だけでも判定できない
        // ことは上記CARD_SETTLEMENT_PAIRSのコメントの通り）
        // 特定の1取引先に絞り込んでいるときは二重計上が起きないため除外しない
        const isDup = isCardSettlementDup(e.institution, rawCls, institution)
        // 分類２／３では、二重計上の明細行は集計対象（行・合計とも）に一切含めない
        // （分類１でだけ行として表示し、監査できるようにする。上記コメント参照）
        if (isDup && level !== '1') continue
        const month = Number(e.billing_month.slice(4, 6))
        const cls = (rawCls && resolveClassification(level, e.institution, rawCls, classificationMap)) || UNCLASSIFIED
        if (!byClassification.has(cls)) {
          byClassification.set(cls, { classification: cls, byMonth: {}, total: 0, excludedTotal: 0 })
        }
        const row = byClassification.get(cls)
        const amount = Number(e.amount) || 0
        row.byMonth[month] = (row.byMonth[month] || 0) + amount
        row.total += amount

        if (isDup) {
          row.excludedTotal += amount
          continue
        }
        totalsByMonth[month] = (totalsByMonth[month] || 0) + amount
        grandTotal += amount
        // 移動（出金）／移動（入金）は取引先の絞り込みに関わらず常に除く
        if (isTransfer(direction, rawCls)) continue
        totalsByMonthExclTransfer[month] = (totalsByMonthExclTransfer[month] || 0) + amount
        grandTotalExclTransfer += amount
      }
      const rows = [...byClassification.values()].sort((a, b) => b.total - a.total)
      return { rows, totalsByMonth, grandTotal, totalsByMonthExclTransfer, grandTotalExclTransfer }
    }
    return { out: build('出金'), inn: build('入金') }
  }, [entries, selectedYear, institution, level, classificationMap])

  if (loading || mapLoading) {
    return <p className="px-4 py-6 text-center text-[13px] text-[#AEAEB2]">読み込み中…</p>
  }
  if (availableYears.length === 0) {
    return <p className="px-4 py-6 text-center text-[13px] text-[#AEAEB2]">仕訳結果のデータがまだありません</p>
  }

  return (
    <div className="space-y-3">
      {/* ── 分類レベル切替 ── */}
      <div className="flex gap-1.5">
        {LEVELS.map(l => (
          <button
            key={l.id}
            onClick={() => setLevel(l.id)}
            className={`flex-1 h-8 rounded-full text-[13px] font-medium transition-colors ${
              level === l.id ? 'bg-[#1C1C1E] text-white' : 'bg-white text-[#1C1C1E] shadow-[0_1px_2px_rgba(0,0,0,0.06)]'
            }`}
          >
            {l.label}
          </button>
        ))}
      </div>

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
            <option key={y} value={y}>{y}年度（{y}年4月〜{Number(y) + 1}年3月）</option>
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

      {/* ── 取引先での絞り込み ── */}
      <div className="flex gap-1.5 overflow-x-auto">
        <button
          onClick={() => setInstitution('all')}
          className={`flex-shrink-0 px-3 h-7 rounded-full text-[12px] font-medium transition-colors ${
            institution === 'all' ? 'bg-[#1C1C1E] text-white' : 'bg-white text-[#1C1C1E] shadow-[0_1px_2px_rgba(0,0,0,0.06)]'
          }`}
        >
          すべて
        </button>
        {JOURNAL_INSTITUTIONS.map(inst => (
          <button
            key={inst}
            onClick={() => setInstitution(inst)}
            className={`flex-shrink-0 px-3 h-7 rounded-full text-[12px] font-medium transition-colors ${
              institution === inst ? 'bg-[#1C1C1E] text-white' : 'bg-white text-[#1C1C1E] shadow-[0_1px_2px_rgba(0,0,0,0.06)]'
            }`}
          >
            {inst}
          </button>
        ))}
      </div>

      <PivotTable
        title="支出（分類別・月別）"
        rows={pivot.out.rows}
        months={FISCAL_MONTHS}
        totalsByMonth={pivot.out.totalsByMonth}
        grandTotal={pivot.out.grandTotal}
        totalsByMonthExclTransfer={pivot.out.totalsByMonthExclTransfer}
        grandTotalExclTransfer={pivot.out.grandTotalExclTransfer}
        accentClass="text-[#1C1C1E]"
        showExcludedStyle={institution === 'all'}
      />
      <PivotTable
        title="収入（分類別・月別）"
        rows={pivot.inn.rows}
        months={FISCAL_MONTHS}
        totalsByMonth={pivot.inn.totalsByMonth}
        grandTotal={pivot.inn.grandTotal}
        totalsByMonthExclTransfer={pivot.inn.totalsByMonthExclTransfer}
        grandTotalExclTransfer={pivot.inn.grandTotalExclTransfer}
        accentClass="text-[#248A3D]"
        showExcludedStyle={institution === 'all'}
      />
    </div>
  )
}
