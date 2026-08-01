// このSupabaseユーザーがGoogleドライブ連携済みかどうかを返す。
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS')
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

  const r = await fetch(
    `${url.replace(/\/$/, '')}/rest/v1/google_drive_tokens?select=user_id&user_id=eq.${user.id}&limit=1`,
    { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
  )
  if (!r.ok) return res.status(200).json({ linked: false })
  const data = await r.json().catch(() => [])
  return res.status(200).json({ linked: (data?.length ?? 0) > 0 })
}
