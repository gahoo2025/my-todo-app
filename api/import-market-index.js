// 指標データ（日経平均・TOPIX・ドル円・VT・S&P500・NYダウ・ナスダック）を
// 公開Googleスプレッドシートから取り込み、Supabaseに保存する。
//
// 取得方式: pubhtml は現在のGoogle SheetsではJSで描画されるシェルHTMLしか
// 返さない（<table>を含まない）ため、代わりに「Publish to web」のCSV出力
// エンドポイント（/pub?...&output=csv）を使う。これは静的CSVで、JS実行不要。
//
// 認証: フロントエンドはログイン中ユーザーの Supabase access_token を
//       Authorization: Bearer <token> で送る（画面の「取り込み」ボタンから呼ばれる想定）。
//
// 必要な環境変数（他のAPIと共通）:
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

const DOC_ID = '2PACX-1vSUrBziBSn0T7rytbJw-KxksxkK727SitmnOOF40UN1bFcu6pPLt7PUYyW1kslmC0lRDeX8I1rJ_zWD'
const GIDS = ['37935226', '1456450243']
const SHEET_CSV_URLS = GIDS.map(gid =>
  `https://docs.google.com/spreadsheets/d/e/${DOC_ID}/pub?gid=${gid}&single=true&output=csv`
)

// 見出しテキスト → symbol のマッピング（部分一致・大文字小文字は無視）
const SYMBOL_KEYWORDS = [
  { symbol: 'nikkei225', keywords: ['日経平均', '日経225', 'nikkei'] },
  { symbol: 'topix',     keywords: ['topix'] },
  { symbol: 'usdjpy',    keywords: ['ドル円', 'usd/jpy', 'usdjpy'] },
  { symbol: 'vt',        keywords: ['vt'] },
  { symbol: 'sp500',     keywords: ['s&p500', 's&p 500', 'sp500'] },
  { symbol: 'dow',       keywords: ['nyダウ', 'ダウ平均', 'dow'] },
  { symbol: 'nasdaq',    keywords: ['ナスダック', 'nasdaq'] },
]

const DATE_HEADER_RE = /日付|date/i

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

// 1行分のCSVをセル配列にパースする（ダブルクォート内のカンマ・エスケープに対応）
function parseCsvLine(line) {
  const result = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++ } else { inQuotes = false }
      } else {
        cur += c
      }
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ',') {
      result.push(cur)
      cur = ''
    } else {
      cur += c
    }
  }
  result.push(cur)
  return result.map(s => s.trim())
}

function parseCsv(text) {
  return text.split(/\r?\n/).filter(l => l.length > 0).map(parseCsvLine)
}

function parseDate(text) {
  if (!text) return null
  const s = text.trim().replace(/\s+/g, '')
  let m = s.match(/^(\d{4})[/\-年](\d{1,2})[/\-月](\d{1,2})日?$/)
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
  m = s.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})$/)
  if (m) return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`
  const d = new Date(s)
  if (!isNaN(d.getTime())) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  return null
}

function parseNumber(text) {
  if (!text) return null
  const cleaned = text.replace(/[,，¥$%\s]/g, '')
  if (!cleaned || cleaned === '-') return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

function matchSymbol(header) {
  const h = header.toLowerCase()
  for (const { symbol, keywords } of SYMBOL_KEYWORDS) {
    if (keywords.some(k => h.includes(k.toLowerCase()))) return symbol
  }
  return null
}

// 1シート分のCSVを解析し、{symbol: [{trade_date, value}]} を返す。
// debug には「何が見えていたか」を積む（検出失敗時に原因を特定するため）
function parseSheet(csvText, debug) {
  const rows = parseCsv(csvText)
  debug.rowCount = rows.length
  debug.firstRows = rows.slice(0, 5)
  if (!rows.length) return {}

  const headerRow = rows[0]
  const dataRows = rows.slice(1)
  debug.headerRow = headerRow

  let dateColIndex = headerRow.findIndex(h => DATE_HEADER_RE.test(h))
  if (dateColIndex === -1) dateColIndex = 0
  debug.dateColIndex = dateColIndex

  const symbolColumns = {}
  headerRow.forEach((h, i) => {
    if (i === dateColIndex) return
    const symbol = matchSymbol(h)
    if (symbol) symbolColumns[symbol] = i
  })
  debug.symbolColumns = symbolColumns
  debug.sampleDataRow = dataRows[0] ?? null

  const result = {}
  for (const row of dataRows) {
    const tradeDate = parseDate(row[dateColIndex])
    if (!tradeDate) continue
    for (const [symbol, colIndex] of Object.entries(symbolColumns)) {
      const value = parseNumber(row[colIndex])
      if (value == null) continue
      ;(result[symbol] ??= []).push({ trade_date: tradeDate, value })
    }
  }
  return result
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
    const merged = {}
    const warnings = []
    const debugSheets = []
    for (const sheetUrl of SHEET_CSV_URLS) {
      const debug = { url: sheetUrl }
      debugSheets.push(debug)
      const r = await fetch(sheetUrl)
      debug.httpStatus = r.status
      debug.contentType = r.headers.get('content-type')
      if (!r.ok) { warnings.push(`シート取得失敗 (${r.status}): ${sheetUrl}`); continue }
      const csvText = await r.text()
      debug.textLength = csvText.length
      debug.textSnippet = csvText.slice(0, 800)
      const parsed = parseSheet(csvText, debug)
      for (const [symbol, points] of Object.entries(parsed)) {
        (merged[symbol] ??= []).push(...points)
      }
    }

    const symbols = Object.keys(merged)
    if (symbols.length === 0) {
      return res.status(422).json({ error: 'シートから指標データを検出できませんでした', warnings, debugSheets })
    }

    const rows = []
    for (const [symbol, points] of Object.entries(merged)) {
      for (const p of points) {
        rows.push({ user_id: user.id, symbol, trade_date: p.trade_date, value: p.value })
      }
    }

    const dbHeaders = {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    }
    const chunkSize = 500
    let inserted = 0
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize)
      const r = await fetch(
        `${url.replace(/\/$/, '')}/rest/v1/market_index_history?on_conflict=user_id,symbol,trade_date`,
        { method: 'POST', headers: dbHeaders, body: JSON.stringify(chunk) }
      )
      if (!r.ok) {
        const errBody = await r.json().catch(() => ({}))
        return res.status(r.status).json({ error: errBody, warnings })
      }
      inserted += chunk.length
    }

    const counts = Object.fromEntries(Object.entries(merged).map(([s, pts]) => [s, pts.length]))
    return res.status(200).json({ inserted, counts, warnings })
  } catch (err) {
    return res.status(500).json({ error: err?.message ?? 'unknown error' })
  }
}
