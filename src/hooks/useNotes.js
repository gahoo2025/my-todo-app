import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useNotes(userId) {
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    fetchNotes()
  }, [userId])

  async function fetchNotes() {
    const { data } = await supabase
      .from('notes').select('*').eq('user_id', userId)
      .order('pinned', { ascending: false })
      .order('updated_at', { ascending: false })
    setNotes(data ?? [])
    setLoading(false)
  }

  function sortNotes(list) {
    return [...list].sort((a, b) =>
      (b.pinned - a.pinned) || (new Date(b.updated_at) - new Date(a.updated_at))
    )
  }

  async function addNote(note) {
    const { data, error } = await supabase
      .from('notes').insert([{ ...note, user_id: userId }]).select().single()
    if (error) { alert('メモの保存に失敗しました: ' + error.message); return null }
    setNotes(prev => sortNotes([data, ...prev]))
    return data
  }

  async function updateNote(id, updates) {
    const { data, error } = await supabase
      .from('notes').update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id).select().single()
    if (error) { alert('更新に失敗しました: ' + error.message); return }
    setNotes(prev => sortNotes(prev.map(n => n.id === id ? data : n)))
  }

  async function deleteNote(id) {
    const { error } = await supabase.from('notes').delete().eq('id', id)
    if (!error) setNotes(prev => prev.filter(n => n.id !== id))
  }

  return { notes, loading, addNote, updateNote, deleteNote }
}
