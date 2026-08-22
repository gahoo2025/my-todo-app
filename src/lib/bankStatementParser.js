// 銀行系（横浜銀行・住友銀行・ゆうちょ・みずほ銀行）およびカード系
// （住友VISA・横浜VISA・楽天カード）の明細CSVの取引先自動判別・パース処理。
//
// 銀行系4行はShift-JIS（CP932）エンコードのプレーンCSV/準CSV。
// 住友VISA・横浜VISAもShift-JISだが、カード名義（智広様／恵美様）の切替を示す
// 「セクションヘッダー行」と明細行が混在する。楽天カードのみUTF-8（BOM付き）。
// 仕様は「仕訳ルール_統合版.xlsx」の「生CSV取り込み仕様」シートに基づく（実データ検証済み）。

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

function splitLines(text) {
  return text.split(/\r?\n/)
}

function parseAmount(text) {
  if (text == null) return null
  // Shift-JISの0x5Cは円記号(¥)として表示されることが多いが、TextDecoderは
  // バックスラッシュ(\)としてデコードするため、両方とも除去対象にする
  const cleaned = String(text).replace(/[¥￥\\,\s]/g, '')
  if (!cleaned) return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

// "2026年7月3日" -> "2026-07-03"
function parseDateKanji(text) {
  const m = /^(\d{4})年(\d{1,2})月(\d{1,2})日$/.exec((text || '').trim())
  if (!m) return null
  return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
}

// "2026/7/4" -> "2026-07-04"（ゼロ埋め無し）
function parseDateSlash(text) {
  const m = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec((text || '').trim())
  if (!m) return null
  return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
}

// "20260701" -> "2026-07-01"
function parseDate8Digit(text) {
  const m = /^(\d{4})(\d{2})(\d{2})$/.exec((text || '').trim())
  if (!m) return null
  return `${m[1]}-${m[2]}-${m[3]}`
}

// "2026.07.28" -> "2026-07-28"
function parseDateDot(text) {
  const m = /^(\d{4})\.(\d{2})\.(\d{2})$/.exec((text || '').trim())
  if (!m) return null
  return `${m[1]}-${m[2]}-${m[3]}`
}

// 住友VISA・横浜VISAの「セクションヘッダー行」（カード名義の切替を示す3フィールドの行）
// 例：小瀬村　智広　様,4980-00**-****-****,三井住友ゴールドＶＩＳＡ（ＮＬ）
const CARD_NUMBER_RE = /^\d{4}-\d{2}\*\*-\*\*\*\*-\*\*\*\*$/

function findCardHeaderLine(lines) {
  for (const line of lines) {
    if (!line.includes('様')) continue
    const f = parseCsvLine(line)
    if (f.length >= 3 && f[0].includes('様') && CARD_NUMBER_RE.test(f[1])) return f
  }
  return null
}

// 取引先判別。ヘッダー行・冒頭メタデータの特徴的な列名/文言で判定する。
export function detectInstitution(rawText) {
  const head = rawText.slice(0, 2000)
  if (head.includes('取扱日付') && head.includes('お支払金額') && head.includes('お預り金額')) return '横浜銀行'
  if (head.includes('お取り扱い内容')) return '住友銀行'
  if (head.includes('入出金明細ＩＤ') || head.includes('お客さま口座番号')) return 'ゆうちょ'
  if (head.includes('明細通番') || (head.includes('お引出金額') && head.includes('お預入金額'))) return 'みずほ銀行'
  if (head.includes('利用店名・商品名') || (head.includes('支払総額') && head.includes('繰越残高'))) return '楽天カード'
  const cardHeader = findCardHeaderLine(splitLines(head))
  if (cardHeader) {
    const cardName = cardHeader[2] || ''
    if (cardName.includes('横浜')) return '横浜VISA'
    if (cardName.includes('住友') || cardName.includes('三井住友')) return '住友VISA'
  }
  return null
}

// ファイル名に含まれる YYYYMM（例：202607.csv, enavi2026076946.csv）から
// カードの支払月を推定する。カードは利用日ではなく支払月で家計簿に計上するため。
export function billingMonthFromFilename(filename) {
  const m = /20\d{2}(0[1-9]|1[0-2])/.exec(filename || '')
  return m ? m[0] : null
}

function parseYokohamaBank(lines) {
  const rows = []
  for (const line of lines.slice(1)) {
    if (!line.trim()) continue
    const f = parseCsvLine(line)
    const date = parseDateKanji(f[0])
    if (!date) continue
    const debit = parseAmount(f[1])
    const credit = parseAmount(f[2])
    rows.push({
      transaction_date: date,
      description: f[5] || '',
      direction: debit != null ? '出金' : '入金',
      amount: debit != null ? debit : credit,
      balance: parseAmount(f[4]),
    })
  }
  return rows
}

function parseSumitomoBank(lines) {
  const rows = []
  for (const line of lines.slice(1)) {
    if (!line.trim()) continue
    const f = parseCsvLine(line)
    const date = parseDateSlash(f[0])
    if (!date) continue
    const debit = parseAmount(f[1])
    const credit = parseAmount(f[2])
    rows.push({
      transaction_date: date,
      description: f[3] || '',
      direction: debit != null ? '出金' : '入金',
      amount: debit != null ? debit : credit,
      balance: parseAmount(f[4]),
    })
  }
  return rows
}

function parseYucho(lines) {
  const headerIdx = lines.findIndex(l => l.includes('入出金明細ＩＤ'))
  const rows = []
  for (const line of lines.slice(headerIdx + 1)) {
    if (!line.trim()) continue
    const f = parseCsvLine(line)
    const date = parseDate8Digit(f[0])
    if (!date) continue
    const credit = parseAmount(f[2])
    const debit = parseAmount(f[3])
    const detail1 = f[4] || ''
    const detail2 = f[5] || ''
    rows.push({
      transaction_date: date,
      description: detail2 ? `${detail1}/${detail2}` : detail1,
      direction: credit != null ? '入金' : '出金',
      amount: credit != null ? credit : debit,
      balance: parseAmount(f[6]),
    })
  }
  return rows
}

function parseMizuhoBank(lines) {
  const headerIdx = lines.findIndex(l => l.includes('明細通番'))
  const rows = []
  for (const line of lines.slice(headerIdx + 1)) {
    if (!line.trim()) continue
    const f = parseCsvLine(line)
    const date = parseDateDot(f[1])
    if (!date) continue
    const debit = parseAmount(f[2])
    const credit = parseAmount(f[3])
    rows.push({
      transaction_date: date,
      description: f[5] || '',
      direction: debit != null ? '出金' : '入金',
      amount: debit != null ? debit : credit,
      balance: parseAmount(f[4]),
    })
  }
  return rows
}

// 住友VISA・横浜VISA：セクションヘッダー行（カード名義切替）と明細行（日付始まり）が
// 混在する形式。ヘッダー行で名義（智広／恵美）を切り替えながら明細をパースする。
function parseVisaCard(lines) {
  const rows = []
  let holder = '智広' // 智広様の本カード／ApplePay・iDともにデフォルトは智広扱い
  for (const line of lines) {
    if (!line.trim()) continue
    const f = parseCsvLine(line)
    if (f.length >= 3 && f[0].includes('様') && CARD_NUMBER_RE.test(f[1])) {
      holder = f[0].includes('恵美') ? '恵美' : '智広'
      continue
    }
    const date = parseDateSlash(f[0])
    if (!date) continue
    const amount = parseAmount(f[2])
    if (amount == null) continue
    rows.push({
      transaction_date: date,
      description: f[1] || '',
      direction: '出金',
      amount,
      balance: null,
      holder,
    })
  }
  return rows
}

// 楽天カード（enavi明細）：引用符付きヘッダー行1行＋明細行のみのシンプルな形式。
function parseRakutenCard(lines) {
  const rows = []
  for (const line of lines.slice(1)) {
    if (!line.trim()) continue
    const f = parseCsvLine(line)
    const date = parseDateSlash(f[0])
    if (!date) continue
    const amount = parseAmount(f[4])
    if (amount == null) continue
    rows.push({
      transaction_date: date,
      description: f[1] || '',
      direction: '出金',
      amount,
      balance: null,
      holder: null,
    })
  }
  return rows
}

// 取引先を判別した上でパースする。判別できない場合は null を返す。
export function parseBankStatement(rawText) {
  const institution = detectInstitution(rawText)
  if (!institution) return null
  const lines = splitLines(rawText)
  let rows
  if (institution === '横浜銀行') rows = parseYokohamaBank(lines)
  else if (institution === '住友銀行') rows = parseSumitomoBank(lines)
  else if (institution === 'ゆうちょ') rows = parseYucho(lines)
  else if (institution === 'みずほ銀行') rows = parseMizuhoBank(lines)
  else if (institution === '住友VISA' || institution === '横浜VISA') rows = parseVisaCard(lines)
  else rows = parseRakutenCard(lines)
  return { institution, rows }
}
