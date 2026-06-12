import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setError(error.message)
      else setMessage('確認メールを送信しました。メールをご確認ください。')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError('メールアドレスまたはパスワードが正しくありません')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-5 bg-[#F2F2F7]">
      <div className="w-full max-w-sm">
        {/* アプリアイコン＆タイトル */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-[72px] h-[72px] rounded-[18px] bg-[#007AFF] shadow-[0_8px_24px_rgba(0,122,255,0.35)] mb-5">
            <svg className="w-9 h-9 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-[26px] font-bold tracking-tight text-[#1C1C1E]">My Todo</h1>
          <p className="text-[14px] text-[#8E8E93] mt-1">タスクをスマートに管理</p>
        </div>

        {/* フォームグループ */}
        <form onSubmit={handleSubmit}>
          <div className="ios-card overflow-hidden divide-y divide-black/[0.04] mb-4">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3.5 text-[16px] text-[#1C1C1E] placeholder:text-[#AEAEB2] bg-transparent focus:outline-none"
              placeholder="メールアドレス"
            />
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3.5 text-[16px] text-[#1C1C1E] placeholder:text-[#AEAEB2] bg-transparent focus:outline-none"
              placeholder="パスワード（6文字以上）"
            />
          </div>

          {error && (
            <p className="text-[13px] text-[#FF3B30] px-3 mb-4">{error}</p>
          )}
          {message && (
            <p className="text-[13px] text-[#34C759] px-3 mb-4">{message}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="ios-btn-primary shadow-[0_2px_12px_rgba(0,122,255,0.3)]"
          >
            {loading ? '処理中…' : isSignUp ? 'アカウント作成' : 'ログイン'}
          </button>
        </form>

        <button
          onClick={() => { setIsSignUp(!isSignUp); setError(''); setMessage('') }}
          className="mt-5 w-full text-center text-[14px] text-[#007AFF] active:opacity-50 transition-opacity"
        >
          {isSignUp ? 'すでにアカウントをお持ちの方' : 'アカウントを新規作成'}
        </button>
      </div>
    </div>
  )
}
