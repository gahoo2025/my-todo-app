// 資産タブ「家族の資産」のポートフォリオ内訳（円グラフ）用の分類ロジック。
// asset_holdings_history の holding_type（'stock' | 'fund'）と symbol_name から、
// 「個別株 / 投信・日本 / 投信・米国 / 投信・全世界 / 投信・先進国(除く日本) / 投信・新興国 / 投信・その他」
// のいずれかに分類する。

export const CATEGORY_ORDER = [
  '個別株',
  '投信・日本',
  '投信・米国',
  '投信・全世界',
  '投信・先進国(除く日本)',
  '投信・新興国',
  '投信・その他',
]

export const CATEGORY_COLORS = {
  '個別株': '#8E8E93',
  '投信・日本': '#007AFF',
  '投信・米国': '#34C759',
  '投信・全世界': '#AF52DE',
  '投信・先進国(除く日本)': '#FF9500',
  '投信・新興国': '#FF3B30',
  '投信・その他': '#C7C7CC',
}

const JAPAN_RE = /日経225|TOPIX|国内株式/
const US_RE = /S&P500|全米株式|米国株式|FANG/
const WORLD_RE = /全世界株式|オールカントリー|オルカン/
const DEV_EX_JAPAN_RE = /外国株式|グローバル株式/
const EMERGING_RE = /新興国/

export function classifyHolding(h) {
  if (h.holding_type !== 'fund') return '個別株'
  const name = h.symbol_name || ''
  if (JAPAN_RE.test(name)) return '投信・日本'
  if (US_RE.test(name)) return '投信・米国'
  if (WORLD_RE.test(name)) return '投信・全世界'
  if (DEV_EX_JAPAN_RE.test(name)) return '投信・先進国(除く日本)'
  if (EMERGING_RE.test(name)) return '投信・新興国'
  return '投信・その他'
}

// holdings（複数人分をフラットにした配列）から、カテゴリごとの合計額を集計する。
// 戻り値は CATEGORY_ORDER の順に並んだ、金額が0より大きいものだけの配列。
export function aggregateByCategory(holdings) {
  const totals = {}
  for (const h of holdings) {
    const cat = classifyHolding(h)
    totals[cat] = (totals[cat] ?? 0) + Number(h.market_value ?? 0)
  }
  const grandTotal = Object.values(totals).reduce((s, v) => s + v, 0)
  return CATEGORY_ORDER
    .filter(cat => (totals[cat] ?? 0) > 0)
    .map(cat => ({
      category: cat,
      amount: totals[cat],
      pct: grandTotal > 0 ? (totals[cat] / grandTotal) * 100 : 0,
      color: CATEGORY_COLORS[cat],
    }))
}
