import { useState, useMemo } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useJournalEntries, JOURNAL_INSTITUTIONS } from '../hooks/useJournalEntries'

const yen = new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 0 })
const PAGE_SIZE = 50

function formatDate(s) {
  if (!s) return ''
  const [y, m, d] = s.split('-').map(Number)
  return `${y}/${m}/${d}`
}

export default function KakeiboPage({ embedded }) {
  const { user } = useAuth()
  const { entries, loading } = useJournalEntries(user?.id)
  const [query, setQuery] = useState('')
  const [institution, setInstitution] = useState('all')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return entries.filter(e => {
      if (institution !== 'all' && e.institution !== institution) return false
      if (!q) return true
      return [e.description, e.classification, e.memo].filter(Boolean).join(' ').toLowerCase().includes(q)
    })
  }, [entries, query, institution])

  const summary = useMemo(() => {
    let out = 0
    let inn = 0
    for (const e of filtered) {
      if (e.direction === '出金') out += Number(e.amount) || 0
      else inn += Number(e.amount) || 0
    }
    return { count: filtered.length, out, inn }
  }, [filtered])

  const visible = filtered.slice(0, visibleCount)

  function handleFilterChange(fn) {
    fn()
    setVisibleCount(PAGE_SIZE)
  }

  return (
    <div className={embedded ? 'space-y-3' : 'max-w-lg mx-auto px-4 pt-4 space-y-3'}>
      {/* ── 検索・絞り込み ── */}
      <div className="sticky top-below-subtabs z-[4] -mx-4 px-4 pt-2 pb-2 bg-[#F2F2F7]/85 backdrop-blur-xl space-y-2">
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
            <p className="text-[10px] text-[#AEAEB2]">出金合計</p>
            <p className="text-[16px] font-semibold text-[#1C1C1E] tabular-nums">{yen.format(summary.out)}円</p>
          </div>
          <div>
            <p className="text-[10px] text-[#AEAEB2]">入金合計</p>
            <p className="text-[16px] font-semibold text-[#248A3D] tabular-nums">{yen.format(summary.inn)}円</p>
          </div>
        </div>
      )}

      {/* ── 一覧 ── */}
      {loading ? (
        <p className="px-4 py-6 text-center text-[13px] text-[#AEAEB2]">読み込み中…</p>
      ) : filtered.length === 0 ? (
        <p className="px-4 py-6 text-center text-[13px] text-[#AEAEB2]">
          {entries.length === 0 ? '仕訳結果のデータがまだありません' : '該当する取引がありません'}
        </p>
      ) : (
        <div className="space-y-2">
          {visible.map(e => (
            <div key={e.id} className="ios-card px-4 py-3">
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
          ))}

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
