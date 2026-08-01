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
  { id: 'bitcoin',   label: 'ビットコイン' },
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
    let step = 'getSession'
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      if (!token) {
        setImportResult({ error: 'ログイン情報が取得できませんでした' })
        return
      }

      step = 'fetch'
      const r = await fetch('/api/import-market-index', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })

      step = 'readText'
      const text = await r.text()

      step = 'parseJson'
      let body
      try {
        body = JSON.parse(text)
      } catch {
        setImportResult({
          error: `サーバーからの応答を解析できませんでした（HTTP ${r.status}）`,
          debugSheets: [{ rawResponseSnippet: text.slice(0, 800) }],
        })
        return
      }

      if (!r.ok) {
        setImportResult({
          error: body?.error?.message || body?.error || '取り込みに失敗しました',
          debugSheets: body?.debugSheets || (body?.stack ? [{ stack: body.stack }] : undefined),
        })
        return
      }
      setImportResult({ success: true, counts: body.counts, inserted: body.inserted, warnings: body.warnings })

      step = 'fetchSummary'
      await fetchSummary()
    } catch (err) {
      setImportResult({
        error: `[${step}] ${err?.name ?? 'Error'}: ${err?.message ?? String(err)}`,
        debugSheets: err?.stack ? [{ stack: String(err.stack).slice(0, 1200) }] : undefined,
      })
    } finally {
      setImporting(false)
    }
  }

  // SupabaseはPostgRESTのmax-rows設定（既定1000件）により1回のリクエストで
  // 返せる件数に上限があるため、.range() でページングして全件取得する
  async function fetchHistory(symbol) {
    if (historyBySymbol[symbol]) return
    setHistoryLoading(prev => ({ ...prev, [symbol]: true }))
    const pageSize = 1000
    const all = []
    let from = 0
    while (true) {
      const { data, error } = await supabase
        .from('market_index_history').select('trade_date, value')
        .eq('user_id', userId).eq('symbol', symbol)
        .order('trade_date', { ascending: true })
        .range(from, from + pageSize - 1)
      if (error || !data) break
      all.push(...data)
      if (data.length < pageSize) break
      from += pageSize
    }
    setHistoryBySymbol(prev => ({ ...prev, [symbol]: all }))
    setHistoryLoading(prev => ({ ...prev, [symbol]: false }))
  }

  return {
    latestBySymbol, counts, loading, importing, importResult, importFromSheet,
    historyBySymbol, historyLoading, fetchHistory,
  }
}
