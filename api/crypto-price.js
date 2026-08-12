// Vercel Serverless Function: 暗号資産（ビットコイン等）の日次価格を登録 / 取得する API
//
// market_index_history テーブル（指標データタブが使うのと同じテーブル）に、
// symbol='bitcoin' として直接書き込む。これにより、ローカルのbitcoin-csv-update
// スキルがbitcoin.csvを更新した直後に、Google Driveを経由せず直接DBへ反映できる。
//
// 必要な環境変数（stock-analysis.js・asset-balance.js と共通）:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, INGEST_TOKEN, INGEST_USER_ID
//
// 使い方:
//   POST /api/crypto-price
//     Header: Authorization: Bearer <INGEST_TOKEN>
//     Body(JSON): {
//       "symbol": "bitcoin",   … 省略時は "bitcoin"
//       "points": [
//         { "trade_date": "2026-08-12", "value": 64914.7 },
//         { "trade_date": "2026-08-13", "value": 65200.0 }
//       ]
//     }
//     既存の同じ (symbol, trade_date) の行は上書きされる（当日値の更新に対応）。
//   GET /api/crypto-price?symbol=bitcoin&limit=10   … 直近の登録を確認

function getEnv() {
  return {
    url: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    token: process.env.INGEST_TOKEN,
    userId: process.env.INGEST_USER_ID,
  }
}

function bearer(req) {
  const h = req.headers['authorization'] || req.headers['Authorization'] || ''
  const m = /^Bearer\s+(.+)$/i.exec(h)
  return m ? m[1].trim() : null
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
  if (req.method === 'OPTIONS') return res.status(204).end()

  const { url, serviceKey, token, userId } = getEnv()
  if (!url || !serviceKey || !token || !userId) {
    return res.status(500).json({ error: 'サーバーの環境変数が未設定です' })
  }
  if (bearer(req) !== token) {
    return res.status(401).json({ error: '認証に失敗しました' })
  }

  const base = `${url.replace(/\/$/, '')}/rest/v1/market_index_history`
  const commonHeaders = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  }

  try {
    if (req.method === 'GET') {
      const symbol = (req.query?.symbol ?? 'bitcoin').toString().trim()
      const limit = Math.min(Number(req.query?.limit) || 10, 100)
      const q = `${base}?user_id=eq.${encodeURIComponent(userId)}&symbol=eq.${encodeURIComponent(symbol)}&select=trade_date,value&order=trade_date.desc&limit=${limit}`
      const r = await fetch(q, { headers: commonHeaders })
      const data = await r.json()
      if (!r.ok) return res.status(r.status).json({ error: data })
      return res.status(200).json({ symbol, items: data })
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
      const symbol = (body.symbol ?? 'bitcoin').toString().trim() || 'bitcoin'
      const points = Array.isArray(body.points) ? body.points : null
      if (!points || points.length === 0) {
        return res.status(400).json({ error: 'points（配列）は必須です。例: [{"trade_date":"2026-08-12","value":64914.7}]' })
      }

      const rows = []
      for (const p of points) {
        const tradeDate = (p?.trade_date ?? '').toString().trim()
        const value = Number(p?.value)
        if (!DATE_RE.test(tradeDate)) {
          return res.status(400).json({ error: `trade_dateはYYYY-MM-DD形式で指定してください: ${JSON.stringify(p)}` })
        }
        if (!Number.isFinite(value)) {
          return res.status(400).json({ error: `valueは数値で指定してください: ${JSON.stringify(p)}` })
        }
        rows.push({ user_id: userId, symbol, trade_date: tradeDate, value })
      }

      const upsertHeaders = { ...commonHeaders, Prefer: 'resolution=merge-duplicates,return=representation' }
      const r = await fetch(`${base}?on_conflict=user_id,symbol,trade_date`, {
        method: 'POST',
        headers: upsertHeaders,
        body: JSON.stringify(rows),
      })
      const data = await r.json()
      if (!r.ok) return res.status(r.status).json({ error: data })
      return res.status(200).json({ symbol, upserted: Array.isArray(data) ? data.length : rows.length })
    }

    res.setHeader('Allow', 'GET, POST, OPTIONS')
    return res.status(405).json({ error: 'Method Not Allowed' })
  } catch (err) {
    return res.status(500).json({ error: err?.message ?? 'unknown error' })
  }
}
