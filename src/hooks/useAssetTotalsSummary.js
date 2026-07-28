import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// asset_total_history（CSV取り込みで蓄積した人物・証券会社ごとの資産合計スナップショット）
// から、各人物・証券会社の最新値を集計する
export function useAssetTotalsSummary(userId) {
  const [byPersonBroker, setByPersonBroker] = useState({})
  const [latestDate, setLatestDate] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchSummary = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    const { data } = await supabase
      .from('asset_total_history')
      .select('person, broker, total_value, recorded_at')
      .eq('user_id', userId)
      .order('recorded_at', { ascending: false })

    const seen = new Set()
    const result = {}
    let newest = null
    for (const row of data ?? []) {
      const key = `${row.person}__${row.broker}`
      if (seen.has(key)) continue
      seen.add(key)
      result[row.person] ??= {}
      result[row.person][row.broker] = Number(row.total_value)
      if (!newest || row.recorded_at > newest) newest = row.recorded_at
    }
    setByPersonBroker(result)
    setLatestDate(newest)
    setLoading(false)
  }, [userId])

  useEffect(() => { fetchSummary() }, [fetchSummary])

  const total = Object.values(byPersonBroker)
    .flatMap(brokers => Object.values(brokers))
    .reduce((sum, v) => sum + v, 0)

  return { byPersonBroker, total, latestDate, loading, refetch: fetchSummary }
}
