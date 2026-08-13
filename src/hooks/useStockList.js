import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useStockList(userId) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchList = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    const { data } = await supabase
      .from('stock_master_list')
      .select('*')
      .eq('user_id', userId)
      .order('symbol_code', { ascending: true })
    setItems(data ?? [])
    setLoading(false)
  }, [userId])

  useEffect(() => { fetchList() }, [fetchList])

  return { items, loading, refetch: fetchList }
}
