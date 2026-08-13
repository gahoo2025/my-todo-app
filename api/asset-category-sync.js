// Vercel Serverless Function: 家族の純資産の長期推移（証券・現金・保険の内訳、年次スナップショット）を
// 登録 / 取得する API
//
// asset_category_history テーブルに直接書き込む。ローカルの資産管理Excel（WORK6の
// 「貯蓄_入力」シート等）が持つ「証券・現金・保険の内訳を長期間追った年次サマリ」を、
// 個別銘柄の詳細（asset_holdings_history）や証券会社別合計（asset_total_history）とは別に、
// 家族全体の粗い区分で保存する。
//
// 必要な環境変数（crypto-price.js・stock-list-sync.js と共通）:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, INGEST_TOKEN, INGEST_USER_ID
//
// 事前準備（Supabase側でテーブルを作成する必要あり。README.md参照）：
//   create table asset_category_history (
//     id bigint generated always as identity primary key,
//     user_id uuid not null references auth.users,
//     category text not null check (category in ('securities','cash','insurance')),
//     as_of date not null,
//     amount numeric not null,
//     created_at timestamptz not null default now(),
//     updated_at timestamptz not null default now(),
//     unique (user_id, category, as_of)
//   );
//   alter table asset_category_history enable row level security;
//   create policy "Users can view their own asset category history"
//     on asset_category_history for select
//     using (auth.uid() = user_id);
//
// 使い方:
//   POST /api/asset-category-sync
//     Header: Authorization: Bearer <INGEST_TOKEN>
//     Body(JSON): {
//       "items": [
//         { "category": "securities", "as_of": "2025-12-31", "amount": 42104345 },
//         { "category": "cash",       "as_of": "2025-12-31", "amount": 7984219 },
//         { "category": "insurance",  "as_of": "2025-12-31", "amount": 7977742 }
//       ]
//     }
//     同じ (category, as_of) の組み合わせへの再送は上書きされる。
//   GET /api/asset-category-sync?category=securities&limit=20   … 直近の登録を確認（categoryは省略可）

const CATEGORIES = ['securities', 'cash', 'insurance']
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

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

  const base = `${url.replace(/\/$/, '')}/rest/v1/asset_category_history`
  const commonHeaders = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  }

  try {
    if (req.method === 'GET') {
      const category = (req.query?.category ?? '').toString().trim()
      const limit = Math.min(Number(req.query?.limit) || 20, 200)
      let q = `${base}?user_id=eq.${encodeURIComponent(userId)}&select=category,as_of,amount&order=as_of.desc&limit=${limit}`
      if (category) q += `&category=eq.${encodeURIComponent(category)}`
      const r = await fetch(q, { headers: commonHeaders })
      const data = await r.json()
      if (!r.ok) return res.status(r.status).json({ error: data })
      return res.status(200).json({ items: data })
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
      const items = Array.isArray(body.items) ? body.items : null
      if (!items || items.length === 0) {
        return res.status(400).json({ error: 'items（配列）は必須です。例: [{"category":"securities","as_of":"2025-12-31","amount":42104345}]' })
      }

      const rows = []
      for (const it of items) {
        const category = (it?.category ?? '').toString().trim()
        const asOf = (it?.as_of ?? '').toString().trim()
        const amount = Number(it?.amount)
        if (!CATEGORIES.includes(category)) {
          return res.status(400).json({ error: `categoryは securities/cash/insurance のいずれかで指定してください: ${JSON.stringify(it)}` })
        }
        if (!DATE_RE.test(asOf)) {
          return res.status(400).json({ error: `as_ofはYYYY-MM-DD形式で指定してください: ${JSON.stringify(it)}` })
        }
        if (!Number.isFinite(amount)) {
          return res.status(400).json({ error: `amountは数値で指定してください: ${JSON.stringify(it)}` })
        }
        rows.push({ user_id: userId, category, as_of: asOf, amount })
      }

      const upsertHeaders = { ...commonHeaders, Prefer: 'resolution=merge-duplicates,return=representation' }
      const r = await fetch(`${base}?on_conflict=user_id,category,as_of`, {
        method: 'POST',
        headers: upsertHeaders,
        body: JSON.stringify(rows),
      })
      const data = await r.json()
      if (!r.ok) return res.status(r.status).json({ error: data })
      return res.status(200).json({ upserted: Array.isArray(data) ? data.length : rows.length })
    }

    res.setHeader('Allow', 'GET, POST, OPTIONS')
    return res.status(405).json({ error: 'Method Not Allowed' })
  } catch (err) {
    return res.status(500).json({ error: err?.message ?? 'unknown error' })
  }
}
