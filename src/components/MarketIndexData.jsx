import { useState, useMemo } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useMarketIndices, INDEX_SYMBOLS } from '../hooks/useMarketIndices'
import { useGoogleDriveLink } from '../hooks/useGoogleDriveLink'

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土']

function formatDate(s) {
  if (!s) return ''
  const [y, m, d] = s.split('-').map(Number)
  const wd = WEEKDAY_LABELS[new Date(y, m - 1, d).getDay()]
  return `${y}/${m}/${d}(${wd})`
}

const numFmt = new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 2 })

const PERIODS = [
  { id: '1m',  label: '1か月',  days: 30 },
  { id: '3m',  label: '3か月',  days: 90 },
  { id: '6m',  label: '6か月',  days: 180 },
  { id: '1y',  label: '1年',    days: 365 },
  { id: 'all', label: '全期間', days: null },
]

// 実績は黒。移動平均は同系色(青)で統一し、日数が長いほど「太く・濃く・破線が大きく」なる
// ことで直感的に短期/長期を判別できるようにする
const MA_COLOR = '0, 122, 255'
const MA_LINES = [
  { window: 5,   label: '5日',   strokeWidth: 0.8, dash: '1.5,1.5', opacity: 0.35 },
  { window: 25,  label: '25日',  strokeWidth: 1.1, dash: '2.5,2',   opacity: 0.5 },
  { window: 50,  label: '50日',  strokeWidth: 1.4, dash: '3.5,2',   opacity: 0.65 },
  { window: 75,  label: '75日',  strokeWidth: 1.7, dash: '5,2.5',   opacity: 0.8 },
  { window: 100, label: '100日', strokeWidth: 2.0, dash: '6.5,3',   opacity: 0.9 },
  { window: 200, label: '200日', strokeWidth: 2.4, dash: '8,3.5',   opacity: 1 },
]

function filterLastNDays(points, days) {
  if (!points.length || days == null) return points
  const lastDate = new Date(points[points.length - 1].trade_date)
  const cutoff = new Date(lastDate)
  cutoff.setDate(cutoff.getDate() - days)
  return points.filter(p => new Date(p.trade_date) >= cutoff)
}

// 単純移動平均（window未満の先頭区間はnull＝未描画）
function movingAverage(points, window) {
  return points.map((_, i) => {
    if (i < window - 1) return null
    let sum = 0
    for (let j = i - window + 1; j <= i; j++) sum += Number(points[j].value)
    return sum / window
  })
}

