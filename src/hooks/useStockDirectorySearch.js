import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

// 個別銘柄分析(title: "企業名 コード")とマーケットログ(name/code)から
// 過去に入力された銘柄名・コードを検索し、候補として返す
function splitAnalysisTitle(title) {
  const m = title.trim().match(/^(.*?)[\s　]+([0-9A-Za-z]{2,6})$/)
  if (m) return { name: m[1].trim(), code: m[2].trim() }
  return { name: title.trim(), code: null }
}

export function useStockDirectorySearch(userId, query) {
  const [candidates, setCandidates] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const q = query.trim()
    if (!userId || q.length < 1) { setCandidates([]); return }
    let cancelled = false
    setLoading(true)
    const timer = setTimeout(async () => {
      const like = `%${q}%`
      const [analysesRes, stocksRes] = await Promise.all([
        supabase.from('stock_analyses').select('title').eq('user_id', userId).ilike('title', like).limit(10),
        supabase.from('market_log_stocks').select('name, code').eq('user_id', userId)
          .or(`name.ilike.${like},code.ilike.${like}`).limit(10),
      ])
      if (cancelled) return

      const seen = new Set()
      const results = []
      for (const row of stocksRes.data ?? []) {
        const key = `${row.name}__${row.code}`
        if (seen.has(key)) continue
        seen.add(key)
        results.push({ name: row.name, code: row.code })
      }
      for (const row of analysesRes.data ?? []) {
        const { name, code } = splitAnalysisTitle(row.title)
        const key = `${name}__${code}`
        if (seen.has(key)) continue
        seen.add(key)
        results.push({ name, code })
      }
      setCandidates(results.slice(0, 8))
      setLoading(false)
    }, 200)

    return () => { cancelled = true; clearTimeout(timer) }
  }, [userId, query])

  return { candidates, loading }
}
