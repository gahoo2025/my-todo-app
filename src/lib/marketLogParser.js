// マーケットログ（実績/見通し）用パーサー
// 見出しキーワードがあれば見出しベースで分割、なければ文単位の簡易時制判定でベストエフォート分類する

const ACTUAL_HEAD_RE = /【実績】|実績[:：]|Actual[:：]/gi
const OUTLOOK_HEAD_RE = /【見通し】|見通し[:：]|Outlook[:：]|今後[:：]/gi

// 未来表現っぽい語を含む文は「見通し」寄りと判定（ベストエフォート）
const FUTURE_RE = /だろう|見込|見通し|来週|来月|今後|予定|想定|注目|しそう|になりそう|かもしれない|可能性|方針|焦点|していきたい|していきます|する見込み/
// 文末が過去形（〜した。等）なら「予定通り〜した」のような文でも実績を優先する
const PAST_ENDING_RE = /(た|だった)[。！？]?$/

const STOCK_RE = /([^\s()（）、。,\n]+?)[\(（]([0-9A-Za-z]{2,6})[\)）]/g
const SCORE_RE = /(\d+(?:\.\d+)?)\s*点/
const TODO_LINE_RE = /^-\s*\[( |x|X)\]\s*(.*)$/

function splitSentences(text) {
  const out = []
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    for (const part of trimmed.split(/(?<=[。！？])/)) {
      const s = part.trim()
      if (s) out.push(s)
    }
  }
  return out
}

function classifySentence(s) {
  if (PAST_ENDING_RE.test(s)) return 'actual'
  return FUTURE_RE.test(s) ? 'outlook' : 'actual'
}

function classifyByHeuristic(text) {
  const actualParts = []
  const outlookParts = []
  for (const s of splitSentences(text)) {
    if (classifySentence(s) === 'outlook') outlookParts.push(s)
    else actualParts.push(s)
  }
  return { actualParts, outlookParts }
}

function findHeadingMatches(text) {
  const results = []
  for (const m of text.matchAll(ACTUAL_HEAD_RE)) results.push({ index: m.index, len: m[0].length, type: 'actual' })
  for (const m of text.matchAll(OUTLOOK_HEAD_RE)) results.push({ index: m.index, len: m[0].length, type: 'outlook' })
  results.sort((a, b) => a.index - b.index)
  return results
}

// 見出しの有無を判定し、実績/見通しの2ブロックに分割する
export function splitMarketLog(rawText) {
  const text = (rawText ?? '').replace(/\r\n/g, '\n').trim()
  if (!text) return { actual: '', outlook: '', method: 'empty' }

  const heads = findHeadingMatches(text)

  if (heads.length === 0) {
    const { actualParts, outlookParts } = classifyByHeuristic(text)
    return {
      actual: actualParts.join('\n'),
      outlook: outlookParts.join('\n'),
      method: 'heuristic',
    }
  }

  const actualParts = []
  const outlookParts = []

  // 最初の見出しより前の前置き文はヒューリスティックで振り分ける
  const preamble = text.slice(0, heads[0].index).trim()
  if (preamble) {
    const c = classifyByHeuristic(preamble)
    actualParts.push(...c.actualParts)
    outlookParts.push(...c.outlookParts)
  }

  for (let i = 0; i < heads.length; i++) {
    const h = heads[i]
    const start = h.index + h.len
    const end = i + 1 < heads.length ? heads[i + 1].index : text.length
    const seg = text.slice(start, end).trim()
    if (!seg) continue
    if (h.type === 'actual') actualParts.push(seg)
    else outlookParts.push(seg)
  }

  return {
    actual: actualParts.join('\n\n'),
    outlook: outlookParts.join('\n\n'),
    method: 'heading',
  }
}

function extractStocks(blockText, block) {
  if (!blockText) return []
  const results = []
  for (const rawLine of blockText.split('\n')) {
    const line = rawLine.trim()
    if (!line) continue
    const scoreMatch = line.match(SCORE_RE)
    const score = scoreMatch ? scoreMatch[1] : null
    const re = new RegExp(STOCK_RE)
    let m
    while ((m = re.exec(line)) !== null) {
      results.push({ name: m[1].trim(), code: m[2].trim(), score, block })
    }
  }
  return results
}

function extractTodos(rawText) {
  const todos = []
  for (const rawLine of (rawText ?? '').replace(/\r\n/g, '\n').split('\n')) {
    const line = rawLine.trim()
    const m = line.match(TODO_LINE_RE)
    if (m) todos.push({ content: m[2].trim(), done: m[1].toLowerCase() === 'x' })
  }
  return todos
}

// 実績/見通しの各欄テキストから銘柄・TODOを抽出する（2欄手入力・編集後の再解析どちらにも使用）
export function analyzeBlocks(actual, outlook) {
  return {
    stocks: [
      ...extractStocks(actual, 'actual'),
      ...extractStocks(outlook, 'outlook'),
    ],
    todos: extractTodos(`${actual ?? ''}\n${outlook ?? ''}`),
  }
}

export function parseMarketLog(rawText) {
  const split = splitMarketLog(rawText)
  const stocks = [
    ...extractStocks(split.actual, 'actual'),
    ...extractStocks(split.outlook, 'outlook'),
  ]
  const todos = extractTodos(rawText)
  return {
    actual: split.actual,
    outlook: split.outlook,
    method: split.method,
    stocks,
    todos,
  }
}
