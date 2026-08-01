// GoogleドライブアクセスをこのSupabaseユーザーに紐付ける（リフレッシュトークンの保存）。
// フロントエンドは supabase.auth.linkIdentity() でGoogle認可を行った直後、
// セッションに含まれる provider_refresh_token をここに送る。
//
// 必要な環境変数: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

function getEnv() {
  return {
    url: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY,
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  }
}

function bearer(req) {
  const h = req.headers['authorization'] || req.headers['Authorization'] || ''
  const m = /^Bearer\s+(.+)$/i.exec(h)
  return m ? m[1].trim() : null
}

async function verifyUser(url, anonKey, accessToken) {
  const r = await fetch(`${url.replace(/\/$/, '')}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${accessToken}` },
  })
  if (!r.ok) return null
  const data = await r.json()
  return data?.id ? data : null
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS')
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  const { url, anonKey, serviceKey } = getEnv()
  if (!url || !anonKey || !serviceKey) {
    return res.status(500).json({ error: 'サーバーの環境変数が未設定です' })
  }

  const token = bearer(req)
  if (!token) return res.status(401).json({ error: '認証が必要です' })
  const user = await verifyUser(url, anonKey, token)
  if (!user) return res.status(401).json({ error: '認証に失敗しました' })

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
    const refreshToken = (body.refresh_token ?? '').toString().trim()
    if (!refreshToken) return res.status(400).json({ error: 'refresh_tokenが指定されていません' })

    const r = await fetch(`${url.replace(/\/$/, '')}/rest/v1/google_drive_tokens?on_conflict=user_id`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify([{ user_id: user.id, refresh_token: refreshToken, updated_at: new Date().toISOString() }]),
    })
    if (!r.ok) {
      const errBody = await r.json().catch(() => ({}))
      return res.status(r.status).json({ error: errBody })
    }
    return res.status(200).json({ linked: true })
  } catch (err) {
    return res.status(500).json({ error: `${err?.name ?? 'Error'}: ${err?.message ?? 'unknown error'}` })
  }
}
