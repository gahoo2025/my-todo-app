import { useState, useMemo, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { JOURNAL_INSTITUTIONS } from '../hooks/useJournalEntries'
import { useJournalClassificationMap } from '../hooks/useJournalClassificationMap'

const yen = new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 0 })
// 年度＝4月始まり3月終わりで表示する
const FISCAL_MONTHS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3]
const UNCLASSIFIED = '（未分類）'
const UNMAPPED = '（未対応）'

// 取引先「すべて」表示時、銀行取引先側の「カード利用額の引き落とし」1行（分類１が
// カード取引先名そのもの）は、カード取引先側の明細（食費・ETC等）と同じお金を指して
// おり合算すると二重計上になる。内訳としては表示するが、合計（年合計・月合計）には
// 含めない。分類１表示では該当行をグレー表示にする（2026-08-29、本人の指示）。
//
// 判定は必ず「取引先（institution）＋分類１」の組み合わせで行う。分類名の文字列
// だけで判定してはいけない：実データで確認済みの通り、同じ「楽天カード」という
// 分類名でも、みずほ銀行の行は本物の楽天カード引き落としで二重計上の対象だが、
// 横浜銀行の行は楽天カードの明細とは無関係の別の取引（journal_classification_map
// 上も「投資」に対応付けられており、他のカード引き落とし行の「－」とは扱いが違う）
// で、対象に含めてはいけない（2026-08-29、本人の指摘で発覚。当初は分類名だけで
// 判定しており、横浜銀行分を誤って合計から除外し、月別明細の合計とズレていた）。
// 同様に住友銀行の「住友カード」という類似の分類名も、journal_classification_map
// で「雑費とも仕事」という実支出に対応付けられており、二重計上ではないため対象外。
const CARD_SETTLEMENT_PAIRS = new Set(['横浜銀行|横浜VISA', '横浜銀行|住友VISA', 'みずほ銀行|楽天カード'])

// 「合計（移動を除く）」行用：支出テーブルでは「移動（出金）」、収入テーブルでは
// 「移動（入金）」を除く。これらは自分名義の別口座・証券口座等への資金移動であって
// 実質的な支出・収入ではないため、口座間送金を除いた実質的な収支を見せる（2026-08-29、
// 本人の指示）。カード引き落とし行の除外と違い、取引先を1つに絞り込んでいても常に適用する
// （移動は取引先をまたいでいなくても「実質的な支出ではない」という性質が変わらないため）。
const TRANSFER_CLASSIFICATION = { '出金': '移動（出金）', '入金': '移動（入金）' }

// 上記2つの除外判定は、必ず「変換前の生の分類１の値」に対して行う（resolveClassification
// で分類２／３に変換した後の値では判定しない）。分類２／３では、カード引き落とし行・
// 移動（出金／入金）に加えてATM・現金出金・Suicaチャージ等、他の複数の分類１の値が
// journal_classification_map側で同じ「－」という1つの表示ラベルに集約されてしまうため、
// 変換後の値だけでは「二重計上の対象」と「対象外」を区別できない（2026-08-29、
// 分類２／３表示時に二重計上が再発する問題として発覚・修正）。
// 生の分類１で判定することで、どの表示レベルを選んでも合計の対象になる取引が変わらない
// ようにする。ただし表示上のグレー行＋「（合計に含まず）」の注記は、分類１表示のときだけ
// 意味を持つ（分類２／３では「－」行の中に除外対象・対象外が混在するため、行単位では
// 印を付けない。内訳表示自体は変更しない）。

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

// billing_month（YYYYMM）が属する年度（4月始まり）を返す。1〜3月は前年の年度扱い
function fiscalYearOf(billingMonth) {
  const year = Number(billingMonth.slice(0, 4))
  const month = Number(billingMonth.slice(4, 6))
  return month >= 4 ? year : year - 1
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
              // ある分類名の行が、複数の取引先にまたがって存在する場合（例：「楽天カード」が
              // みずほ銀行と横浜銀行の両方にある）、そのうち一部の取引先分だけが二重計上の
              // 対象ということがあり得る（CARD_SETTLEMENT_PAIRS参照）。そのため行単位では
              // 「全額除外」「一部除外」「除外なし」の3通りを区別して表示する。
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
      const transferClassification = TRANSFER_CLASSIFICATION[direction]
      const byClassification = new Map()
      const totalsByMonth = {}
      const totalsByMonthExclTransfer = {}
      let grandTotal = 0
      let grandTotalExclTransfer = 0
      for (const e of entries) {
        if (e.direction !== direction) continue
        if (!e.billing_month || !selectedYear || String(fiscalYearOf(e.billing_month)) !== selectedYear) continue
        if (institution !== 'all' && e.institution !== institution) continue
        const month = Number(e.billing_month.slice(4, 6))
        const rawCls = e.classification
        const cls = (rawCls && resolveClassification(level, e.institution, rawCls, classificationMap)) || UNCLASSIFIED
        if (!byClassification.has(cls)) {
          byClassification.set(cls, { classification: cls, byMonth: {}, total: 0, excludedTotal: 0 })
        }
        const row = byClassification.get(cls)
        const amount = Number(e.amount) || 0
        row.byMonth[month] = (row.byMonth[month] || 0) + amount
        row.total += amount

        // 「合計」「合計（移動を除く）」は、表示レベルに関わらず常に変換前の生の分類１で、
        // かつ必ず取引先とセットで判定する（分類２／３では複数の分類１が同じ「－」に
        // 集約されるため、変換後の値だけでは判定できない。分類名だけでも判定できない
        // ことは上記CARD_SETTLEMENT_PAIRSのコメントの通り）
        // 特定の1取引先に絞り込んでいるときは二重計上が起きないため除外しない
        const isCardSettlementDup = institution === 'all' && rawCls && CARD_SETTLEMENT_PAIRS.has(`${e.institution}|${rawCls}`)
        if (isCardSettlementDup) {
          row.excludedTotal += amount
          continue
        }
        totalsByMonth[month] = (totalsByMonth[month] || 0) + amount
        grandTotal += amount
        // 移動（出金）／移動（入金）は取引先の絞り込みに関わらず常に除く
        if (rawCls === transferClassification) continue
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
