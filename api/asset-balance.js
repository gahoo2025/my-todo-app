// Vercel Serverless Function: 資産残高（株式・投資信託）を登録 / 取得する API
//
// 必要な環境変数（stock-analysis.js と共通）:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, INGEST_TOKEN, INGEST_USER_ID
//
// 使い方:
//   POST /api/asset-balance
//     Header: Authorization: Bearer <INGEST_TOKEN>
//     Body(JSON): { "kind": "stock", "amount": 1234567, "as_of": "2026-07-05" }
//       kind   … "stock"（株式） または "fund"（投資信託）
//       amount … 資産額（円、数値）
//       as_of  … いつ時点か（省略時はサーバーの当日）
//   GET /api/asset-balance            … 直近の残高一覧
//   GET /api/asset-balance?latest=1   … 種類ごとの最新値のみ

const KINDS = ['stock', 'fund']

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

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

  const base = `${url.replace(/\/$/, '')}/rest/v1/asset_balances`
  const commonHeaders = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  }

  try {
    if (req.method === 'GET') {
      const q = `${base}?user_id=eq.${encodeURIComponent(userId)}&order=as_of.desc,created_at.desc&limit=50`
      const r = await fetch(q, { headers: commonHeaders })
      const data = await r.json()
      if (!r.ok) return res.status(r.status).json({ error: data })
      if (req.query?.latest) {
        const latest = {}
        for (const b of data) if (!latest[b.kind]) latest[b.kind] = b
        return res.status(200).json({ latest })
      }
      return res.status(200).json({ items: data })
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
      const kind = (body.kind ?? '').toString().trim()
      if (!KINDS.includes(kind)) {
        return res.status(400).json({ error: 'kind は "stock"（株式）または "fund"（投資信託）を指定してください' })
      }
      const amount = Number(body.amount)
      if (!Number.isFinite(amount)) {
        return res.status(400).json({ error: 'amount（資産額）は数値で指定してください' })
      }
      let asOf = (body.as_of ?? '').toString().trim()
      if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf)) asOf = todayStr()

      const row = { user_id: userId, kind, amount, as_of: asOf }
      const r = await fetch(base, {
        method: 'POST',
        headers: { ...commonHeaders, Prefer: 'return=representation' },
        body: JSON.stringify(row),
      })
      const data = await r.json()
      if (!r.ok) return res.status(r.status).json({ error: data })
      return res.status(201).json({ item: Array.isArray(data) ? data[0] : data })
    }

    res.setHeader('Allow', 'GET, POST, OPTIONS')
    return res.status(405).json({ error: 'Method Not Allowed' })
  } catch (err) {
    return res.status(500).json({ error: err?.message ?? 'unknown error' })
  }
}
