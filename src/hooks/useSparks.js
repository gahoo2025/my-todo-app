import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useSparks(userId) {
  const [sparks, setSparks] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    fetchSparks()
  }, [userId])

  async function fetchSparks() {
    const { data } = await supabase
      .from('sparks').select('*').eq('user_id', userId)
      .order('created_at', { ascending: false })
    setSparks(data ?? [])
    setLoading(false)
  }

  async function addSpark(spark) {
    const { data, error } = await supabase
      .from('sparks').insert([{ ...spark, user_id: userId }]).select().single()
    if (error) { alert('保存に失敗しました: ' + error.message); return null }
    setSparks(prev => [data, ...prev])
    return data
  }

  async function updateSpark(id, updates) {
    const { data, error } = await supabase
      .from('sparks').update(updates).eq('id', id).select().single()
    if (error) { alert('更新に失敗しました: ' + error.message); return }
    setSparks(prev => prev.map(s => s.id === id ? data : s))
  }

  async function deleteSpark(id) {
    const { error } = await supabase.from('sparks').delete().eq('id', id)
    if (!error) setSparks(prev => prev.filter(s => s.id !== id))
  }

  return { sparks, loading, addSpark, updateSpark, deleteSpark }
}
