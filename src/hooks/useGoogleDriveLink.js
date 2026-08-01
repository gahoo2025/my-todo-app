import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// Googleドライブのファイルを読むためのOAuthスコープを持つGoogle IDを、
// 現在ログイン中のSupabaseユーザーに追加でリンクする（既存のログインセッションは維持する）
export function useGoogleDriveLink(userId) {
  const [linked, setLinked] = useState(null) // null=未確認, true/false
  const [linking, setLinking] = useState(false)
  const [error, setError] = useState(null)
  const [debugLog, setDebugLog] = useState([])

  const log = m => setDebugLog(prev => [...prev.slice(-9), `${new Date().toLocaleTimeString('ja-JP')} ${m}`])

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

  // Google側のOAuthリダイレクトから戻ってきた直後、セッションにprovider_refresh_tokenが
  // 含まれていればサーバーに送って保存する
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      log(`event=${event} provider_token=${!!session?.provider_token} provider_refresh_token=${!!session?.provider_refresh_token}`)
      if (!session?.provider_refresh_token) return
      const r = await fetch('/api/google-drive-link', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: session.provider_refresh_token }),
      })
      log(`POST /api/google-drive-link -> ${r.status}`)
      if (r.ok) setLinked(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function linkDrive() {
    setLinking(true)
    setError(null)
    log('linkIdentity開始')
    try {
      const { data, error } = await supabase.auth.linkIdentity({
        provider: 'google',
        options: {
          scopes: 'https://www.googleapis.com/auth/drive.readonly',
          queryParams: { access_type: 'offline', prompt: 'consent' },
          redirectTo: window.location.href,
        },
      })
      if (error) { setError(error.message); log(`linkIdentity error: ${error.message}`) }
      else log(`linkIdentity url=${data?.url ?? '(なし)'}`)
    } finally {
      setLinking(false)
    }
  }

  return { linked, linking, error, linkDrive, debugLog }
}
