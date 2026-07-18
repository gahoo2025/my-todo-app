import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const LOOKBACK_DAYS = 60

function dateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function useExerciseTracker(userId) {
  const [menuItems, setMenuItems] = useState([])
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    fetchAll()
  }, [userId])

  async function fetchAll() {
    setLoading(true)
    const since = new Date()
    since.setDate(since.getDate() - (LOOKBACK_DAYS - 1))
    const [menuRes, logsRes] = await Promise.all([
      supabase.from('exercise_menu_items').select('*').eq('user_id', userId)
        .order('position', { ascending: true }),
      supabase.from('exercise_logs').select('*').eq('user_id', userId)
        .gte('log_date', dateStr(since))
        .order('log_date', { ascending: false })
        .order('created_at', { ascending: false }),
    ])
    setMenuItems(menuRes.data ?? [])
    setLogs(logsRes.data ?? [])
    setLoading(false)
  }

  async function addMenuItem(item) {
    const row = { ...item, user_id: userId, position: menuItems.length }
    const { data, error } = await supabase.from('exercise_menu_items').insert([row]).select().single()
    if (error) { alert('メニューの保存に失敗しました: ' + error.message); return null }
    setMenuItems(prev => [...prev, data])
    return data
  }

  async function updateMenuItem(id, updates) {
    const { data, error } = await supabase.from('exercise_menu_items')
      .update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select().single()
    if (error) { alert('更新に失敗しました: ' + error.message); return }
    setMenuItems(prev => prev.map(m => m.id === id ? data : m))
  }

  async function deleteMenuItem(id) {
    const { error } = await supabase.from('exercise_menu_items').delete().eq('id', id)
    if (!error) setMenuItems(prev => prev.filter(m => m.id !== id))
  }

  async function addLog({ menuItemId, name, value, unit, logDate, memo }) {
    const row = {
      user_id: userId, menu_item_id: menuItemId ?? null,
      name, value: value ?? null, unit: unit ?? null,
      log_date: logDate, memo: memo || null,
    }
    const { data, error } = await supabase.from('exercise_logs').insert([row]).select().single()
    if (error) { alert('記録の保存に失敗しました: ' + error.message); return null }
    setLogs(prev => [data, ...prev])
    return data
  }

  async function deleteLog(id) {
    const { error } = await supabase.from('exercise_logs').delete().eq('id', id)
    if (!error) setLogs(prev => prev.filter(l => l.id !== id))
  }

  return { menuItems, logs, loading, addMenuItem, updateMenuItem, deleteMenuItem, addLog, deleteLog }
}
