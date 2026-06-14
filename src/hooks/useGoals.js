import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useGoals(userId) {
  const [goals, setGoals] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    fetchGoals()
  }, [userId])

  async function fetchGoals() {
    const { data } = await supabase
      .from('goals').select('*').eq('user_id', userId)
      .order('created_at', { ascending: false })
    setGoals(data ?? [])
    setLoading(false)
  }

  async function addGoal(goal) {
    const { data, error } = await supabase
      .from('goals').insert([{ ...goal, user_id: userId }]).select().single()
    if (error) { alert('目標の保存に失敗しました: ' + error.message); return null }
    setGoals(prev => [data, ...prev])
    return data
  }

  async function updateGoal(id, updates) {
    const { data, error } = await supabase
      .from('goals').update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id).select().single()
    if (error) { alert('更新に失敗しました: ' + error.message); return }
    setGoals(prev => prev.map(g => g.id === id ? data : g))
  }

  async function deleteGoal(id) {
    const { error } = await supabase.from('goals').delete().eq('id', id)
    if (!error) setGoals(prev => prev.filter(g => g.id !== id))
  }

  return { goals, loading, addGoal, updateGoal, deleteGoal }
}
