// Googleの同意画面から戻ってくるコールバック（Supabaseを介さず直接処理する）。
// フロントの「Googleドライブと連携」ボタンは、このAPIをredirect_uriとして
// GoogleのOAuth認可URLへ直接遷移する。stateにログイン中ユーザーのSupabase
// access_tokenを載せて渡し、ここでユーザーを特定してrefresh_tokenを保存する。
//
// 必要な環境変数: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
//                GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET

function getEnv() {
  return {
    url: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY,
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  }
}

async function verifyUser(url, anonKey, accessToken) {
  const r = await fetch(`${url.replace(/\/$/, '')}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${accessToken}` },
  })
  if (!r.ok) return null
  const data = await r.json()
  return data?.id ? data : null
}

function redirectWithStatus(res, status, message) {
  const params = new URLSearchParams({ drive: status, message: message || '' })
  res.writeHead(302, { Location: `/?${params.toString()}#assets` })
  res.end()
}

export default async function handler(req, res) {
  const { url, anonKey, serviceKey, clientId, clientSecret } = getEnv()
  if (!url || !anonKey || !serviceKey || !clientId || !clientSecret) {
    return redirectWithStatus(res, 'error', 'サーバーの環境変数が未設定です')
  }

  const { code, state, error: oauthError } = req.query
  if (oauthError) {
    return redirectWithStatus(res, 'error', `Google側でエラー: ${oauthError}`)
  }
  if (!code || !state) {
    return redirectWithStatus(res, 'error', 'codeまたはstateがありません')
  }

  const user = await verifyUser(url, anonKey, state)
  if (!user) {
    return redirectWithStatus(res, 'error', 'ログイン確認に失敗しました（再度ログインしてから試してください）')
  }

  try {
    const redirectUri = `https://${req.headers.host}/api/google-oauth-callback`
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    })
    const tokenData = await tokenRes.json().catch(() => ({}))
    if (!tokenRes.ok) {
      return redirectWithStatus(res, 'error', `トークン取得失敗: ${JSON.stringify(tokenData).slice(0, 300)}`)
    }
    if (!tokenData.refresh_token) {
      return redirectWithStatus(res, 'error', 'refresh_tokenが返されませんでした（既に許可済みの場合、Googleアカウントの権限画面から一度連携解除してから再試行してください）')
    }

    const saveRes = await fetch(`${url.replace(/\/$/, '')}/rest/v1/google_drive_tokens?on_conflict=user_id`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify([{ user_id: user.id, refresh_token: tokenData.refresh_token, updated_at: new Date().toISOString() }]),
    })
    if (!saveRes.ok) {
      const errBody = await saveRes.text().catch(() => '')
      return redirectWithStatus(res, 'error', `保存失敗: ${errBody.slice(0, 300)}`)
    }

    return redirectWithStatus(res, 'linked', '')
  } catch (err) {
    return redirectWithStatus(res, 'error', `${err?.name ?? 'Error'}: ${err?.message ?? 'unknown error'}`)
  }
}
