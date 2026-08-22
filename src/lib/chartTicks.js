// 折れ線グラフ共通：縦軸・横軸の「キリのいい」目盛りを算出するユーティリティ。
// AssetHistoryChart（資産推移）・MarketIndexData（指標データ）で共用する。

// 1,2,5刻みの「キリのいい」数値を算出する（D3のnice-ticksと同様の考え方）
function niceNum(range, round) {
  const exponent = Math.floor(Math.log10(range))
  const fraction = range / 10 ** exponent
  let niceFraction
  if (round) {
    if (fraction < 1.5) niceFraction = 1
    else if (fraction < 3) niceFraction = 2
    else if (fraction < 7) niceFraction = 5
    else niceFraction = 10
  } else {
    if (fraction <= 1) niceFraction = 1
    else if (fraction <= 2) niceFraction = 2
    else if (fraction <= 5) niceFraction = 5
    else niceFraction = 10
  }
  return niceFraction * 10 ** exponent
}

// 縦軸：min〜maxを含む、キリのいい目盛り値の配列を返す
// （金額の場合、1,2,5 × 10^n刻みになるため、値が大きい範囲では自然に千万単位の区切りになる）
export function niceTicks(min, max, count = 4) {
  if (min === max) return { niceMin: min, niceMax: max, ticks: [min] }
  const range = niceNum(max - min, false)
  const step = niceNum(range / (count - 1), true)
  const niceMin = Math.floor(min / step) * step
  const niceMax = Math.ceil(max / step) * step
  const ticks = []
  for (let v = niceMin; v <= niceMax + step * 0.5; v += step) ticks.push(Math.round(v * 1e6) / 1e6)
  return { niceMin, niceMax, ticks }
}

// 横軸：等間隔インデックスではなく、年初・月初などキリのいい日付（区切り）に揃えた目盛りを返す。
// points は { [dateKey]: string } を持つオブジェクトの配列、dateKey は日付フィールド名（例: 'trade_date'）。
// labelFn(date) を渡さない場合は formatDate（デフォルト表示）を使う。
export function monthAlignedXTicks(points, dateKey, labelFn) {
  if (points.length < 2) return []

  const firstStr = points[0][dateKey]
  const lastStr = points[points.length - 1][dateKey]
  const firstDate = new Date(firstStr)
  const lastDate = new Date(lastStr)
  const spanDays = (lastDate - firstDate) / 86400000

  // 表示範囲に応じて、年初(1/1)または月初(1日)の候補日を作る
  let boundaries = []
  let boundaryLabelFn = null
  if (spanDays > 545) {
    // 1.5年を超える範囲は年初刻み
    for (let y = firstDate.getFullYear(); y <= lastDate.getFullYear(); y++) {
      boundaries.push(new Date(y, 0, 1))
    }
    boundaryLabelFn = d => `${d.getFullYear()}年`
  } else if (spanDays > 20) {
    // それ以外は月初刻み（範囲が長ければ間引いて最大6本程度にする）
    const months = []
    let d = new Date(firstDate.getFullYear(), firstDate.getMonth(), 1)
    const end = new Date(lastDate.getFullYear(), lastDate.getMonth(), 1)
    while (d <= end) {
      months.push(new Date(d))
      d = new Date(d.getFullYear(), d.getMonth() + 1, 1)
    }
    const monthStep = Math.max(1, Math.ceil(months.length / 6))
    boundaries = months.filter((_, i) => i % monthStep === 0)
    boundaryLabelFn = d => `${d.getFullYear()}/${d.getMonth() + 1}月`
  }

  if (boundaries.length >= 2) {
    const toStr = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const ticks = []
    for (const b of boundaries) {
      const bStr = toStr(b)
      if (bStr < firstStr) continue
      const idx = points.findIndex(p => p[dateKey] >= bStr)
      if (idx === -1) continue
      ticks.push({ pct: (idx / (points.length - 1)) * 100, date: points[idx][dateKey], label: boundaryLabelFn(b) })
    }
    if (ticks.length >= 2) return ticks
  }

  // 短い期間はキリのいい日付にできないため、等間隔インデックスにフォールバック
  const n = Math.min(6, points.length)
  const idx = Array.from({ length: n }, (_, i) => Math.round((i * (points.length - 1)) / (n - 1)))
  return [...new Set(idx)].map(i => ({
    pct: (i / (points.length - 1)) * 100,
    date: points[i][dateKey],
    label: labelFn ? labelFn(points[i][dateKey]) : points[i][dateKey],
  }))
}
