import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useStockAnalyses(userId) {
  const [analyses, setAnalyses] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    fetchAnalyses()
  }, [userId])

  async function fetchAnalyses() {
    const { data } = await supabase
      .from('stock_analyses').select('*').eq('user_id', userId)
      .order('analyzed_on', { ascending: false })
      .order('created_at', { ascending: false })
    setAnalyses(data ?? [])
    setLoading(false)
  }

  function sortList(list) {
    return [...list].sort((a, b) =>
      (b.analyzed_on || '').localeCompare(a.analyzed_on || '') ||
      (new Date(b.created_at) - new Date(a.created_at))
    )
  }

  async function addAnalysis(item) {
    const { data, error } = await supabase
      .from('stock_analyses').insert([{ ...item, user_id: userId }]).select().single()
    if (error) { alert('保存に失敗しました: ' + error.message); return null }
    setAnalyses(prev => sortList([data, ...prev]))
    return data
  }

  async function updateAnalysis(id, updates) {
    const { data, error } = await supabase
      .from('stock_analyses').update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id).select().single()
    if (error) { alert('更新に失敗しました: ' + error.message); return }
    setAnalyses(prev => sortList(prev.map(a => a.id === id ? data : a)))
  }

  async function deleteAnalysis(id) {
    const { error } = await supabase.from('stock_analyses').delete().eq('id', id)
    if (!error) setAnalyses(prev => prev.filter(a => a.id !== id))
  }

  return { analyses, loading, addAnalysis, updateAnalysis, deleteAnalysis }
}
