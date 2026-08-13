import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// asset_category_history（証券・現金・保険の内訳を長期間記録したテーブル）から、
// 年ごとの最終スナップショット（その年で一番新しい記録日）を1点ずつ採用し、
// 総資産（証券+現金+保険）の年別推移を組み立てる
export function useAssetYearlyTotals(userId) {
  const [yearly, setYearly] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    if (!userId) return
    setLoading(true)

    const pageSize = 1000
    const all = []
    let from = 0
    while (true) {
      const { data, error } = await supabase
        .from('asset_category_history')
        .select('category, as_of, amount')
        .eq('user_id', userId)
        .order('as_of', { ascending: true })
        .range(from, from + pageSize - 1)
      if (error || !data) break
      all.push(...data)
      if (data.length < pageSize) break
      from += pageSize
    }

    // as_of ごとにカテゴリを束ねる
    const byDate = {}
    for (const row of all) {
      byDate[row.as_of] ??= {}
      byDate[row.as_of][row.category] = Number(row.amount)
    }

    // 年ごとに、その年で最も新しい記録日を採用する
    const lastOfYear = {}
    for (const dateStr of Object.keys(byDate)) {
      const year = dateStr.slice(0, 4)
      if (!lastOfYear[year] || dateStr > lastOfYear[year]) lastOfYear[year] = dateStr
    }

    const result = Object.entries(lastOfYear)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([year, dateStr]) => {
        const cats = byDate[dateStr] ?? {}
        const securities = cats.securities ?? 0
        const cash = cats.cash ?? 0
        const insurance = cats.insurance ?? 0
        return { year, as_of: dateStr, securities, cash, insurance, total: securities + cash + insurance }
      })

    setYearly(result)
    setLoading(false)
  }, [userId])

  useEffect(() => { fetchData() }, [fetchData])

  return { yearly, loading, refetch: fetchData }
}
