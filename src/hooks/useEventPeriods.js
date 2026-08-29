import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// journal_event_periods（イベント期間による分類上書きの登録内容）を取得・追加・削除する。
// 旅行・お出かけに限らず、ピアノの発表会・空手の試合・散髪など、日付が分かれば分類できる
// 出来事全般を対象とする（詳細はjournalRules.jsのコメント参照）。
// DBの date_from/date_to をJS側の dateFrom/dateTo に変換して返す
// （applyEventPeriodOverrideの引数の形に合わせるため）。
export function useEventPeriods(userId) {
  const [periods, setPeriods] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchPeriods = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    const { data, error } = await supabase
      .from('journal_event_periods')
      .select('id, name, date_from, date_to, overrides')
      .eq('user_id', userId)
      .order('date_from', { ascending: false })

    if (!error && data) {
      setPeriods(data.map(row => ({
        id: row.id,
        name: row.name,
        dateFrom: row.date_from,
        dateTo: row.date_to,
        overrides: row.overrides,
      })))
    }
    setLoading(false)
  }, [userId])

  useEffect(() => { fetchPeriods() }, [fetchPeriods])

  async function addPeriod({ name, dateFrom, dateTo, overrides }) {
    const { error } = await supabase.from('journal_event_periods').insert({
      user_id: userId,
      name,
      date_from: dateFrom,
      date_to: dateTo,
      overrides,
    })
    if (error) throw error
    await fetchPeriods()
  }

  async function deletePeriod(id) {
    const { error } = await supabase.from('journal_event_periods').delete().eq('id', id)
    if (error) throw error
    await fetchPeriods()
  }

  return { periods, loading, addPeriod, deletePeriod, refetch: fetchPeriods }
}
