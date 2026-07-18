import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const LOOKBACK_DAYS = 60

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function dateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function useDrinkTracker(userId) {
  const [entries, setEntries] = useState([])
  const [goal, setGoal] = useState({ weekday_grams: 20, weekend_grams: 40 })
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
        .from('drink_entries').select('*').eq('user_id', userId)
        .gte('entry_date', dateStr(since))
        .order('entry_date', { ascending: true })
        .order('created_at', { ascending: true }),
      supabase
        .from('drink_goals').select('*').eq('user_id', userId).maybeSingle(),
    ])
    setEntries(entriesRes.data ?? [])
    if (goalRes.data) setGoal(goalRes.data)
    setLoading(false)
  }

  async function addDrink({ grams, label }) {
    const row = { user_id: userId, entry_date: todayStr(), grams, label }
    const { data, error } = await supabase.from('drink_entries').insert([row]).select().single()
    if (error) { alert('記録の保存に失敗しました: ' + error.message); return }
    setEntries(prev => [...prev, data])
  }

  async function removeLastToday() {
    const today = todayStr()
    const todays = entries.filter(e => e.entry_date === today)
    if (todays.length === 0) return
    const last = todays[todays.length - 1]
    const { error } = await supabase.from('drink_entries').delete().eq('id', last.id)
    if (!error) setEntries(prev => prev.filter(e => e.id !== last.id))
  }

  async function markSober() {
    const today = todayStr()
    const { error } = await supabase.from('drink_entries').delete()
      .eq('user_id', userId).eq('entry_date', today)
    if (!error) setEntries(prev => prev.filter(e => e.entry_date !== today))
  }

  async function updateGoals(updates) {
    const next = { ...goal, ...updates, user_id: userId, updated_at: new Date().toISOString() }
    setGoal(next)
    const { error } = await supabase.from('drink_goals').upsert(next)
    if (error) alert('目安量の保存に失敗しました: ' + error.message)
  }

  return { entries, goal, loading, addDrink, removeLastToday, markSober, updateGoals }
}
