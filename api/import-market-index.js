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

// Vercelのサーバー関数の実行時間上限を延ばす（Hobbyプランで指定可能な最大値）。
// シート側が数式(GOOGLEFINANCE等)を再計算中だと公開CSVの更新に時間がかかることがあるため。
export const config = { maxDuration: 60 }

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

// 空セルを直前の非空値で埋める（結合セル風の見出し行を展開する）
function forwardFill(row) {
  const filled = []
  let last = ''
  for (const cell of row) {
    if (cell !== '') last = cell
    filled.push(last)
  }
  return filled
}

// このシートは「銘柄名（1行目, 結合セル）」→「直近過去1年（2行目, 結合セル）」→
// 「Date/Close/Open/High/Low/Volume（3行目, 実列名）」という3段見出しで、
// 銘柄ごとに1ブロックが横に並ぶ構造（過去ALLブロックは廃止され直近分のみ）。
// 各ブロックは独立した行範囲を持つため、銘柄ごとに独立にパースする。
function parseSheet(csvText, debug) {
  const rows = parseCsv(csvText)
  debug.rowCount = rows.length
  debug.firstRows = rows.slice(0, 5)
  if (rows.length < 4) return {}

  const titleRow = forwardFill(rows[0])
  const colNameRow = rows[2]
  const dataRows = rows.slice(3)
  debug.titleRow = titleRow
  debug.colNameRow = colNameRow
  debug.sampleDataRow = dataRows[0] ?? null

  // symbol -> { date: colIndex, close: colIndex }
  const symbolColumns = {}
  colNameRow.forEach((colName, i) => {
    const symbol = matchSymbol(titleRow[i] || '')
    if (!symbol) return
    let key = null
    if (DATE_HEADER_RE.test(colName)) key = 'date'
    else if (/close/i.test(colName) || /終値/.test(colName)) key = 'close'
    if (!key) return
    symbolColumns[symbol] ??= {}
    symbolColumns[symbol][key] = i
  })
  debug.symbolColumns = symbolColumns

  const result = {}
  for (const row of dataRows) {
    for (const [symbol, cols] of Object.entries(symbolColumns)) {
      if (cols.date == null || cols.close == null) continue
      const tradeDate = parseDate(row[cols.date])
      const value = parseNumber(row[cols.close])
      if (!tradeDate || value == null) continue
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

      // シートが数式（GOOGLEFINANCE等）を計算中だと、公開CSVが一時的に
      // "読み込んでいます..." のプレースホルダーのまま返ることがあるため、
      // 検出したら少し待って数回リトライする
      let csvText = ''
      let attempts = 0
      const maxAttempts = 6
      while (attempts < maxAttempts) {
        attempts++
        const r = await fetch(sheetUrl)
        debug.httpStatus = r.status
        debug.contentType = r.headers.get('content-type')
        if (!r.ok) { warnings.push(`シート取得失敗 (${r.status}): ${sheetUrl}`); csvText = ''; break }
        csvText = await r.text()
        if (!csvText.includes('読み込んでいます') && !csvText.includes('Loading')) break
        if (attempts < maxAttempts) await new Promise(res => setTimeout(res, 4000))
      }
      debug.attempts = attempts
      debug.textLength = csvText.length
      debug.textSnippet = csvText.slice(0, 800)
      if (!csvText) continue
      if (csvText.includes('読み込んでいます') || csvText.includes('Loading')) {
        warnings.push(`シートが計算中のため取得できませんでした（${attempts}回試行）: ${sheetUrl}`)
        continue
      }
      const parsed = parseSheet(csvText, debug)
      for (const [symbol, points] of Object.entries(parsed)) {
        (merged[symbol] ??= []).push(...points)
      }
    }

    // bitcoin.csvの取り込みは api/crypto-price.js（ローカルCLIからの直接DB反映API）に
    // 一本化したため、ここでのGoogleドライブ経由のbitcoin.csv取り込みは廃止した（2026-08-12）
    const symbols = Object.keys(merged)
    if (symbols.length === 0) {
      return res.status(422).json({ error: 'シートから指標データを検出できませんでした', warnings, debugSheets })
    }

    const dbHeaders = {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    }

    // 差分取り込み: 銘柄ごとにDB上の最新trade_dateを取得し、それより新しい行だけを対象にする
    const latestDates = {}
    await Promise.all(symbols.map(async symbol => {
      const r = await fetch(
        `${url.replace(/\/$/, '')}/rest/v1/market_index_history?select=trade_date&user_id=eq.${user.id}&symbol=eq.${symbol}&order=trade_date.desc&limit=1`,
        { headers: dbHeaders }
      )
      if (!r.ok) return
      const data = await r.json().catch(() => [])
      latestDates[symbol] = data?.[0]?.trade_date ?? null
    }))
    debugSheets.push({ latestDates })

    const rows = []
    const skipped = {}
    for (const [symbol, points] of Object.entries(merged)) {
      const latest = latestDates[symbol]
      let added = 0
      for (const p of points) {
        if (latest && p.trade_date < latest) continue
        rows.push({ user_id: user.id, symbol, trade_date: p.trade_date, value: p.value })
        added++
      }
      skipped[symbol] = points.length - added
    }

    const upsertHeaders = { ...dbHeaders, Prefer: 'resolution=merge-duplicates' }
    const chunkSize = 500
    let inserted = 0
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize)
      const r = await fetch(
        `${url.replace(/\/$/, '')}/rest/v1/market_index_history?on_conflict=user_id,symbol,trade_date`,
        { method: 'POST', headers: upsertHeaders, body: JSON.stringify(chunk) }
      )
      if (!r.ok) {
        const errBody = await r.json().catch(() => ({}))
        return res.status(r.status).json({ error: errBody, warnings })
      }
      inserted += chunk.length
    }

    const counts = {}
    for (const symbol of symbols) {
      counts[symbol] = rows.filter(r => r.symbol === symbol).length
    }
    return res.status(200).json({ inserted, counts, skipped, warnings })
  } catch (err) {
    return res.status(500).json({
      error: `${err?.name ?? 'Error'}: ${err?.message ?? 'unknown error'}`,
      stack: err?.stack ? String(err.stack).slice(0, 2000) : undefined,
    })
  }
}
