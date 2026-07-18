import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

function sortEntries(list) {
  return [...list].sort((a, b) =>
    (b.record_date || '').localeCompare(a.record_date || '') ||
    (new Date(b.created_at) - new Date(a.created_at))
  )
}

export function useStockLogs(userId) {
  const [entries, setEntries] = useState([])   // 各entryに stocks/todos を内包
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    fetchAll()
  }, [userId])

  async function fetchAll() {
    setLoading(true)
    const [entriesRes, stocksRes, todosRes] = await Promise.all([
      supabase.from('stock_log_entries').select('*').eq('user_id', userId)
        .order('record_date', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('stock_log_stocks').select('*').eq('user_id', userId)
        .order('position', { ascending: true }),
      supabase.from('stock_log_todos').select('*').eq('user_id', userId)
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

  // parsed: { weekLabel, recordDate, marketSummary, stocks, todos, parseFailed }
  async function addEntry(parsed, rawText) {
    const { data: entry, error } = await supabase.from('stock_log_entries').insert([{
      user_id: userId,
      week_label: parsed.weekLabel,
      record_date: parsed.recordDate,
      raw_text: rawText,
      market_summary: parsed.marketSummary,
      parse_failed: parsed.parseFailed,
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

  async function insertStocks(logId, stocks) {
    if (!stocks?.length) return []
    const rows = stocks.map((s, i) => ({
      log_id: logId, user_id: userId,
      name: s.name, code: s.code, score: s.score, status: s.status, position: i,
    }))
    const { data, error } = await supabase.from('stock_log_stocks').insert(rows).select()
    if (error) { alert('銘柄の保存に失敗しました: ' + error.message); return [] }
    return data
  }

  async function insertTodos(logId, todos) {
    if (!todos?.length) return []
    const rows = todos.map((t, i) => ({
      log_id: logId, user_id: userId,
      todo_date: t.date, content: t.content, done: t.done, position: i,
    }))
    const { data, error } = await supabase.from('stock_log_todos').insert(rows).select()
    if (error) { alert('TODOの保存に失敗しました: ' + error.message); return [] }
    return data
  }

  // 再解析して丸ごと更新（編集フロー用）
  async function replaceEntry(logId, parsed, rawText) {
    const { data: entry, error } = await supabase.from('stock_log_entries').update({
      week_label: parsed.weekLabel,
      record_date: parsed.recordDate,
      raw_text: rawText,
      market_summary: parsed.marketSummary,
      parse_failed: parsed.parseFailed,
      updated_at: new Date().toISOString(),
    }).eq('id', logId).select().single()
    if (error) { alert('更新に失敗しました: ' + error.message); return null }

    await Promise.all([
      supabase.from('stock_log_stocks').delete().eq('log_id', logId),
      supabase.from('stock_log_todos').delete().eq('log_id', logId),
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
    const { error } = await supabase.from('stock_log_todos').update({ done: !done }).eq('id', todoId)
    if (error) return
    setEntries(prev => prev.map(e => ({
      ...e,
      todos: e.todos.map(t => t.id === todoId ? { ...t, done: !done } : t),
    })))
  }

  async function deleteEntry(logId) {
    const { error } = await supabase.from('stock_log_entries').delete().eq('id', logId)
    if (!error) setEntries(prev => prev.filter(e => e.id !== logId))
  }

  return { entries, loading, addEntry, replaceEntry, toggleTodo, deleteEntry }
}
