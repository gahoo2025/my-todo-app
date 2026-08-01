import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useStockList(userId) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)

  const fetchList = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    const { data } = await supabase
      .from('stock_master_list')
      .select('*')
      .eq('user_id', userId)
      .order('symbol_code', { ascending: true })
    setItems(data ?? [])
    setLoading(false)
  }, [userId])

  useEffect(() => { fetchList() }, [fetchList])

  async function importList() {
    setImporting(true)
    setImportResult(null)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      if (!token) {
        setImportResult({ error: 'ログイン情報が取得できませんでした' })
        return
      }
      const r = await fetch('/api/import-stock-list', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const text = await r.text()
      let body
      try { body = JSON.parse(text) } catch {
        setImportResult({ error: `サーバー応答を解析できませんでした（HTTP ${r.status}）` })
        return
      }
      if (!r.ok) {
        setImportResult({ error: body?.error?.message || body?.error || '取り込みに失敗しました', warnings: body?.warnings })
        return
      }
      setImportResult({ success: true, imported: body.imported, warnings: body.warnings })
      await fetchList()
    } catch (err) {
      setImportResult({ error: `${err?.name ?? 'Error'}: ${err?.message ?? String(err)}` })
    } finally {
      setImporting(false)
    }
  }

  return { items, loading, importing, importResult, importList, refetch: fetchList }
}
