// Googleドライブの「銘柄リスト.csv」（分類/銘柄コード/銘柄名/セクター/最新株価/配当額/
// 配当利回り/Layer1判定/Layer2の状況/Layer2信号/最終判定、Shift-JIS）を取り込み、
// Supabaseに保存する。Googleドライブ連携は指標データの取り込みと共通
// （google_drive_tokensテーブルに保存済みのrefresh_tokenを使う）。
//
// 必要な環境変数: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
//                GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET

export const config = { maxDuration: 30 }

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

async function getDriveRefreshToken(url, serviceKey, userId) {
  const r = await fetch(
    `${url.replace(/\/$/, '')}/rest/v1/google_drive_tokens?select=refresh_token&user_id=eq.${userId}&limit=1`,
    { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
  )
  if (!r.ok) return null
  const data = await r.json().catch(() => [])
  return data?.[0]?.refresh_token ?? null
}

async function getDriveAccessToken(refreshToken, warnings) {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    warnings.push('GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRETが未設定です')
    return null
  }
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  if (!r.ok) {
    const errText = await r.text().catch(() => '')
    warnings.push(`Googleドライブのアクセストークン取得に失敗しました (HTTP ${r.status}): ${errText.slice(0, 300)}`)
    return null
  }
  const data = await r.json().catch(() => ({}))
  return data.access_token ?? null
}

// クォート内の改行・カンマにも対応した1パスCSVパーサー
// （行単位に先に分割すると、クォート内に改行を含むセルがある場合に崩れるため）
function parseCsv(text) {
  const rows = []
  let row = []
  let cur = ''
  let inQuotes = false
  let i = 0
  const n = text.length
  while (i < n) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { cur += '"'; i += 2; continue }
        inQuotes = false; i++; continue
      }
      cur += c; i++; continue
    }
    if (c === '"') { inQuotes = true; i++; continue }
    if (c === ',') { row.push(cur.trim()); cur = ''; i++; continue }
    if (c === '\r') { i++; continue }
    if (c === '\n') {
      row.push(cur.trim()); cur = ''
      if (row.some(v => v !== '')) rows.push(row)
      row = []
      i++; continue
    }
    cur += c; i++
  }
  row.push(cur.trim())
  if (row.some(v => v !== '')) rows.push(row)
  return rows
}

function parseNumber(text) {
  if (!text) return null
  const cleaned = text.replace(/[,，¥$%\s]/g, '')
  if (!cleaned || cleaned === '-') return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

const COLUMN_KEYS = [
  'category', 'symbol_code', 'symbol_name', 'sector', 'latest_price',
  'dividend_amount', 'dividend_yield', 'layer1_judgement', 'layer2_status',
  'layer2_signal', 'final_judgement',
]
const NUMBER_COLUMNS = new Set(['latest_price', 'dividend_amount', 'dividend_yield'])

function parseStockList(csvText, debug) {
  const rows = parseCsv(csvText)
  debug.rowCount = rows.length
  debug.headerRow = rows[0] ?? null
  debug.sampleDataRows = rows.slice(1, 4)
  if (rows.length < 2) return []
  const dataRows = rows.slice(1)
  const items = []
  for (const row of dataRows) {
    const symbolCode = (row[1] || '').trim()
    if (!symbolCode) continue
    const item = {}
    COLUMN_KEYS.forEach((key, i) => {
      const raw = row[i] ?? ''
      item[key] = NUMBER_COLUMNS.has(key) ? parseNumber(raw) : (raw || null)
    })
    items.push(item)
  }
  return items
}

async function fetchStockListFromDrive(accessToken, warnings, debug) {
  const headers = { Authorization: `Bearer ${accessToken}` }
  const listUrl = 'https://www.googleapis.com/drive/v3/files?' + new URLSearchParams({
    q: "name='銘柄リスト.csv' and trashed=false",
    fields: 'files(id,name)',
    spaces: 'drive',
  })
  const listRes = await fetch(listUrl, { headers })
  if (!listRes.ok) {
    const errText = await listRes.text().catch(() => '')
    warnings.push(`Googleドライブのファイル一覧取得に失敗しました (HTTP ${listRes.status}): ${errText.slice(0, 300)}`)
    return null
  }
  const listData = await listRes.json().catch(() => ({}))
  const file = listData.files?.[0]
  if (!file) {
    warnings.push('Googleドライブに 銘柄リスト.csv が見つかりませんでした')
    return null
  }
  const dlRes = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, { headers })
  if (!dlRes.ok) {
    const errText = await dlRes.text().catch(() => '')
    warnings.push(`銘柄リスト.csv のダウンロードに失敗しました (HTTP ${dlRes.status}): ${errText.slice(0, 300)}`)
    return null
  }
  const buf = await dlRes.arrayBuffer()
  let csvText
  try {
    csvText = new TextDecoder('shift_jis').decode(buf)
  } catch {
    csvText = new TextDecoder('utf-8').decode(buf)
  }
  return parseStockList(csvText, debug)
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS')
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

  try {
    const warnings = []
    const refreshToken = await getDriveRefreshToken(url, serviceKey, user.id)
    if (!refreshToken) {
      return res.status(422).json({ error: 'Googleドライブが未連携です。指標データの取り込み欄から連携してください。' })
    }
    const accessToken = await getDriveAccessToken(refreshToken, warnings)
    if (!accessToken) {
      return res.status(502).json({ error: warnings[warnings.length - 1] || 'アクセストークン取得に失敗しました', warnings })
    }
    const debug = {}
    const items = await fetchStockListFromDrive(accessToken, warnings, debug)
    if (!items) {
      return res.status(422).json({ error: warnings[warnings.length - 1] || '銘柄リストを取得できませんでした', warnings, debug })
    }
    if (items.length === 0) {
      return res.status(422).json({ error: '銘柄リスト.csvから有効な行を検出できませんでした', warnings, debug })
    }

    // 銘柄コードの重複行があると同一バッチ内でON CONFLICTが二重適用されエラーになるため、
    // 後勝ちで重複を除去する
    const bySymbol = new Map()
    for (const item of items) bySymbol.set(item.symbol_code, item)
    const duplicateCount = items.length - bySymbol.size
    if (duplicateCount > 0) warnings.push(`銘柄コードの重複行 ${duplicateCount}件は最後の行を採用しました`)

    const rows = [...bySymbol.values()].map(item => ({ user_id: user.id, ...item, updated_at: new Date().toISOString() }))
    const dbHeaders = {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    }
    const chunkSize = 500
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize)
      const r = await fetch(
        `${url.replace(/\/$/, '')}/rest/v1/stock_master_list?on_conflict=user_id,symbol_code`,
        { method: 'POST', headers: dbHeaders, body: JSON.stringify(chunk) }
      )
      if (!r.ok) {
        const errBody = await r.json().catch(() => ({}))
        return res.status(r.status).json({ error: errBody, warnings })
      }
    }

    return res.status(200).json({ imported: rows.length, warnings, debug })
  } catch (err) {
    return res.status(500).json({ error: `${err?.name ?? 'Error'}: ${err?.message ?? 'unknown error'}` })
  }
}
