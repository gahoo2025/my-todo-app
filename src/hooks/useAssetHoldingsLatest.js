import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// asset_holdings_history から、人物ごとに最新スナップショットの個別銘柄一覧を集計する
export function useAssetHoldingsLatest(userId) {
  const [byPerson, setByPerson] = useState({})
  const [loading, setLoading] = useState(true)

  const fetchHoldings = useCallback(async () => {
    if (!userId) return
    setLoading(true)

    const pageSize = 1000
    const all = []
    let from = 0
    while (true) {
      const { data, error } = await supabase
        .from('asset_holdings_history')
        .select('person, broker, holding_type, symbol_code, symbol_name, account_type, quantity, market_value, unrealized_pl, unrealized_pl_pct, recorded_at')
        .eq('user_id', userId)
        .order('recorded_at', { ascending: false })
        .range(from, from + pageSize - 1)
      if (error || !data) break
      all.push(...data)
      if (data.length < pageSize) break
      from += pageSize
    }

    const seen = new Set()
    const result = {}
    for (const row of all) {
      const key = `${row.person}__${row.broker}__${row.holding_type}__${row.symbol_code}__${row.symbol_name}__${row.account_type}`
      if (seen.has(key)) continue
      seen.add(key)
      result[row.person] ??= []
      result[row.person].push(row)
    }
    for (const person of Object.keys(result)) {
      result[person].sort((a, b) => Number(b.market_value ?? 0) - Number(a.market_value ?? 0))
    }
    setByPerson(result)
    setLoading(false)
  }, [userId])

  useEffect(() => { fetchHoldings() }, [fetchHoldings])

  return { byPerson, loading, refetch: fetchHoldings }
}
