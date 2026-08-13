// Vercel Serverless Function: 3層フレームワークのスクリーニング結果（銘柄リスト）を登録 / 取得する API
//
// stock_master_list テーブル（資産タブ「銘柄リスト」が使うのと同じテーブル、
// これまで Google Drive 上の 銘柄リスト.csv を取り込んでいたテーブル）に直接書き込む。
// これにより、ローカルの fundamental-3layer-screening スキルがスクリーニングを実行した直後に、
// Google Drive を経由せず直接DBへ反映できる。
//
// 必要な環境変数（crypto-price.js・stock-analysis.js・asset-balance.js と共通）:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, INGEST_TOKEN, INGEST_USER_ID
//
// 使い方:
//   POST /api/stock-list-sync
//     Header: Authorization: Bearer <INGEST_TOKEN>
//     Body(JSON): {
//       "items": [
//         {
//           "symbol_code": "8951",
//           "symbol_name": "日本ビルファンド投資法人",
//           "category": "REIT候補",
//           "sector": "不動産投資信託",
//           "latest_price": 480000,
//           "dividend_amount": 12000,
//           "dividend_yield": 2.5,
//           "layer1_judgement": "81点（80点以上）",
//           "layer2_status": "信用倍率3.76倍（過熱水準）",
//           "layer2_signal": null,
//           "final_judgement": "監視リスト",
//           "excluded": null,
//           "screened_at": "2026-08-12"
//         }
//       ],
//       "replace": true   … 省略時true。trueの場合、items に含まれない既存銘柄は削除する
//                            （銘柄リスト.csv全体を取り込んでいた既存の import-stock-list.js と同じ挙動）。
//                            差分（一部銘柄）だけ送る場合はfalseを指定する。
//     }
//     symbol_code が同じ既存行は上書きされる。
//   GET /api/stock-list-sync?limit=10   … 直近の登録を確認

export const config = { maxDuration: 30 }

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

// stock_master_list のカラム（import-stock-list.js のCSV取り込みと同じ列構成）
const STRING_FIELDS = [
  'excluded', 'screened_at', 'category', 'symbol_name', 'sector',
  'layer1_judgement', 'layer2_status', 'layer2_signal', 'final_judgement',
]
const NUMBER_FIELDS = ['latest_price', 'dividend_amount', 'dividend_yield']

// import-stock-list.js の parseNumber と同じ正規化（カンマ・円・%・¥・$・空白を除去してから数値化）。
// ローカルCLI側がCSVの表記（例："3,422円"・"4.24%"）をそのまま送ってくるケースに対応するため、
// 数値だけを渡された場合と両方で正しく動くようにしておく。
function toNumberOrNull(v) {
  if (v === null || v === undefined || v === '') return null
  const cleaned = v.toString().replace(/[,，¥$%円\s]/g, '')
  if (!cleaned || cleaned === '-') return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
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

  const base = `${url.replace(/\/$/, '')}/rest/v1/stock_master_list`
  const commonHeaders = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  }

  try {
    if (req.method === 'GET') {
      const limit = Math.min(Number(req.query?.limit) || 10, 200)
      const q = `${base}?user_id=eq.${encodeURIComponent(userId)}&select=symbol_code,symbol_name,category,final_judgement,updated_at&order=updated_at.desc&limit=${limit}`
      const r = await fetch(q, { headers: commonHeaders })
      const data = await r.json()
      if (!r.ok) return res.status(r.status).json({ error: data })
      return res.status(200).json({ items: data })
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
      const items = Array.isArray(body.items) ? body.items : null
      const replace = body.replace !== false
      if (!items || items.length === 0) {
        return res.status(400).json({ error: 'items（配列）は必須です。例: [{"symbol_code":"8951","symbol_name":"..."}]' })
      }

      const warnings = []
      const bySymbol = new Map()
      for (const it of items) {
        const symbolCode = (it?.symbol_code ?? '').toString().trim()
        if (!symbolCode) {
          return res.status(400).json({ error: `symbol_codeは必須です: ${JSON.stringify(it)}` })
        }
        const row = { user_id: userId, symbol_code: symbolCode }
        for (const key of STRING_FIELDS) {
          const v = it?.[key]
          row[key] = v === undefined || v === null || v === '' ? null : v.toString()
        }
        for (const key of NUMBER_FIELDS) row[key] = toNumberOrNull(it?.[key])
        row.updated_at = new Date().toISOString()
        bySymbol.set(symbolCode, row)
      }
      const duplicateCount = items.length - bySymbol.size
      if (duplicateCount > 0) warnings.push(`symbol_codeの重複 ${duplicateCount}件は最後の行を採用しました`)

      const rows = [...bySymbol.values()]
      const upsertHeaders = { ...commonHeaders, Prefer: 'resolution=merge-duplicates,return=representation' }
      const chunkSize = 500
      let upserted = 0
      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize)
        const r = await fetch(`${base}?on_conflict=user_id,symbol_code`, {
          method: 'POST',
          headers: upsertHeaders,
          body: JSON.stringify(chunk),
        })
        const data = await r.json().catch(() => null)
        if (!r.ok) return res.status(r.status).json({ error: data, warnings })
        upserted += Array.isArray(data) ? data.length : chunk.length
      }

      let deleted = null
      if (replace) {
        const codesList = rows.map(r => `"${r.symbol_code.replace(/"/g, '\\"')}"`).join(',')
        const delRes = await fetch(
          `${base}?user_id=eq.${encodeURIComponent(userId)}&symbol_code=not.in.(${codesList})`,
          { method: 'DELETE', headers: { ...commonHeaders, Prefer: 'return=representation' } }
        )
        const delData = await delRes.json().catch(() => null)
        if (!delRes.ok) {
          warnings.push(`古い行の削除に失敗しました: ${JSON.stringify(delData)}`)
        } else {
          deleted = Array.isArray(delData) ? delData.length : null
        }
      }

      return res.status(200).json({ upserted, deleted, replace, warnings })
    }

    res.setHeader('Allow', 'GET, POST, OPTIONS')
    return res.status(405).json({ error: 'Method Not Allowed' })
  } catch (err) {
    return res.status(500).json({ error: err?.message ?? 'unknown error' })
  }
}
