import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const LOOKBACK_DAYS = 90

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function dateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function useWeightTracker(userId) {
  const [entries, setEntries] = useState([])
  const [goal, setGoal] = useState({ target_kg: null })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    fetchAll()
  }, [userId])

  async function fetchAll() {
    const since = new Date()
    since.setDate(since.getDate() - (LOOKBACK_DAYS - 1))
    const [entriesRes, goalRes] = await Promise.all([
      supabase
        .from('weight_entries').select('*').eq('user_id', userId)
        .gte('entry_date', dateStr(since))
        .order('entry_date', { ascending: true }),
      supabase
        .from('weight_goals').select('*').eq('user_id', userId).maybeSingle(),
    ])
    setEntries(entriesRes.data ?? [])
    if (goalRes.data) setGoal(goalRes.data)
    setLoading(false)
  }

  // 今日の体重を記録（同日なら上書き）
  async function recordToday(weightKg) {
    const row = { user_id: userId, entry_date: todayStr(), weight_kg: weightKg }
    const { data, error } = await supabase
      .from('weight_entries')
      .upsert(row, { onConflict: 'user_id,entry_date' })
      .select().single()
    if (error) { alert('体重の保存に失敗しました: ' + error.message); return }
    setEntries(prev => {
      const rest = prev.filter(e => e.entry_date !== data.entry_date)
      return [...rest, data].sort((a, b) => a.entry_date.localeCompare(b.entry_date))
    })
  }

  async function deleteEntry(id) {
    const { error } = await supabase.from('weight_entries').delete().eq('id', id)
    if (!error) setEntries(prev => prev.filter(e => e.id !== id))
  }

  async function updateGoal(targetKg) {
    const next = { user_id: userId, target_kg: targetKg, updated_at: new Date().toISOString() }
    setGoal(next)
    const { error } = await supabase.from('weight_goals').upsert(next)
    if (error) alert('目標体重の保存に失敗しました: ' + error.message)
  }

  return { entries, goal, loading, recordToday, deleteEntry, updateGoal }
}
