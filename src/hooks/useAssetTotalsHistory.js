import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// asset_total_history から、日付ごとの家族合計・人物ごとの推移（証券会社合算）を組み立てる
export function useAssetTotalsHistory(userId) {
  const [familySeries, setFamilySeries] = useState([])
  const [byPersonSeries, setByPersonSeries] = useState({})
  const [loading, setLoading] = useState(true)

  const fetchHistory = useCallback(async () => {
    if (!userId) return
    setLoading(true)

    const pageSize = 1000
    const all = []
    let from = 0
    while (true) {
      const { data, error } = await supabase
        .from('asset_total_history')
        .select('person, broker, total_value, recorded_at')
        .eq('user_id', userId)
        .order('recorded_at', { ascending: true })
        .range(from, from + pageSize - 1)
      if (error || !data) break
      all.push(...data)
      if (data.length < pageSize) break
      from += pageSize
    }

    const byDate = {} // date -> total
    const byPersonDate = {} // person -> date -> total
    for (const row of all) {
      byDate[row.recorded_at] = (byDate[row.recorded_at] ?? 0) + Number(row.total_value)
      byPersonDate[row.person] ??= {}
      byPersonDate[row.person][row.recorded_at] = (byPersonDate[row.person][row.recorded_at] ?? 0) + Number(row.total_value)
    }

    const family = Object.entries(byDate)
      .map(([trade_date, value]) => ({ trade_date, value }))
      .sort((a, b) => a.trade_date.localeCompare(b.trade_date))

    const byPerson = {}
    for (const [person, dates] of Object.entries(byPersonDate)) {
      byPerson[person] = Object.entries(dates)
        .map(([trade_date, value]) => ({ trade_date, value }))
        .sort((a, b) => a.trade_date.localeCompare(b.trade_date))
    }

    setFamilySeries(family)
    setByPersonSeries(byPerson)
    setLoading(false)
  }, [userId])

  useEffect(() => { fetchHistory() }, [fetchHistory])

  return { familySeries, byPersonSeries, loading, refetch: fetchHistory }
}
