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

  // 仕訳済み明細（journal_entries）1件の分類を後から変更する（2026-09-20、本人の指示：
  // 「未仕訳を仕訳した後、参照変更ができるようにして欲しい」＝確定後に分類を間違えて
  // いた場合に、月別明細から直接修正できるようにする）。classification_sourceを
  // 'manual'にし、以後の自動再分類（自動仕訳ルールの学習等）とは無関係な手動確定である
  // ことを明示する（resolveQueueItemの手動確定時と同じ扱い、buildEntryRow参照）。
  // 成功時はローカルstateも更新し、失敗時はエラーを返して呼び出し側で表示できるようにする。
  const updateClassification = useCallback(async (id, classification) => {
    const { error } = await supabase
      .from('journal_entries')
      .update({ classification, classification_source: 'manual' })
      .eq('id', id)
      .eq('user_id', userId)
    if (error) return { error }
    setEntries(prev => prev.map(e => (e.id === id ? { ...e, classification } : e)))
    return { error: null }
  }, [userId])

  return { entries, loading, refetch: fetchEntries, updateClassification }
}
