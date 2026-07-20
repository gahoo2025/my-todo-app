import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

// 資産管理アプリ（ローカルで動く別アプリ）から連携された、純資産合計・
// 家族毎の内訳を取得する。保有銘柄などの詳細はここには含まれない。
export function useFamilyAssetSummary(userId) {
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    fetchSummary()
  }, [userId])

  async function fetchSummary() {
    const { data } = await supabase
      .from('asset_summary').select('*').eq('user_id', userId).maybeSingle()
    setSummary(data ?? null)
    setLoading(false)
  }

  return { summary, loading, refetch: fetchSummary }
}
