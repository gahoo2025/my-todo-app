// Vercel Serverless Function: マーケットログ（日次・週次・月次・年次の株式市場の実績・見通し）を
// 登録 / 取得する API
//
// market_log_entries（実績・見通し本体）・market_log_stocks（関連銘柄）・market_log_todos（関連TODO）
// テーブルへ直接書き込む。アプリのUIから手動でテキストを貼り付けて登録する運用（marketLogParser.js）
// と並行して、Claudeチャットでの市場分析結果をローカルCLI/チャットから直接POSTできるようにする。
//
// 必要な環境変数（stock-analysis.js・crypto-price.js と共通）:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, INGEST_TOKEN, INGEST_USER_ID
//
// 使い方:
//   POST /api/market-log-sync
//     Header: Authorization: Bearer <INGEST_TOKEN>
//     Body(JSON): {
//       "period": "daily",   … "daily" | "weekly" | "monthly" | "yearly"（省略時は"daily"）
//       "entry_at": "2026-08-13",   … 分析対象日時（YYYY-MM-DD、または省略時はサーバーの現在時刻）
//       "actual": "## 実績\n...",   … 実績のまとめ（Markdown可）
//       "outlook": "## 見通し\n...",   … 見通しのまとめ（Markdown可）
//       "raw_text": "...",   … 任意。分析の元テキスト全文
//       "stocks": [ { "block": "上昇", "name": "トヨタ自動車", "code": "7203", "score": null } ],   … 任意
//       "todos": [ { "content": "決算発表を確認する", "done": false } ]   … 任意
//     }
//     同じ user_id + entry_at + period の組み合わせが既に存在する場合は、そのエントリを
//     上書き（actual/outlook/raw_textを更新し、stocks/todosは全入れ替え）する。存在しなければ
//     新規作成する（2026-08-14、失敗時の再送信で重複登録された事例を受けてupsertに変更）。
//   GET /api/market-log-sync?limit=10   … 直近のエントリ一覧を確認

export const config = { maxDuration: 30 }

const PERIODS = ['daily', 'weekly', 'monthly', 'yearly']

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

  const base = `${url.replace(/\/$/, '')}/rest/v1`
  const commonHeaders = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  }

  try {
    if (req.method === 'GET') {
      const limit = Math.min(Number(req.query?.limit) || 10, 100)
      const q = `${base}/market_log_entries?user_id=eq.${encodeURIComponent(userId)}&select=id,entry_at,period,actual,outlook&order=entry_at.desc&limit=${limit}`
      const r = await fetch(q, { headers: commonHeaders })
      const data = await r.json()
      if (!r.ok) return res.status(r.status).json({ error: data })
      return res.status(200).json({ items: data })
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
      const period = (body.period ?? 'daily').toString().trim()
      if (!PERIODS.includes(period)) {
        return res.status(400).json({ error: `periodは${PERIODS.join('/')}のいずれかで指定してください` })
      }
      const entryAt = (body.entry_at ?? '').toString().trim() || new Date().toISOString()
      const actual = body.actual != null ? body.actual.toString() : null
      const outlook = body.outlook != null ? body.outlook.toString() : null
      const rawText = body.raw_text != null ? body.raw_text.toString() : null
      if (!actual && !outlook) {
        return res.status(400).json({ error: 'actual または outlook のどちらかは必須です' })
      }

      const insertHeaders = { ...commonHeaders, Prefer: 'return=representation' }

      // 既存エントリ（同一 user_id + entry_at + period）があれば上書き、無ければ新規作成
      const existingQ = `${base}/market_log_entries?user_id=eq.${encodeURIComponent(userId)}&entry_at=eq.${encodeURIComponent(entryAt)}&period=eq.${encodeURIComponent(period)}&select=id`
      const existingRes = await fetch(existingQ, { headers: commonHeaders })
      const existingData = await existingRes.json()
      if (!existingRes.ok) return res.status(existingRes.status).json({ error: existingData })
      const existing = Array.isArray(existingData) && existingData.length > 0 ? existingData[0] : null

      let entry
      if (existing) {
        const logId = existing.id
        const patchRes = await fetch(`${base}/market_log_entries?id=eq.${encodeURIComponent(logId)}`, {
          method: 'PATCH',
          headers: insertHeaders,
          body: JSON.stringify({ actual, outlook, raw_text: rawText }),
        })
        const patchData = await patchRes.json()
        if (!patchRes.ok) return res.status(patchRes.status).json({ error: patchData })
        entry = Array.isArray(patchData) ? patchData[0] : patchData
        // 既存のstocks/todosは全入れ替えするため先に削除する
        const delStocks = await fetch(`${base}/market_log_stocks?log_id=eq.${encodeURIComponent(logId)}`, { method: 'DELETE', headers: commonHeaders })
        if (!delStocks.ok) return res.status(delStocks.status).json({ error: await delStocks.json() })
        const delTodos = await fetch(`${base}/market_log_todos?log_id=eq.${encodeURIComponent(logId)}`, { method: 'DELETE', headers: commonHeaders })
        if (!delTodos.ok) return res.status(delTodos.status).json({ error: await delTodos.json() })
      } else {
        const entryRes = await fetch(`${base}/market_log_entries`, {
          method: 'POST',
          headers: insertHeaders,
          body: JSON.stringify([{ user_id: userId, entry_at: entryAt, period, actual, outlook, raw_text: rawText }]),
        })
        const entryData = await entryRes.json()
        if (!entryRes.ok) return res.status(entryRes.status).json({ error: entryData })
        entry = Array.isArray(entryData) ? entryData[0] : entryData
      }
      const logId = entry.id

      const stocks = Array.isArray(body.stocks) ? body.stocks : []
      const todos = Array.isArray(body.todos) ? body.todos : []

      const results = { entry, stocks: [], todos: [] }

      if (stocks.length > 0) {
        const rows = stocks.map((s, i) => ({
          log_id: logId, user_id: userId,
          block: s.block ?? null, name: s.name ?? null, code: s.code ?? null,
          score: s.score ?? null, position: i,
        }))
        const r = await fetch(`${base}/market_log_stocks`, { method: 'POST', headers: insertHeaders, body: JSON.stringify(rows) })
        const data = await r.json()
        if (!r.ok) return res.status(r.status).json({ error: data, entry })
        results.stocks = data
      }

      if (todos.length > 0) {
        const rows = todos.map((t, i) => ({
          log_id: logId, user_id: userId,
          content: t.content ?? '', done: Boolean(t.done), position: i,
        }))
        const r = await fetch(`${base}/market_log_todos`, { method: 'POST', headers: insertHeaders, body: JSON.stringify(rows) })
        const data = await r.json()
        if (!r.ok) return res.status(r.status).json({ error: data, entry })
        results.todos = data
      }

      return res.status(200).json({
        id: logId,
        entry_at: entry.entry_at,
        period: entry.period,
        updated: Boolean(existing),
        stocks_added: results.stocks.length,
        todos_added: results.todos.length,
      })
    }

    res.setHeader('Allow', 'GET, POST, OPTIONS')
    return res.status(405).json({ error: 'Method Not Allowed' })
  } catch (err) {
    return res.status(500).json({ error: err?.message ?? 'unknown error' })
  }
}
