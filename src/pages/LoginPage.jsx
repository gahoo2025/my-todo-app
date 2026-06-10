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
    <div className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>

      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-2xl mb-4 backdrop-blur-sm">
            <span className="text-3xl">✅</span>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-wide">My Todo</h1>
          <p className="text-white/70 text-sm mt-1">タスクをスマートに管理しよう</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-2xl p-8">
          <h2 className="text-lg font-bold text-gray-800 mb-6">
            {isSignUp ? 'アカウントを作成' : 'ログイン'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                メールアドレス
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:bg-white text-base transition-all"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                パスワード
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:bg-white text-base transition-all"
                placeholder="6文字以上"
              />
            </div>

            {error && (
              <p className="text-sm text-red-500 bg-red-50 px-4 py-2.5 rounded-xl">{error}</p>
            )}
            {message && (
              <p className="text-sm text-emerald-600 bg-emerald-50 px-4 py-2.5 rounded-xl">{message}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 text-white rounded-xl font-bold text-base disabled:opacity-50 transition-all active:scale-95"
              style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
            >
              {loading ? '処理中...' : isSignUp ? 'アカウント作成' : 'ログイン'}
            </button>
          </form>

          <div className="mt-5 pt-5 border-t border-gray-100 text-center">
            <button
              onClick={() => { setIsSignUp(!isSignUp); setError(''); setMessage('') }}
              className="text-sm text-violet-600 font-medium hover:underline"
            >
              {isSignUp ? 'すでにアカウントをお持ちの方' : 'アカウントを新規作成'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
