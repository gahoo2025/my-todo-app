// 資産ファイル取り込み：ファイル名の日付・種別から「取り込みセット（7ファイル一式）」を組み立てる純関数群

export const REQUIRED_COUNTS = { assetbalanceall: 2, assetbalanceinvst: 3, balancesummary: 1, stockposition: 1 }

// ファイル名の先頭パターンで種別を判定する（資産管理アプリの手動ダウンロード手順で固定）
export function detectTypeFromFilename(filename) {
  if (/^assetbalance\(all\)_/i.test(filename)) return 'assetbalanceall'
  if (/^assetbalance\(invst\)_/i.test(filename)) return 'assetbalanceinvst'
  if (/^balance-summary_/i.test(filename)) return 'balancesummary'
  if (/^stockposition/i.test(filename)) return 'stockposition'
  return null
}

// ファイル名から日付(YYYYMMDD)とその後ろのタイムスタンプ(あれば)を取り出す
export function parseFilenameStamp(filename) {
  const m = /_(\d{8})_?(\d{6})?/.exec(filename)
  if (!m) return null
  return { date: m[1], time: m[2] || '' }
}

function emptyByType() {
  return { assetbalanceall: [], assetbalanceinvst: [], balancesummary: [], stockposition: [] }
}

function countsOf(byType) {
  return Object.fromEntries(Object.keys(REQUIRED_COUNTS).map(t => [t, byType[t].length]))
}

function isComplete(counts) {
  return Object.entries(REQUIRED_COUNTS).every(([t, n]) => counts[t] === n)
}

// YYYYMMDD が暦で連続する翌日か（月またぎ・年またぎも判定）
function isNextDay(a, b) {
  const toUtc = d => Date.UTC(+d.slice(0, 4), +d.slice(4, 6) - 1, +d.slice(6, 8))
  return toUtc(b) - toUtc(a) === 24 * 60 * 60 * 1000
}

const toIsoDate = d => `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`

// 人物・証券会社の自動割り当て。並び順は「日付＋時刻」（0時をまたいでも取得順を保つ）
function assign(byType, overrideDate) {
  const sorted = t => [...byType[t]].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
  const withOverride = f => (overrideDate ? { ...f, recordedAtOverride: overrideDate } : f)
  const assigned = []
  const all = sorted('assetbalanceall')
  assigned.push(withOverride({ ...all[0], person: 'パパ', broker: '楽天' }))
  assigned.push(withOverride({ ...all[1], person: 'ママ', broker: '楽天' }))
  const invstPersons = ['長女', '次女', '長男']
  sorted('assetbalanceinvst').forEach((f, i) => assigned.push(withOverride({ ...f, person: invstPersons[i], broker: '楽天' })))
  assigned.push(withOverride({ ...byType.balancesummary[0], person: 'パパ', broker: '大和' }))
  // stockpositionの記録日はCSV内の日付列が使われるため上書きしない
  assigned.push({ ...byType.stockposition[0], person: 'パパ', broker: 'マネックス' })
  return assigned
}

function flatten(byType) {
  return [...byType.assetbalanceall, ...byType.assetbalanceinvst, ...byType.balancesummary, ...byType.stockposition]
}

// 日付ごとにグループ化。単独で揃わない日付が、暦で連続する翌日と合算して揃う場合は、
// 日付またぎの1セットとして扱う（記録日はセットの取得開始日に統一）。
export function buildGroups(files) {
  const byDate = {}
  for (const f of files) {
    const stamp = parseFilenameStamp(f.filename)
    if (!f.type || !stamp) continue
    byDate[stamp.date] ??= emptyByType()
    byDate[stamp.date][f.type].push({ ...f, date: stamp.date, time: stamp.time })
  }

  const dates = Object.keys(byDate).sort()
  const groups = []
  for (let i = 0; i < dates.length; i++) {
    const date = dates[i]
    const byType = byDate[date]
    const counts = countsOf(byType)
    if (isComplete(counts)) {
      groups.push({ date, ok: true, counts, files: assign(byType, null) })
      continue
    }

    const next = dates[i + 1]
    if (next && isNextDay(date, next) && !isComplete(countsOf(byDate[next]))) {
      const merged = emptyByType()
      for (const t of Object.keys(merged)) merged[t] = [...byType[t], ...byDate[next][t]]
      const mergedCounts = countsOf(merged)
      if (isComplete(mergedCounts)) {
        groups.push({ date, endDate: next, spansDates: true, ok: true, counts: mergedCounts, files: assign(merged, toIsoDate(date)) })
        i++
        continue
      }
    }
    groups.push({ date, ok: false, counts, files: flatten(byType) })
  }
  return groups
}
