import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useJournalEntries } from '../hooks/useJournalEntries'
import MonthlyJournalList from '../components/MonthlyJournalList'
import AnnualClassificationSummary from '../components/AnnualClassificationSummary'
import FiscalYearBalanceChart from '../components/FiscalYearBalanceChart'
import BankStatementImport from '../components/BankStatementImport'

// サブ機能の定義（今後ここに追加していく）
const SUB_FEATURES = [
  { id: 'monthly', label: '月別明細' },
  { id: 'annual',  label: '分類別年間収支' },
  { id: 'balance', label: '収支推移' },
  { id: 'import',  label: '明細インポート' },
]

export default function KakeiboPage({ embedded }) {
  const { user } = useAuth()
  const { entries, loading, refetch } = useJournalEntries(user?.id)
  const [sub, setSub] = useState('monthly')

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
        {sub === 'monthly' && <MonthlyJournalList entries={entries} loading={loading} />}
        {sub === 'annual' && <AnnualClassificationSummary entries={entries} loading={loading} />}
        {sub === 'balance' && <FiscalYearBalanceChart entries={entries} loading={loading} />}
        {sub === 'import' && <BankStatementImport onImported={refetch} />}
      </div>
    </>
  )

  if (embedded) {
    return (
      <main className="max-w-lg md:max-w-3xl mx-auto px-4 py-4 pb-28 md:pb-10">
        {body}
      </main>
    )
  }
  return (
    <div className="min-h-screen">
      <main className="max-w-lg md:max-w-3xl mx-auto px-4 py-4 pb-10">{body}</main>
    </div>
  )
}
