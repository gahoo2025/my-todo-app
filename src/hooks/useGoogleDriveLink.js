import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const GOOGLE_CLIENT_ID = '53489147565-g66dmfi0q7egshumsbk0ot6h8kktllj6.apps.googleusercontent.com'

// Googleドライブのファイルを読むための認可を、Supabaseを介さず直接Googleの
// OAuthエンドポイントへリダイレクトして行う。戻り先は api/google-oauth-callback.js。
export function useGoogleDriveLink(userId) {
  const [linked, setLinked] = useState(null) // null=未確認, true/false
  const [linking, setLinking] = useState(false)
  const [error, setError] = useState(null)
  const [pendingUrl, setPendingUrl] = useState(null)

  const checkStatus = useCallback(async () => {
    if (!userId) return
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData?.session?.access_token
    if (!token) return
    const r = await fetch('/api/google-drive-status', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!r.ok) return
    const body = await r.json().catch(() => ({}))
    setLinked(!!body.linked)
  }, [userId])

  useEffect(() => { checkStatus() }, [checkStatus])

  // コールバックからのリダイレクト直後、URLの ?drive=linked|error を読み取って表示する
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const drive = params.get('drive')
    if (!drive) return
    if (drive === 'linked') setLinked(true)
    if (drive === 'error') setError(params.get('message') || '連携に失敗しました')
    params.delete('drive')
    params.delete('message')
    const rest = params.toString()
    window.history.replaceState({}, '', window.location.pathname + (rest ? `?${rest}` : '') + window.location.hash)
  }, [])

  async function linkDrive() {
    setLinking(true)
    setError(null)
    const { data: sessionData } = await supabase.auth.getSession()
    const accessToken = sessionData?.session?.access_token
    if (!accessToken) {
      setError('ログイン情報が取得できませんでした')
      setLinking(false)
      return
    }
    const redirectUri = `${window.location.origin}/api/google-oauth-callback`
    const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/drive.readonly',
      access_type: 'offline',
      prompt: 'consent',
      state: accessToken,
    })
    setPendingUrl(authUrl)
    setLinking(false)
  }

  function goToGoogle() {
    if (pendingUrl) window.location.href = pendingUrl
  }

  return { linked, linking, error, linkDrive, pendingUrl, goToGoogle }
}
