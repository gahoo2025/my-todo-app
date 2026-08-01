import { useState } from 'react'
import { supabase } from '../lib/supabase'

export function holdingKey(h) {
  return `${h.person}__${h.broker}__${h.holding_type}__${h.symbol_code ?? ''}__${h.symbol_name}__${h.account_type ?? ''}`
}

// 個別銘柄（保有ポジション）の時価評価額の推移を、タップされた時に取得する
export function useAssetHoldingHistory(userId) {
  const [historyByKey, setHistoryByKey] = useState({})
  const [loadingKey, setLoadingKey] = useState(null)

  async function fetchHistory(h) {
    const key = holdingKey(h)
    if (historyByKey[key]) return
    setLoadingKey(key)

    const pageSize = 1000
    const all = []
    let from = 0
    while (true) {
      const { data, error } = await supabase
        .from('asset_holdings_history')
        .select('recorded_at, market_value')
        .eq('user_id', userId)
        .eq('person', h.person)
        .eq('broker', h.broker)
        .eq('holding_type', h.holding_type)
        .eq('symbol_code', h.symbol_code ?? '')
        .eq('symbol_name', h.symbol_name)
        .eq('account_type', h.account_type ?? '')
        .order('recorded_at', { ascending: true })
        .range(from, from + pageSize - 1)
      if (error || !data) break
      all.push(...data)
      if (data.length < pageSize) break
      from += pageSize
    }

    setHistoryByKey(prev => ({
      ...prev,
      [key]: all.map(r => ({ trade_date: r.recorded_at, value: r.market_value })),
    }))
    setLoadingKey(null)
  }

  return { historyByKey, loadingKey, fetchHistory }
}
