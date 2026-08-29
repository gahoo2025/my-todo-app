import { Fragment, useState, useMemo, useEffect } from 'react'
import { JOURNAL_INSTITUTIONS, CARD_INSTITUTIONS } from '../hooks/useJournalEntries'

const yen = new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 0 })
const PAGE_SIZE = 50
const UNCLASSIFIED = '（未分類）'

function formatDate(s) {
  if (!s) return ''
  const [y, m, d] = s.split('-').map(Number)
  return `${y}/${m}/${d}`
}

// billing_month（YYYYMM）を「2026年7月」形式に整形
function formatMonth(ym) {
  if (!ym || ym.length !== 6) return ym ?? ''
  return `${ym.slice(0, 4)}年${Number(ym.slice(4, 6))}月`
}

// 個別明細1件分のカード表示（「特定取引先」表示時の一覧と、「すべて」表示時のドリルダウンの
// 両方から共通で呼び出す。見た目・ロジックはこれまでの一覧表示から変更していない）
function EntryCard({ e }) {
  return (
    <div className="ios-card px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-medium px-1.5 py-0.5 rounded-full bg-[#007AFF]/10 text-[#007AFF]">
            {e.institution}
          </span>
          {e.card_holder && (
            <span className="text-[11px] text-[#8E8E93]">{e.card_holder}様</span>
          )}
          <span className="text-[11px] text-[#AEAEB2]">{formatDate(e.transaction_date)}</span>
        </div>
        <p className={`text-[15px] font-semibold tabular-nums ${e.direction === '出金' ? 'text-[#1C1C1E]' : 'text-[#248A3D]'}`}>
          {e.direction === '出金' ? '−' : '+'}{yen.format(e.amount)}円
        </p>
      </div>
      <p className="text-[14px] text-[#1C1C1E] mt-1.5">{e.description}</p>
      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
        {e.classification && (
          <span className="text-[11px] font-medium px-1.5 py-0.5 rounded-full bg-black/[0.05] text-[#636366]">
            {e.classification}
          </span>
        )}
        {e.memo && <span className="text-[11px] text-[#AEAEB2]">{e.memo}</span>}
      </div>
    </div>
  )
}

