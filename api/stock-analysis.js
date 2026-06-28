// Vercel Serverless Function: 個別銘柄の分析結果を登録 / 取得する API
//
// 必要な環境変数（Vercel のプロジェクト設定で登録）:
//   SUPABASE_URL                … Supabase プロジェクト URL（VITE_SUPABASE_URL と同じ値で可）
//   SUPABASE_SERVICE_ROLE_KEY   … service_role キー（RLS をバイパスする強力なキー。サーバー側のみ）
//   INGEST_TOKEN                … この API を呼ぶための共有シークレット（自分で発行）
//   INGEST_USER_ID              … 登録先ユーザーの user_id（auth.users の id）
//
// 使い方:
//   POST /api/stock-analysis
//     Header: Authorization: Bearer <INGEST_TOKEN>
//     Body(JSON): { "title": "トヨタ自動車 7203", "memo": "## 分析\n...", "analyzed_on": "2026-06-14" }
//   GET /api/stock-analysis?limit=10
//     Header: Authorization: Bearer <INGEST_TOKEN>   … 直近の登録を確認

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getEnv() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const token = process.env.INGEST_TOKEN
  const userId = process.env.INGEST_USER_ID
  return { url, serviceKey, token, userId }
}

function bearer(req) {
  const h = req.headers['authorization'] || req.headers['Authorization'] || ''
  const m = /^Bearer\s+(.+)$/i.exec(h)
  return m ? m[1].trim() : null
}

export default async function handler(req, res) {
  // CORS（ブラウザからの利用も想定して許可。認証はトークンで担保）
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
  if (req.method === 'OPTIONS') return res.status(204).end()

  const { url, serviceKey, token, userId } = getEnv()
  if (!url || !serviceKey || !token || !userId) {
    return res.status(500).json({ error: 'サーバーの環境変数が未設定です（SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / INGEST_TOKEN / INGEST_USER_ID）' })
  }

  // トークン認証
  if (bearer(req) !== token) {
    return res.status(401).json({ error: '認証に失敗しました' })
  }

  const base = `${url.replace(/\/$/, '')}/rest/v1/stock_analyses`
  const commonHeaders = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  }

  try {
    if (req.method === 'GET') {
      const limit = Math.min(parseInt(req.query?.limit ?? '10', 10) || 10, 100)
      const q = `${base}?user_id=eq.${encodeURIComponent(userId)}&order=analyzed_on.desc,created_at.desc&limit=${limit}`
      const r = await fetch(q, { headers: commonHeaders })
      const data = await r.json()
      if (!r.ok) return res.status(r.status).json({ error: data })
      return res.status(200).json({ items: data })
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
      const title = (body.title ?? '').toString().trim()
      if (!title) return res.status(400).json({ error: 'title（企業名・銘柄コード）は必須です' })

      const memo = body.memo != null && body.memo.toString().trim() !== '' ? body.memo.toString() : null
      let analyzedOn = (body.analyzed_on ?? '').toString().trim()
      if (!/^\d{4}-\d{2}-\d{2}$/.test(analyzedOn)) analyzedOn = todayStr()

      const row = { user_id: userId, title, memo, analyzed_on: analyzedOn }
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
