import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export const JOURNAL_INSTITUTIONS = [
  '横浜銀行', '住友銀行', 'ゆうちょ', 'みずほ銀行', '横浜VISA', '住友VISA', '楽天カードえみ',
]

// カード取引先（銀行取引先側に「カード利用額の引き落とし」として同額が別途1行計上されているため、
// 取引先横断の出金合計に含めると二重計上になる）
// 「楽天カードえみ」＝恵美様名義の楽天カード（みずほ銀行から引き落とし）。横浜銀行の
// 「楽天証券積立」分類（クレジットカードではなく楽天証券への定期積立）とは無関係の別物
// のため対象外（2026-08-30、本人の指示で「楽天カード」→「楽天カードえみ」に名称変更。
// 横浜銀行側も紛らわしい「楽天カード」という分類名を実態に合わせ「楽天証券積立」に改名）
export const CARD_INSTITUTIONS = ['横浜VISA', '住友VISA', '楽天カードえみ']

// journal_entries（家計簿の一次仕訳結果）を全件取得する。
// 3,000件超あるため asset_holdings_history 等と同じ .range() ページングで全件取得し、
// 絞り込み・検索はクライアント側（useMemo）で行う。
export function useJournalEntries(userId) {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchEntries = useCallback(async () => {
    if (!userId) return
    setLoading(true)

    const pageSize = 1000
    const all = []
    let from = 0
    while (true) {
      const { data, error } = await supabase
        .from('journal_entries')
        .select('id, institution, card_holder, transaction_date, billing_month, description, direction, amount, balance, classification, memo')
        .eq('user_id', userId)
        .order('transaction_date', { ascending: false })
        .order('id', { ascending: false })
        .range(from, from + pageSize - 1)
      if (error || !data) break
      all.push(...data)
      if (data.length < pageSize) break
      from += pageSize
    }

    setEntries(all)
    setLoading(false)
  }, [userId])

  useEffect(() => { fetchEntries() }, [fetchEntries])

  return { entries, loading, refetch: fetchEntries }
}
