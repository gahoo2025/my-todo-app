import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useWatchStocks(userId) {
  const [stocks, setStocks] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    fetchAll()
  }, [userId])

  async function fetchAll() {
    const { data } = await supabase
      .from('watch_stocks').select('*').eq('user_id', userId)
      .order('created_at', { ascending: false })
    setStocks(data ?? [])
    setLoading(false)
  }

  async function addStock(item) {
    const { data, error } = await supabase
      .from('watch_stocks').insert([{ ...item, user_id: userId }]).select().single()
    if (error) {
      if (error.code === '23505') alert('このコードはすでに監視銘柄に登録されています')
      else alert('保存に失敗しました: ' + error.message)
      return null
    }
    setStocks(prev => [data, ...prev])
    return data
  }

  async function updateStock(id, updates) {
    const { data, error } = await supabase
      .from('watch_stocks').update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id).select().single()
    if (error) { alert('更新に失敗しました: ' + error.message); return }
    setStocks(prev => prev.map(s => s.id === id ? data : s))
  }

  async function deleteStock(id) {
    const { error } = await supabase.from('watch_stocks').delete().eq('id', id)
    if (!error) setStocks(prev => prev.filter(s => s.id !== id))
  }

  return { stocks, loading, addStock, updateStock, deleteStock }
}
