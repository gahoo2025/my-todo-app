import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useEvents(userId) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    fetchEvents()
  }, [userId])

  async function fetchEvents() {
    const { data } = await supabase
      .from('events').select('*').eq('user_id', userId)
      .order('start_at', { ascending: true })
    setEvents(data ?? [])
    setLoading(false)
  }

  async function addEvent(ev) {
    const { data, error } = await supabase
      .from('events').insert([{ ...ev, user_id: userId }]).select().single()
    if (error) { alert('予定の保存に失敗しました: ' + error.message); return null }
    setEvents(prev => [...prev, data].sort((a, b) => new Date(a.start_at) - new Date(b.start_at)))
    return data
  }

  async function updateEvent(id, updates) {
    const { data, error } = await supabase
      .from('events').update(updates).eq('id', id).select().single()
    if (error) { alert('更新に失敗しました: ' + error.message); return }
    setEvents(prev => prev.map(e => e.id === id ? data : e))
  }

  async function deleteEvent(id) {
    const { error } = await supabase.from('events').delete().eq('id', id)
    if (!error) setEvents(prev => prev.filter(e => e.id !== id))
  }

  return { events, loading, addEvent, updateEvent, deleteEvent }
}
