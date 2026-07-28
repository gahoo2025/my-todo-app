// 資産管理アプリ（楽天証券の資産CSV: assetbalanceall / assetbalanceINVST /
// stockposition）を取り込み、人物・証券会社ごとの資産推移・個別銘柄の保有履歴を
// Supabaseに保存する。
//
// ファイル自体には「誰の・どの証券会社の」情報が含まれないため、フロントエンドで
// 1ファイルずつ人物・証券会社を指定してから送信する想定。
//
// 認証: ログイン中ユーザーのSupabase access_tokenをAuthorization: Bearerで送る。

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
  return text.split(/\r?\n/).map(parseCsvLine)
}

function parseNumber(text) {
  if (text == null) return null
  const cleaned = String(text).replace(/[,，¥$%\s+株口]/g, '')
  if (!cleaned || cleaned === '-') return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

function parseSlashDate(text) {
  const m = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec((text || '').trim())
  if (!m) return null
  return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
}

// ファイル名の "..._20260727_232858.csv" / "..._20260727233533.csv" から日付を推定
function dateFromFilename(filename) {
  const m = /(\d{4})(\d{2})(\d{2})/.exec(filename || '')
  if (!m) return null
  return `${m[1]}-${m[2]}-${m[3]}`
}

function parseBalanceSummary(text, filename) {
  const rows = parseCsv(text).filter(r => r.length > 1 && r[0])
  const recordedAt = dateFromFilename(filename)
  const holdings = []
  for (const row of rows.slice(1)) {
    holdings.push({
      holding_type: row[0].includes('投資信託') ? 'fund' : 'stock',
      symbol_code: row[1] || '',
      symbol_name: row[2],
      account_type: row[8],
      quantity: parseNumber(row[9]),
      avg_cost: parseNumber(row[13]),
      current_price: parseNumber(row[18]),
      market_value: parseNumber(row[17]),
      unrealized_pl: parseNumber(row[22]),
      unrealized_pl_pct: parseNumber(row[25]),
      recorded_at: recordedAt,
    })
  }
  return { holdings, totals: sumTotal(holdings) }
}

function sumTotal(holdings) {
  if (holdings.length === 0) return []
  const recordedAt = holdings[0].recorded_at
  if (!recordedAt) return []
  const total = holdings.reduce((s, h) => s + Number(h.market_value ?? 0), 0)
  return [{ total_value: total, recorded_at: recordedAt }]
}

function parseInvst(text, filename) {
  const rows = parseCsv(text).filter(r => r.length > 1 && r[0])
  const recordedAt = dateFromFilename(filename)
  const holdings = []
  for (const row of rows.slice(1)) {
    if (row[0] !== '投資信託') continue
    holdings.push({
      holding_type: 'fund',
      symbol_code: '',
      symbol_name: row[2],
      account_type: row[1],
      quantity: parseNumber(row[4]),
      avg_cost: parseNumber(row[7]),
      current_price: parseNumber(row[9]),
      market_value: parseNumber(row[12]),
      unrealized_pl: parseNumber(row[13]),
      unrealized_pl_pct: parseNumber(row[14]),
      recorded_at: recordedAt,
    })
  }
  return { holdings, totals: sumTotal(holdings) }
}

function parseStockPosition(text) {
  const rows = parseCsv(text).filter(r => r.length > 1 && r[0])
  const holdings = []
  for (const row of rows.slice(1)) {
    const recordedAt = parseSlashDate(row[0])
    if (!recordedAt) continue
    holdings.push({
      holding_type: 'stock',
      symbol_code: row[3] || '',
      symbol_name: row[2],
      account_type: row[5],
      quantity: parseNumber(row[9]),
      avg_cost: parseNumber(row[8]),
      current_price: parseNumber(row[7]),
      market_value: parseNumber(row[12]),
      unrealized_pl: parseNumber(row[13]),
      unrealized_pl_pct: null,
      recorded_at: recordedAt,
    })
  }
  return { holdings, totals: sumTotal(holdings) }
}

function parseAssetBalanceAll(text, filename) {
  const rows = parseCsv(text)
  const recordedAt = dateFromFilename(filename)

  const totals = []
  const totalRow = rows.find(r => r[0] === '資産合計')
  const totalValue = totalRow ? parseNumber(totalRow[1]) : null
  if (totalValue != null && recordedAt) {
    totals.push({ total_value: totalValue, recorded_at: recordedAt })
  }

  const headerIdx = rows.findIndex(r => r[0] === '種別' && r.includes('銘柄'))
  const holdings = []
  if (headerIdx !== -1) {
    for (let i = headerIdx + 1; i < rows.length; i++) {
      const row = rows[i]
      if (!row[0] || row[0].startsWith('■')) break
      if (row.length < 15) continue
      holdings.push({
        holding_type: row[0].includes('投資信託') ? 'fund' : 'stock',
        symbol_code: row[1] || '',
        symbol_name: row[2],
        account_type: row[3],
        quantity: parseNumber(row[4]),
        avg_cost: parseNumber(row[6]),
        current_price: parseNumber(row[8]),
        market_value: parseNumber(row[14]),
        unrealized_pl: parseNumber(row[16]),
        unrealized_pl_pct: parseNumber(row[17]),
        recorded_at: recordedAt,
      })
    }
  }
  return { holdings, totals }
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
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
    const files = Array.isArray(body.files) ? body.files : []
    if (files.length === 0) {
      return res.status(400).json({ error: 'filesが指定されていません' })
    }

    const allHoldings = []
    const allTotals = []
    const fileResults = []

    const VALID_TYPES = ['assetbalanceall', 'assetbalanceinvst', 'balancesummary', 'stockposition']
    for (const f of files) {
      const { person, broker, filename, text, type } = f
      if (!person || !broker || !text || !VALID_TYPES.includes(type)) {
        fileResults.push({ filename, error: 'person/broker/text/typeが不足しています' })
        continue
      }
      let parsed
      if (type === 'assetbalanceall') parsed = parseAssetBalanceAll(text, filename)
      else if (type === 'assetbalanceinvst') parsed = parseInvst(text, filename)
      else if (type === 'balancesummary') parsed = parseBalanceSummary(text, filename)
      else parsed = parseStockPosition(text)

      for (const h of parsed.holdings) {
        if (!h.recorded_at) continue
        allHoldings.push({ user_id: user.id, person, broker, ...h })
      }
      for (const t of parsed.totals) {
        allTotals.push({ user_id: user.id, person, broker, ...t })
      }
      fileResults.push({ filename, type, holdings: parsed.holdings.length, totals: parsed.totals.length })
    }

    const dbHeaders = {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    }

    async function upsert(table, rows, onConflict) {
      const chunkSize = 500
      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize)
        const r = await fetch(
          `${url.replace(/\/$/, '')}/rest/v1/${table}?on_conflict=${onConflict}`,
          { method: 'POST', headers: dbHeaders, body: JSON.stringify(chunk) }
        )
        if (!r.ok) {
          const errBody = await r.json().catch(() => ({}))
          throw new Error(`${table}: ${JSON.stringify(errBody)}`)
        }
      }
    }

    if (allHoldings.length > 0) {
      await upsert('asset_holdings_history', allHoldings, 'user_id,person,broker,holding_type,symbol_code,symbol_name,account_type,recorded_at')
    }
    if (allTotals.length > 0) {
      await upsert('asset_total_history', allTotals, 'user_id,person,broker,recorded_at')
    }

    return res.status(200).json({
      holdings: allHoldings.length,
      totals: allTotals.length,
      files: fileResults,
    })
  } catch (err) {
    return res.status(500).json({ error: `${err?.name ?? 'Error'}: ${err?.message ?? 'unknown error'}` })
  }
}