// 取引先「すべて」表示：1取引先ぶんの、仕訳１分類ごとの集計表。
// 分類行タップで、その分類配下の個別明細をアコーディオンで展開する（複数同時展開可）。
function InstitutionClassificationTable({ institution, rows, expanded, onToggleRow }) {
  return (
    <div className="ios-card p-0 overflow-hidden">
      <p className="px-4 pt-3.5 pb-2 text-[13px] font-semibold text-[#1C1C1E]">{institution}</p>
      <div className="overflow-x-auto">
        <table className="min-w-full text-[12px] tabular-nums">
          <thead>
            <tr className="border-t border-black/[0.05]">
              <th className="text-left font-medium text-[#8E8E93] px-3 py-2 whitespace-nowrap">分類</th>
              <th className="text-right font-medium text-[#8E8E93] px-2 py-2 whitespace-nowrap">件数</th>
              <th className="text-right font-medium text-[#8E8E93] px-3 py-2 whitespace-nowrap">出金合計</th>
              <th className="text-right font-medium text-[#8E8E93] px-3 py-2 whitespace-nowrap">入金合計</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => {
              const key = `${institution}|${row.classification}`
              const isOpen = expanded.has(key)
              return (
                <Fragment key={key}>
                  <tr
                    onClick={() => onToggleRow(key)}
                    className="border-t border-black/[0.04] active:bg-black/[0.03] cursor-pointer"
                  >
                    <td className="text-left text-[#1C1C1E] px-3 py-2 whitespace-nowrap">
                      <span className={`inline-block mr-1 text-[#AEAEB2] transition-transform ${isOpen ? 'rotate-90' : ''}`}>›</span>
                      {row.classification}
                    </td>
                    <td className="text-right text-[#8E8E93] px-2 py-2 whitespace-nowrap">{row.count}件</td>
                    <td className="text-right font-semibold text-[#1C1C1E] px-3 py-2 whitespace-nowrap">
                      {row.out ? yen.format(row.out) : '—'}
                    </td>
                    <td className="text-right font-semibold text-[#248A3D] px-3 py-2 whitespace-nowrap">
                      {row.inn ? yen.format(row.inn) : '—'}
                    </td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td colSpan={4} className="px-3 pb-2.5 bg-black/[0.015]">
                        <div className="space-y-1.5 pt-1.5">
                          {row.entries.map(e => <EntryCard key={e.id} e={e} />)}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// 月別明細：仕訳結果を年月（billing_month）で絞り込んで一覧表示する
// billing_monthはカード（横浜VISA・住友VISA・楽天カード）は支払い月、銀行は取引月を保持しているため、
// この1列で絞り込むだけで「カードは利用日でなく支払い月」という運用がそのまま成立する
export default function MonthlyJournalList({ entries, loading }) {
  const [query, setQuery] = useState('')
  const [institution, setInstitution] = useState('all')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [selectedMonth, setSelectedMonth] = useState(null)
  const [expandedRows, setExpandedRows] = useState(new Set())

  const availableMonths = useMemo(() => {
    const set = new Set(entries.map(e => e.billing_month).filter(Boolean))
    return [...set].sort((a, b) => b.localeCompare(a))
  }, [entries])

  useEffect(() => {
    if (availableMonths.length === 0) return
    if (!selectedMonth || !availableMonths.includes(selectedMonth)) {
      setSelectedMonth(availableMonths[0])
    }
  }, [availableMonths, selectedMonth])

  const monthIndex = availableMonths.indexOf(selectedMonth)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return entries.filter(e => {
      if (selectedMonth && e.billing_month !== selectedMonth) return false
      if (institution !== 'all' && e.institution !== institution) return false
      if (!q) return true
      return [e.description, e.classification, e.memo].filter(Boolean).join(' ').toLowerCase().includes(q)
    })
  }, [entries, query, institution, selectedMonth])

  // 月・取引先・検索条件を変えたら、開いていたドリルダウンは一旦すべて閉じる
  useEffect(() => {
    setExpandedRows(new Set())
  }, [selectedMonth, institution, query])

  const summary = useMemo(() => {
    let out = 0
    let inn = 0
    for (const e of filtered) {
      // 取引先「すべて」表示のときのみ、カード取引先（横浜VISA・住友VISA・楽天カード）を出金合計から除く。
      // カード取引先の利用額は、銀行取引先側に「カード利用額の引き落とし」として同額が別途1行
      // 計上されているため、単純合算すると二重計上になるため。
      const excludedFromOut = institution === 'all' && CARD_INSTITUTIONS.includes(e.institution)
      if (e.direction === '出金') {
        if (!excludedFromOut) out += Number(e.amount) || 0
      } else {
        inn += Number(e.amount) || 0
      }
    }
    return { count: filtered.length, out, inn }
  }, [filtered, institution])

  // 取引先「すべて」表示のときだけ使う、取引先×仕訳１分類の集計（JOURNAL_INSTITUTIONSの順で並べる）
  const institutionTables = useMemo(() => {
    if (institution !== 'all') return []
    const byInstitution = new Map()
    for (const e of filtered) {
      if (!byInstitution.has(e.institution)) byInstitution.set(e.institution, new Map())
      const byClassification = byInstitution.get(e.institution)
      const cls = e.classification || UNCLASSIFIED
      if (!byClassification.has(cls)) {
        byClassification.set(cls, { classification: cls, count: 0, out: 0, inn: 0, entries: [] })
      }
      const row = byClassification.get(cls)
      row.count += 1
      row.entries.push(e)
      const amount = Number(e.amount) || 0
      if (e.direction === '出金') row.out += amount
      else row.inn += amount
    }
    return JOURNAL_INSTITUTIONS
      .filter(inst => byInstitution.has(inst))
      .map(inst => ({
        institution: inst,
        rows: [...byInstitution.get(inst).values()].sort((a, b) => (b.out - a.out) || (b.inn - a.inn)),
      }))
  }, [filtered, institution])

  const visible = filtered.slice(0, visibleCount)

  function handleFilterChange(fn) {
    fn()
    setVisibleCount(PAGE_SIZE)
  }

  function toggleRow(key) {
    setExpandedRows(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <div className="space-y-3">
      {/* ── 年月選択・検索・絞り込み・サマリー（縦スクロールしても上部に固定） ── */}
      <div className="sticky top-below-subtabs z-[4] -mx-4 px-4 pt-2 pb-2 bg-[#F2F2F7]/85 backdrop-blur-xl space-y-2">
      {availableMonths.length > 0 && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleFilterChange(() => setSelectedMonth(availableMonths[monthIndex + 1]))}
            disabled={monthIndex >= availableMonths.length - 1}
            className="ios-icon-btn text-[#007AFF] disabled:opacity-30 disabled:pointer-events-none"
            aria-label="前の月"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <select
            value={selectedMonth ?? ''}
            onChange={e => handleFilterChange(() => setSelectedMonth(e.target.value))}
            className="flex-1 text-center px-3 py-2 rounded-[10px] bg-white text-[15px] font-semibold text-[#1C1C1E] shadow-[0_1px_2px_rgba(0,0,0,0.06)] focus:outline-none"
          >
            {availableMonths.map(m => (
              <option key={m} value={m}>{formatMonth(m)}</option>
            ))}
          </select>
          <button
            onClick={() => handleFilterChange(() => setSelectedMonth(availableMonths[monthIndex - 1]))}
            disabled={monthIndex <= 0}
            className="ios-icon-btn text-[#007AFF] disabled:opacity-30 disabled:pointer-events-none"
            aria-label="次の月"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}

      {/* ── 検索・絞り込み ── */}
      <div className="space-y-2">
        <input
          type="text"
          value={query}
          onChange={e => handleFilterChange(() => setQuery(e.target.value))}
          placeholder="摘要・分類・備考で検索"
          className="w-full px-3 py-2.5 rounded-[10px] bg-white text-[14px] text-[#1C1C1E] placeholder:text-[#AEAEB2] shadow-[0_1px_2px_rgba(0,0,0,0.06)] focus:outline-none"
        />
        <div className="flex gap-1.5 overflow-x-auto">
          <button
            onClick={() => handleFilterChange(() => setInstitution('all'))}
            className={`flex-shrink-0 px-3 h-7 rounded-full text-[12px] font-medium transition-colors ${
              institution === 'all' ? 'bg-[#1C1C1E] text-white' : 'bg-white text-[#1C1C1E] shadow-[0_1px_2px_rgba(0,0,0,0.06)]'
            }`}
          >
            すべて
          </button>
          {JOURNAL_INSTITUTIONS.map(inst => (
            <button
              key={inst}
              onClick={() => handleFilterChange(() => setInstitution(inst))}
              className={`flex-shrink-0 px-3 h-7 rounded-full text-[12px] font-medium transition-colors ${
                institution === inst ? 'bg-[#1C1C1E] text-white' : 'bg-white text-[#1C1C1E] shadow-[0_1px_2px_rgba(0,0,0,0.06)]'
              }`}
            >
              {inst}
            </button>
          ))}
        </div>
      </div>

      {/* ── サマリー ── */}
      {!loading && (
        <div className="ios-card px-4 py-3.5 grid grid-cols-3 gap-2">
          <div>
            <p className="text-[10px] text-[#AEAEB2]">件数</p>
            <p className="text-[16px] font-semibold text-[#1C1C1E] tabular-nums">{yen.format(summary.count)}件</p>
          </div>
          <div>
            <p className="text-[10px] text-[#AEAEB2]">出金合計{institution === 'all' && <span className="block">（カード取引先を除く）</span>}</p>
            <p className="text-[16px] font-semibold text-[#1C1C1E] tabular-nums">{yen.format(summary.out)}円</p>
          </div>
          <div>
            <p className="text-[10px] text-[#AEAEB2]">入金合計</p>
            <p className="text-[16px] font-semibold text-[#248A3D] tabular-nums">{yen.format(summary.inn)}円</p>
          </div>
        </div>
      )}
      </div>

      {/* ── 一覧 ── */}
      {loading ? (
        <p className="px-4 py-6 text-center text-[13px] text-[#AEAEB2]">読み込み中…</p>
      ) : filtered.length === 0 ? (
        <p className="px-4 py-6 text-center text-[13px] text-[#AEAEB2]">
          {entries.length === 0 ? '仕訳結果のデータがまだありません' : '該当する取引がありません'}
        </p>
      ) : institution === 'all' ? (
        <div className="space-y-3">
          {institutionTables.map(t => (
            <InstitutionClassificationTable
              key={t.institution}
              institution={t.institution}
              rows={t.rows}
              expanded={expandedRows}
              onToggleRow={toggleRow}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map(e => <EntryCard key={e.id} e={e} />)}

          {visibleCount < filtered.length && (
            <button
              onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
              className="w-full py-2.5 rounded-[10px] bg-white text-[13px] font-medium text-[#007AFF] shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
            >
              もっと見る（残り{filtered.length - visibleCount}件）
            </button>
          )}
        </div>
      )}
    </div>
  )
}
