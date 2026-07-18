// 「株価見通し記録簿」用: Claude.ai から出力される週次サマリーMarkdownのパーサー

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function extractSection(text, headingPattern) {
  // 'm'フラグを付けると $ が各行末にもマッチしてしまい、複数行の本文が1行目で
  // 打ち切られるため、ここでは付けない（末尾判定は文字列全体の終端でよい）
  const re = new RegExp(headingPattern + '\\s*\\n([\\s\\S]*?)(?=\\n###\\s|$)')
  const m = text.match(re)
  return m ? m[1].trim() : null
}

const STOCK_LINE_RE = /^-\s*(.+?)\s*\((.+?)\)\s*(?:(\d+(?:\.\d+)?)\s*点\s*)?(?:→|->)\s*(.+)$/
const TODO_LINE_RE = /^-\s*\[( |x|X)\]\s*(.*)$/
const TODO_DATE_RE = /^(\d{1,4}[\/\-]\d{1,2}(?:[\/\-]\d{1,2})?)\s+(.*)$/

export function parseStockLog(rawText) {
  const text = (rawText ?? '').replace(/\r\n/g, '\n')
  const warnings = []

  const titleMatch = text.match(/^##\s*週次サマリー\s*(.+)$/m)
  const weekLabel = titleMatch ? titleMatch[1].trim() : null

  const marketSummaryRaw = extractSection(text, '###\\s*相場動向')
  const screeningBlock = extractSection(text, '###\\s*スクリーニング結果')
  const todoBlock = extractSection(text, '###\\s*TODO')

  const hasAnySection = !!(titleMatch || marketSummaryRaw || screeningBlock || todoBlock)

  if (!hasAnySection) {
    return {
      weekLabel: null,
      recordDate: todayStr(),
      marketSummary: text.trim(),
      stocks: [],
      todos: [],
      warnings: [],
      parseFailed: true,
    }
  }

  const stocks = []
  if (screeningBlock) {
    for (const raw of screeningBlock.split('\n')) {
      const line = raw.trim()
      if (!line) continue
      const m = line.match(STOCK_LINE_RE)
      if (m) {
        stocks.push({
          name: m[1].trim(),
          code: m[2].trim(),
          score: m[3] ? m[3].trim() : null,
          status: m[4].trim(),
        })
      } else if (line.startsWith('-')) {
        warnings.push(`スクリーニング行を解析できませんでした: ${line}`)
      }
    }
  }

  const todos = []
  if (todoBlock) {
    for (const raw of todoBlock.split('\n')) {
      const line = raw.trim()
      if (!line) continue
      const m = line.match(TODO_LINE_RE)
      if (m) {
        const done = m[1].toLowerCase() === 'x'
        const rest = m[2].trim()
        const dm = rest.match(TODO_DATE_RE)
        if (dm) {
          todos.push({ date: dm[1], content: dm[2].trim(), done })
        } else {
          todos.push({ date: null, content: rest, done })
        }
      } else if (line.startsWith('-')) {
        warnings.push(`TODO行を解析できませんでした: ${line}`)
      }
    }
  }

  let recordDate = todayStr()
  if (weekLabel) {
    const dm = weekLabel.match(/(\d{4}-\d{2}-\d{2})/)
    if (dm) recordDate = dm[1]
  }

  return {
    weekLabel,
    recordDate,
    marketSummary: marketSummaryRaw,
    stocks,
    todos,
    warnings,
    parseFailed: false,
  }
}
