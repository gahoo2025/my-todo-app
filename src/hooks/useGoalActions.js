import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useGoalActions(goalId) {
  const [actions, setActions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!goalId) { setActions([]); setLoading(false); return }
    fetchActions()
  }, [goalId])

  async function fetchActions() {
    setLoading(true)
    const { data } = await supabase
      .from('goal_actions').select('*').eq('goal_id', goalId)
      .order('created_at', { ascending: true })
    setActions(data ?? [])
    setLoading(false)
  }

  async function addAction(action) {
    const { data, error } = await supabase
      .from('goal_actions').insert([{ ...action, goal_id: goalId }]).select().single()
    if (error) { alert('アクションの保存に失敗しました: ' + error.message); return null }
    setActions(prev => [...prev, data])
    return data
  }

  async function updateAction(id, updates) {
    const { data, error } = await supabase
      .from('goal_actions').update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id).select().single()
    if (error) { alert('更新に失敗しました: ' + error.message); return }
    setActions(prev => prev.map(a => a.id === id ? data : a))
  }

  async function deleteAction(id) {
    const { error } = await supabase.from('goal_actions').delete().eq('id', id)
    if (!error) setActions(prev => prev.filter(a => a.id !== id))
  }

  return { actions, loading, addAction, updateAction, deleteAction }
}