// ── 折れ線グラフ（期間切り替え＋移動平均） ──
function IndexChart({ points }) {
  const [periodId, setPeriodId] = useState('1m')
  const period = PERIODS.find(p => p.id === periodId)

  // 表示期間で絞る前の全期間データで移動平均を計算し、表示範囲の先頭でも
  // 直前の実績を使ったMAが途切れないようにする
  const fullMas = useMemo(
    () => MA_LINES.map(m => movingAverage(points, m.window)),
    [points]
  )
  const cutoffIndex = useMemo(() => {
    if (period.days == null) return 0
    const filtered = filterLastNDays(points, period.days)
    return points.length - filtered.length
  }, [points, period.days])
  const fullFiltered = useMemo(() => points.slice(cutoffIndex), [points, cutoffIndex])
  const fullMasSliced = useMemo(() => fullMas.map(ma => ma.slice(cutoffIndex)), [fullMas, cutoffIndex])

  // 件数が多いとスマホのSVG描画が重くなる/失敗するため間引く（先頭・末尾は必ず残す）
  const MAX_POINTS = 1500
  const { filtered, mas } = useMemo(() => {
    if (fullFiltered.length <= MAX_POINTS) return { filtered: fullFiltered, mas: fullMasSliced }
    const step = Math.ceil(fullFiltered.length / MAX_POINTS)
    const idx = []
    for (let i = 0; i < fullFiltered.length; i += step) idx.push(i)
    if (idx[idx.length - 1] !== fullFiltered.length - 1) idx.push(fullFiltered.length - 1)
    return {
      filtered: idx.map(i => fullFiltered[i]),
      mas: fullMasSliced.map(ma => idx.map(i => ma[i])),
    }
  }, [fullFiltered, fullMasSliced])

  const chart = useMemo(() => {
    if (filtered.length < 2) return null
    let min = Infinity
    let max = -Infinity
    for (const p of filtered) {
      const v = Number(p.value)
      if (v < min) min = v
      if (v > max) max = v
    }
    for (const ma of mas) {
      for (const v of ma) {
        if (v == null) continue
        if (v < min) min = v
        if (v > max) max = v
      }
    }
    const pad = Math.max((max - min) * 0.08, 0.01)
    const lo = min - pad
    const hi = max + pad
    const w = 100
    const h = 100
    const step = w / (filtered.length - 1)
    const toY = v => h - ((v - lo) / (hi - lo)) * h
    const linePoints = filtered.map((p, i) => ({ x: i * step, y: toY(Number(p.value)) }))
    const maLinePoints = mas.map(ma =>
      ma.map((v, i) => (v == null ? null : { x: i * step, y: toY(v) })).filter(Boolean)
    )
    return { linePoints, maLinePoints, lo, hi }
  }, [filtered, mas])

  // PC表示時のみ縦軸(値)・横軸(日付)の目盛りを出す
  const xTicks = useMemo(() => {
    if (filtered.length < 2) return []
    const n = Math.min(6, filtered.length)
    const idx = Array.from({ length: n }, (_, i) => Math.round((i * (filtered.length - 1)) / (n - 1)))
    return [...new Set(idx)].map(i => ({ pct: (i / (filtered.length - 1)) * 100, date: filtered[i].trade_date }))
  }, [filtered])

  if (filtered.length < 2) {
    return (
      <div>
        <PeriodTabs periodId={periodId} onChange={setPeriodId} />
        <p className="text-[13px] text-[#AEAEB2] py-6 text-center">この期間はデータが2件以上ありません</p>
      </div>
    )
  }

  const first = filtered[0]
  const last = filtered[filtered.length - 1]

  return (
    <div>
      <PeriodTabs periodId={periodId} onChange={setPeriodId} />
      <div className="relative h-[160px] md:h-[360px] md:pl-14 md:pb-5">
        {/* 縦軸（PCのみ） */}
        <div className="hidden md:flex flex-col justify-between absolute left-0 top-0 bottom-5 w-12 text-[10px] text-[#8E8E93] text-right pr-2">
          <span>{numFmt.format(chart.hi)}</span>
          <span>{numFmt.format((chart.hi + chart.lo) / 2)}</span>
          <span>{numFmt.format(chart.lo)}</span>
        </div>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full overflow-visible">
          <polyline
            fill="none"
            stroke="#000000"
            strokeWidth="1.3"
            vectorEffect="non-scaling-stroke"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={chart.linePoints.map(c => `${c.x},${c.y}`).join(' ')}
          />
          {MA_LINES.map((m, i) => {
            const pts = chart.maLinePoints[i]
            if (pts.length < 2) return null
            return (
              <polyline
                key={m.window}
                fill="none"
                stroke={`rgba(${MA_COLOR}, ${m.opacity})`}
                strokeWidth={m.strokeWidth}
                strokeDasharray={m.dash}
                vectorEffect="non-scaling-stroke"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={pts.map(c => `${c.x},${c.y}`).join(' ')}
              />
            )
          })}
        </svg>
        {/* 横軸（PCのみ） */}
        <div className="hidden md:block absolute left-14 right-0 bottom-0 h-5 text-[10px] text-[#8E8E93]">
          {xTicks.map(t => (
            <span key={t.date} className="absolute -translate-x-1/2 top-0" style={{ left: `${t.pct}%` }}>
              {formatDate(t.date)}
            </span>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between mt-2 text-[11px] text-[#AEAEB2]">
        <span>{formatDate(first.trade_date)}・{numFmt.format(Number(first.value))}</span>
        <span>{formatDate(last.trade_date)}・{numFmt.format(Number(last.value))}</span>
      </div>
      <p className="text-center text-[11px] text-[#AEAEB2] mt-1">{filtered.length}件</p>
    </div>
  )
}

// 実績・移動平均の凡例（各指標のグラフではなく画面上部に共通で1つだけ表示）
function ChartLegend() {
  return (
    <div className="flex items-center gap-3 flex-wrap text-[10px] text-[#8E8E93]">
      <span className="flex items-center gap-1">
        <svg width="16" height="6"><line x1="0" y1="3" x2="16" y2="3" stroke="#000000" strokeWidth="1.3" /></svg>
        実績
      </span>
      {MA_LINES.map(m => (
        <span key={m.window} className="flex items-center gap-1">
          <svg width="16" height="6">
            <line
              x1="0" y1="3" x2="16" y2="3"
              stroke={`rgba(${MA_COLOR}, ${m.opacity})`}
              strokeWidth={m.strokeWidth}
              strokeDasharray={m.dash}
            />
          </svg>
          {m.label}
        </span>
      ))}
    </div>
  )
}

function PeriodTabs({ periodId, onChange }) {
  return (
    <div className="flex gap-1.5 mb-2">
      {PERIODS.map(p => (
        <button
          key={p.id}
          onClick={() => onChange(p.id)}
          className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
            periodId === p.id ? 'bg-[#1C1C1E] text-white' : 'bg-black/[0.04] text-[#8E8E93]'
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  )
}

export default function MarketIndexData() {
  const { user } = useAuth()
  const {
    latestBySymbol, counts, loading, importing, importResult, importFromSheet,
    historyBySymbol, historyLoading, fetchHistory,
  } = useMarketIndices(user?.id)
  const { linked: driveLinked, linking: driveLinking, error: driveError, linkDrive } = useGoogleDriveLink(user?.id)
  const [expanded, setExpanded] = useState(null)

  function toggleExpand(id) {
    if (expanded === id) {
      setExpanded(null)
      return
    }
    setExpanded(id)
    fetchHistory(id)
  }

  return (
    <div className="space-y-3">
      <div className="ios-card px-4 py-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[15px] font-semibold text-[#1C1C1E]">指標データの取り込み</p>
            <p className="text-[12px] text-[#8E8E93] mt-0.5">Googleスプレッドシートから過去データを取り込みます</p>
          </div>
          <button
            onClick={importFromSheet}
            disabled={importing}
            className="flex-shrink-0 px-4 py-2.5 rounded-[10px] bg-[#007AFF] text-white text-[14px] font-semibold disabled:opacity-40 active:opacity-70 transition-opacity"
          >
            {importing ? '取り込み中…' : '取り込む'}
          </button>
        </div>

        {importResult?.error && (
          <div className="mt-3">
            <p className="text-[12px] text-[#FF3B30]">⚠ {importResult.error}</p>
            {importResult.debugSheets && (
              <pre className="mt-2 p-2 rounded-[8px] bg-black/[0.04] text-[10px] text-[#636366] overflow-x-auto whitespace-pre-wrap break-all">
                {JSON.stringify(importResult.debugSheets, null, 2)}
              </pre>
            )}
          </div>
        )}
        {importResult?.success && (
          <div className="mt-3">
            <p className="text-[12px] text-[#34C759]">
              ✓ {importResult.inserted > 0 ? `${importResult.inserted}件の新しいデータを取り込みました` : '新しいデータはありませんでした（最新の状態です）'}
            </p>
            {importResult.warnings?.length > 0 && (
              <ul className="mt-1 space-y-0.5">
                {importResult.warnings.map((w, i) => (
                  <li key={i} className="text-[11px] text-[#FF9500]">⚠ {w}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {driveLinked !== null && (
          <div className="mt-3 pt-3 border-t border-black/[0.05] flex items-center justify-between">
            <p className="text-[12px] text-[#8E8E93]">
              {driveLinked ? 'Googleドライブ連携済み' : 'Googleドライブ未連携（ビットコインのCSVは取り込まれません）'}
            </p>
            <button
              onClick={linkDrive}
              disabled={driveLinking}
              className="flex-shrink-0 px-3 py-1.5 rounded-[8px] bg-black/[0.04] text-[#1C1C1E] text-[12px] font-medium disabled:opacity-40 active:opacity-70 transition-opacity"
            >
              {driveLinking ? '連携中…' : driveLinked ? '再連携する' : 'Googleドライブと連携'}
            </button>
          </div>
        )}
        {driveError && <p className="mt-2 text-[11px] text-[#FF3B30]">⚠ {driveError}</p>}
      </div>

      <div className="ios-card overflow-hidden">
        <div className="px-4 pt-3 pb-2 space-y-1.5">
          <p className="text-[12px] font-semibold text-[#8E8E93]">最新値（タップでグラフ表示）</p>
          <ChartLegend />
        </div>
        {loading ? (
          <p className="px-4 py-6 text-center text-[13px] text-[#AEAEB2]">読み込み中…</p>
        ) : (
          <div className="divide-y divide-black/[0.04]">
            {INDEX_SYMBOLS.map(({ id, label }) => {
              const latest = latestBySymbol[id]
              const count = counts[id] ?? 0
              const isOpen = expanded === id

              return (
                <div key={id}>
                  <button
                    onClick={() => count > 0 && toggleExpand(id)}
                    disabled={count === 0}
                    className="w-full flex items-center justify-between px-4 py-2.5 text-left active:bg-black/[0.02] transition-colors"
                  >
                    <div>
                      <p className="text-[14px] font-medium text-[#1C1C1E]">{label}</p>
                      {count > 0 && <p className="text-[11px] text-[#AEAEB2]">{count}件保存済み</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        {latest ? (
                          <>
                            <p className="text-[15px] font-semibold text-[#1C1C1E] tabular-nums">{numFmt.format(Number(latest.value))}</p>
                            {latest.prevValue != null && (() => {
                              const diff = Number(latest.value) - latest.prevValue
                              const pct = latest.prevValue !== 0 ? (diff / latest.prevValue) * 100 : 0
                              const color = diff < 0 ? 'text-[#FF3B30]' : diff > 0 ? 'text-[#34C759]' : 'text-[#8E8E93]'
                              const sign = diff > 0 ? '+' : ''
                              return (
                                <p className={`text-[11px] font-medium tabular-nums ${color}`}>
                                  前日比 {sign}{numFmt.format(diff)} ({sign}{pct.toFixed(2)}%)
                                </p>
                              )
                            })()}
                            <p className="text-[11px] text-[#AEAEB2]">{formatDate(latest.trade_date)}</p>
                          </>
                        ) : (
                          <p className="text-[13px] text-[#AEAEB2]">未取り込み</p>
                        )}
                      </div>
                      {count > 0 && (
                        <svg className={`w-3.5 h-3.5 text-[#C7C7CC] flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      )}
                    </div>
                  </button>

                  {isOpen && (
                    <div className="px-4 pb-3">
                      {historyLoading[id] ? (
                        <p className="text-[13px] text-[#AEAEB2] py-6 text-center">読み込み中…</p>
                      ) : (
                        <IndexChart points={historyBySymbol[id] ?? []} />
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
