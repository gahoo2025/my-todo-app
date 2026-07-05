import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

// 資産残高（株式・投資信託など）の最新値を種類ごとに取得する
export function useAssetBalances(userId) {
  const [balances, setBalances] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    fetchBalances()
  }, [userId])

  async function fetchBalances() {
    const { data } = await supabase
      .from('asset_balances').select('*').eq('user_id', userId)
      .order('as_of', { ascending: false })
      .order('created_at', { ascending: false })
    setBalances(data ?? [])
    setLoading(false)
  }

  // 種類ごとの最新値（as_of の新しい順で最初に出たもの）
  const latestByKind = {}
  for (const b of balances) {
    if (!latestByKind[b.kind]) latestByKind[b.kind] = b
  }

  return { balances, latestByKind, loading, refetch: fetchBalances }
}
