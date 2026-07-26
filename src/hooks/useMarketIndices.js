import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export const INDEX_SYMBOLS = [
  { id: 'nikkei225', label: '日経平均' },
  { id: 'topix',     label: 'TOPIX' },
  { id: 'usdjpy',    label: 'ドル円' },
  { id: 'vt',        label: 'VT' },
  { id: 'sp500',     label: 'S&P500' },
  { id: 'dow',       label: 'NYダウ' },
  { id: 'nasdaq',    label: 'ナスダック' },
]

export function useMarketIndices(userId) {
  const [latestBySymbol, setLatestBySymbol] = useState({})
  const [counts, setCounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const [historyBySymbol, setHistoryBySymbol] = useState({})
  const [historyLoading, setHistoryLoading] = useState({})

  useEffect(() => {
    if (!userId) return
    fetchSummary()
  }, [userId])

  async function fetchSummary() {
    setLoading(true)
    const results = await Promise.all(
      INDEX_SYMBOLS.map(({ id }) =>
        supabase
          .from('market_index_history').select('trade_date, value', { count: 'exact' })
          .eq('user_id', userId).eq('symbol', id)
          .order('trade_date', { ascending: false }).limit(2)
      )
    )
    const latest = {}
    const cnt = {}
    results.forEach((res, i) => {
      const symbol = INDEX_SYMBOLS[i].id
      const [current, previous] = res.data ?? []
      latest[symbol] = current
        ? { ...current, prevValue: previous ? Number(previous.value) : null, prevDate: previous?.trade_date ?? null }
        : null
      cnt[symbol] = res.count ?? 0
    })
    setLatestBySymbol(latest)
    setCounts(cnt)
    setLoading(false)
  }

  async function importFromSheet() {
    setImporting(true)
    setImportResult(null)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      if (!token) {
        setImportResult({ error: 'ログイン情報が取得できませんでした' })
        return
      }
      const r = await fetch('/api/import-market-index', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const body = await r.json()
      if (!r.ok) {
        setImportResult({
          error: body?.error?.message || body?.error || '取り込みに失敗しました',
          debugSheets: body?.debugSheets,
        })
        return
      }
      setImportResult({ success: true, counts: body.counts, inserted: body.inserted })
      await fetchSummary()
    } catch (err) {
      setImportResult({ error: err?.message ?? '不明なエラー' })
    } finally {
      setImporting(false)
    }
  }

  async function fetchHistory(symbol) {
    if (historyBySymbol[symbol]) return
    setHistoryLoading(prev => ({ ...prev, [symbol]: true }))
    const { data } = await supabase
      .from('market_index_history').select('trade_date, value')
      .eq('user_id', userId).eq('symbol', symbol)
      .order('trade_date', { ascending: true })
      .limit(20000)
    setHistoryBySymbol(prev => ({ ...prev, [symbol]: data ?? [] }))
    setHistoryLoading(prev => ({ ...prev, [symbol]: false }))
  }

  return {
    latestBySymbol, counts, loading, importing, importResult, importFromSheet,
    historyBySymbol, historyLoading, fetchHistory,
  }
}
