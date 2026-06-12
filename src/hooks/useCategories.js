import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

const DEFAULTS = ['仕事', '個人', '買い物', '健康', 'その他']

export function useCategories() {
  const { user } = useAuth()
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    fetchCategories()
  }, [user?.id])

  async function fetchCategories() {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', user.id)
      .order('position', { ascending: true })
      .order('created_at', { ascending: true })

    if (error || !data || data.length === 0) {
      // 初回: デフォルトカテゴリを挿入
      const inserts = DEFAULTS.map((name, i) => ({ name, user_id: user.id, position: i }))
      const { data: inserted } = await supabase
        .from('categories').insert(inserts).select().order('position', { ascending: true })
      setCategories(inserted ?? [])
    } else {
      setCategories(data)
    }
    setLoading(false)
  }

  async function addCategory(name) {
    const trimmed = name.trim()
    if (!trimmed) return
    const { data, error } = await supabase
      .from('categories').insert([{ name: trimmed, user_id: user.id }]).select().single()
    if (!error) setCategories([...categories, data])
  }

  async function updateCategory(id, name) {
    const trimmed = name.trim()
    if (!trimmed) return
    const { data, error } = await supabase
      .from('categories').update({ name: trimmed }).eq('id', id).select().single()
    if (!error) setCategories(categories.map(c => c.id === id ? data : c))
  }

  async function deleteCategory(id) {
    const { error } = await supabase.from('categories').delete().eq('id', id)
    if (!error) setCategories(categories.filter(c => c.id !== id))
  }

  async function reorderCategories(activeId, overId) {
    const oldIndex = categories.findIndex(c => c.id === activeId)
    const newIndex = categories.findIndex(c => c.id === overId)
    if (oldIndex === -1 || newIndex === -1) return

    const reordered = [...categories]
    const [moved] = reordered.splice(oldIndex, 1)
    reordered.splice(newIndex, 0, moved)

    setCategories(reordered)
    await Promise.all(
      reordered.map((c, i) => supabase.from('categories').update({ position: i }).eq('id', c.id))
    )
  }

  return { categories, loading, addCategory, updateCategory, deleteCategory, reorderCategories }
}
