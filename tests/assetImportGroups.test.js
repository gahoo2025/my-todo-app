import test from 'node:test'
import assert from 'node:assert/strict'
import { buildGroups, detectTypeFromFilename } from '../src/lib/assetImportGroups.js'

const mk = (filename) => ({ filename, type: detectTypeFromFilename(filename), text: '' })
const day = (d, t = {}) => [
  ...(t.all ?? ['100000', '100100']).map(x => mk(`assetbalance(all)_${d}_${x}.csv`)),
  ...(t.invst ?? ['100200', '100300', '100400']).map(x => mk(`assetbalance(INVST)_${d}_${x}.csv`)),
  mk(`balance-summary_${d}${t.summary ?? '100500'}.csv`),
  mk(`stockposition_${d}.csv`),
]
const names = g => g.files.map(f => `${f.person}:${f.filename}`)

test('①通常: 1日で7ファイル → 1セット・上書きなし', () => {
  const gs = buildGroups(day('20261024'))
  assert.equal(gs.length, 1)
  assert.equal(gs[0].ok, true)
  assert.equal(gs[0].spansDates, undefined)
  assert.equal(gs[0].files.length, 7)
  assert.ok(gs[0].files.every(f => f.recordedAtOverride === undefined))
  assert.deepEqual(gs[0].files.map(f => f.person), ['パパ', 'ママ', '長女', '次女', '長男', 'パパ', 'パパ'])
})

test('②画面のケース: 10/24(all1,summary1,stock1)+10/25(all1,invst3) → 日付またぎ1セット', () => {
  const files = [
    mk('assetbalance(all)_20261024_235900.csv'),
    mk('balance-summary_20261024235930.csv'),
    mk('stockposition_20261024.csv'),
    mk('assetbalance(all)_20261025_000100.csv'),
    mk('assetbalance(INVST)_20261025_000200.csv'),
    mk('assetbalance(INVST)_20261025_000300.csv'),
    mk('assetbalance(INVST)_20261025_000400.csv'),
  ]
  const gs = buildGroups(files)
  assert.equal(gs.length, 1)
  const g = gs[0]
  assert.equal(g.ok, true)
  assert.equal(g.spansDates, true)
  assert.equal(g.date, '20261024')
  assert.equal(g.endDate, '20261025')
  // 0時をまたいでも取得順で人物を割り当て（23:59→パパ、00:01→ママ）
  assert.equal(g.files[0].filename, 'assetbalance(all)_20261024_235900.csv')
  assert.equal(g.files[0].person, 'パパ')
  assert.equal(g.files[1].filename, 'assetbalance(all)_20261025_000100.csv')
  assert.equal(g.files[1].person, 'ママ')
  assert.deepEqual(g.files.slice(2, 5).map(f => f.person), ['長女', '次女', '長男'])
  // 記録日は取得開始日。stockpositionのみ上書きなし
  for (const f of g.files) {
    if (f.type === 'stockposition') assert.equal(f.recordedAtOverride, undefined)
    else assert.equal(f.recordedAtOverride, '2026-10-24')
  }
})

test('③連続2日とも単独で揃っている → 2セット（合算しない）', () => {
  const gs = buildGroups([...day('20261024'), ...day('20261025')])
  assert.equal(gs.length, 2)
  assert.ok(gs.every(g => g.ok && !g.spansDates))
})

test('④合算しても揃わない → スキップ', () => {
  const gs = buildGroups([
    mk('assetbalance(all)_20261024_100000.csv'),
    mk('assetbalance(all)_20261025_100000.csv'),
  ])
  assert.equal(gs.length, 2)
  assert.ok(gs.every(g => !g.ok))
})

test('⑤暦で連続しない日付は合算しない', () => {
  const files = [
    mk('assetbalance(all)_20261024_235900.csv'),
    mk('balance-summary_20261024235930.csv'),
    mk('stockposition_20261024.csv'),
    mk('assetbalance(all)_20261026_000100.csv'),
    mk('assetbalance(INVST)_20261026_000200.csv'),
    mk('assetbalance(INVST)_20261026_000300.csv'),
    mk('assetbalance(INVST)_20261026_000400.csv'),
  ]
  const gs = buildGroups(files)
  assert.equal(gs.length, 2)
  assert.ok(gs.every(g => !g.ok))
})

test('⑥月またぎ・年またぎでも連続日として合算', () => {
  const files = [
    mk('assetbalance(all)_20261231_235900.csv'),
    mk('balance-summary_20261231235930.csv'),
    mk('stockposition_20261231.csv'),
    mk('assetbalance(all)_20270101_000100.csv'),
    mk('assetbalance(INVST)_20270101_000200.csv'),
    mk('assetbalance(INVST)_20270101_000300.csv'),
    mk('assetbalance(INVST)_20270101_000400.csv'),
  ]
  const gs = buildGroups(files)
  assert.equal(gs.length, 1)
  assert.equal(gs[0].files[0].recordedAtOverride, '2026-12-31')
})

test('⑦3日にまたがる → スキップ', () => {
  const gs = buildGroups([
    mk('assetbalance(all)_20261024_100000.csv'),
    mk('assetbalance(INVST)_20261025_100000.csv'),
    mk('assetbalance(INVST)_20261025_100100.csv'),
    mk('assetbalance(INVST)_20261025_100200.csv'),
    mk('assetbalance(all)_20261026_100000.csv'),
    mk('balance-summary_20261026100000.csv'),
    mk('stockposition_20261026.csv'),
  ])
  assert.ok(gs.every(g => !g.ok))
})

test('⑧完全な日の前日が不揃いでも、完全な日を巻き込まない', () => {
  const gs = buildGroups([mk('assetbalance(all)_20261023_100000.csv'), ...day('20261024')])
  assert.equal(gs.length, 2)
  assert.equal(gs[0].ok, false)
  assert.equal(gs[1].ok, true)
  assert.equal(gs[1].spansDates, undefined)
})

test('⑨A+Bは不一致だがB+Cで一致 → AはスキップしてB+Cを合算', () => {
  const files = [
    mk('stockposition_20261023.csv'),
    mk('assetbalance(all)_20261024_235900.csv'),
    mk('balance-summary_20261024235930.csv'),
    mk('assetbalance(all)_20261025_000100.csv'),
    mk('assetbalance(INVST)_20261025_000200.csv'),
    mk('assetbalance(INVST)_20261025_000300.csv'),
    mk('assetbalance(INVST)_20261025_000400.csv'),
    mk('stockposition_20261025.csv'),
  ]
  const gs = buildGroups(files)
  assert.equal(gs.length, 2)
  assert.equal(gs[0].ok, false)
  assert.equal(gs[1].ok, true)
  assert.equal(gs[1].date, '20261024')
  assert.equal(gs[1].endDate, '20261025')
})

test('⑩1日目が揃い、2日目+3日目が合算で揃う → 1日目は単独、2〜3日目が日付またぎ', () => {
  const files = [
    ...day('20261023'),
    mk('assetbalance(all)_20261024_235900.csv'),
    mk('balance-summary_20261024235930.csv'),
    mk('stockposition_20261024.csv'),
    mk('assetbalance(all)_20261025_000100.csv'),
    mk('assetbalance(INVST)_20261025_000200.csv'),
    mk('assetbalance(INVST)_20261025_000300.csv'),
    mk('assetbalance(INVST)_20261025_000400.csv'),
  ]
  const gs = buildGroups(files)
  assert.equal(gs.length, 2)
  assert.equal(gs[0].spansDates, undefined)
  assert.equal(gs[1].spansDates, true)
  assert.equal(gs[1].date, '20261024')
})
