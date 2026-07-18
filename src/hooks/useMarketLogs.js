import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

function sortEntries(list) {
  return [...list].sort((a, b) => new Date(b.entry_at) - new Date(a.entry_at))
}

export function useMarketLogs(userId) {
  const [entries, setEntries] = useState([])   // 各entryに stocks/todos を内包
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    fetchAll()
  }, [userId])

  async function fetchAll() {
    setLoading(true)
    const [entriesRes, stocksRes, todosRes] = await Promise.all([
      supabase.from('market_log_entries').select('*').eq('user_id', userId)
        .order('entry_at', { ascending: false }),
      supabase.from('market_log_stocks').select('*').eq('user_id', userId)
        .order('position', { ascending: true }),
      supabase.from('market_log_todos').select('*').eq('user_id', userId)
        .order('position', { ascending: true }),
    ])
    const stocksByLog = {}
    for (const s of stocksRes.data ?? []) {
      (stocksByLog[s.log_id] ??= []).push(s)
    }
    const todosByLog = {}
    for (const t of todosRes.data ?? []) {
      (todosByLog[t.log_id] ??= []).push(t)
    }
    const merged = (entriesRes.data ?? []).map(e => ({
      ...e,
      stocks: stocksByLog[e.id] ?? [],
      todos: todosByLog[e.id] ?? [],
    }))
    setEntries(sortEntries(merged))
    setLoading(false)
  }

  async function insertStocks(logId, stocks) {
    if (!stocks?.length) return []
    const rows = stocks.map((s, i) => ({
      log_id: logId, user_id: userId,
      block: s.block, name: s.name, code: s.code, score: s.score, position: i,
    }))
    const { data, error } = await supabase.from('market_log_stocks').insert(rows).select()
    if (error) { alert('銘柄の保存に失敗しました: ' + error.message); return [] }
    return data
  }

  async function insertTodos(logId, todos) {
    if (!todos?.length) return []
    const rows = todos.map((t, i) => ({
      log_id: logId, user_id: userId, content: t.content, done: t.done, position: i,
    }))
    const { data, error } = await supabase.from('market_log_todos').insert(rows).select()
    if (error) { alert('TODOの保存に失敗しました: ' + error.message); return [] }
    return data
  }

  // parsed: { actual, outlook, stocks, todos }, entryAt: ISO string
  async function addEntry(parsed, entryAt, rawText) {
    const { data: entry, error } = await supabase.from('market_log_entries').insert([{
      user_id: userId,
      entry_at: entryAt,
      actual: parsed.actual || null,
      outlook: parsed.outlook || null,
      raw_text: rawText || null,
    }]).select().single()
    if (error) { alert('保存に失敗しました: ' + error.message); return null }

    const [stocks, todos] = await Promise.all([
      insertStocks(entry.id, parsed.stocks),
      insertTodos(entry.id, parsed.todos),
    ])
    const merged = { ...entry, stocks, todos }
    setEntries(prev => sortEntries([merged, ...prev]))
    return merged
  }

  async function replaceEntry(logId, parsed, entryAt, rawText) {
    const { data: entry, error } = await supabase.from('market_log_entries').update({
      entry_at: entryAt,
      actual: parsed.actual || null,
      outlook: parsed.outlook || null,
      raw_text: rawText || null,
      updated_at: new Date().toISOString(),
    }).eq('id', logId).select().single()
    if (error) { alert('更新に失敗しました: ' + error.message); return null }

    await Promise.all([
      supabase.from('market_log_stocks').delete().eq('log_id', logId),
      supabase.from('market_log_todos').delete().eq('log_id', logId),
    ])
    const [stocks, todos] = await Promise.all([
      insertStocks(logId, parsed.stocks),
      insertTodos(logId, parsed.todos),
    ])
    const merged = { ...entry, stocks, todos }
    setEntries(prev => sortEntries(prev.map(e => e.id === logId ? merged : e)))
    return merged
  }

  async function toggleTodo(todoId, done) {
    const { error } = await supabase.from('market_log_todos').update({ done: !done }).eq('id', todoId)
    if (error) return
    setEntries(prev => prev.map(e => ({
      ...e,
      todos: e.todos.map(t => t.id === todoId ? { ...t, done: !done } : t),
    })))
  }

  async function deleteEntry(logId) {
    const { error } = await supabase.from('market_log_entries').delete().eq('id', logId)
    if (!error) setEntries(prev => prev.filter(e => e.id !== logId))
  }

  return { entries, loading, addEntry, replaceEntry, toggleTodo, deleteEntry }
}
