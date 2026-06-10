import { useAuth } from './hooks/useAuth'
import LoginPage from './pages/LoginPage'
import TodoPage from './pages/TodoPage'

export default function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-400">読み込み中...</div>
      </div>
    )
  }

  return user ? <TodoPage /> : <LoginPage />
}
