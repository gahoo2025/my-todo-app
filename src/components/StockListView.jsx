import { useState, useMemo } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useStockList } from '../hooks/useStockList'

const numFmt = new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 2 })

// 最終判定の内容から色分けバッジのスタイルを決める
function judgementBadge(v) {
  if (!v) return { bg: 'bg-black/[0.05]', text: 'text-[#8E8E93]' }
  if (v.includes('購入候補') || v.includes('買い')) return { bg: 'bg-[#34C759]/12', text: 'text-[#248A3D]' }
  if (v.includes('一次除外') || v.includes('対象外') || v.includes('恒久除外') || v.includes('除外')) {
    return { bg: 'bg-black/[0.05]', text: 'text-[#8E8E93]' }
  }
  return { bg: 'bg-[#007AFF]/10', text: 'text-[#007AFF]' }
}

// 最終判定での絞り込みチップ。部分一致でグルーピングし（表記ゆれに対応）、優先度の高いものから並べる
const JUDGEMENT_FILTERS = [
  { id: 'buy',     label: '購入候補',   match: v => v.includes('購入候補') || v.includes('買い') },
  { id: 'watch',   label: '監視リスト', match: v => v.includes('監視') },
  { id: 'pass',    label: '見送り',     match: v => v.includes('見送り') },
  { id: 'exclude', label: '除外',       match: v => v.includes('除外') },
  { id: 'na',      label: '対象外',     match: v => v.includes('対象外') },
]

export default function StockListView() {
  const { user } = useAuth()
  const { items, loading } = useStockList(user?.id)
  const [query, setQuery] = useState('')
  const [judgementFilter, setJudgementFilter] = useState('all')

  // データに実際に存在する判定だけをチップとして出す
  const availableFilters = useMemo(
    () => JUDGEMENT_FILTERS.filter(f => items.some(it => it.final_judgement && f.match(it.final_judgement))),
    [items]
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const activeFilter = JUDGEMENT_FILTERS.find(f => f.id === judgementFilter)
    return items.filter(it => {
      if (activeFilter && !(it.final_judgement && activeFilter.match(it.final_judgement))) return false
      if (!q) return true
      return [it.symbol_code, it.symbol_name, it.category, it.sector].filter(Boolean).join(' ').toLowerCase().includes(q)
    })
  }, [items, query, judgementFilter])

  return (
    <div className="space-y-3">
      <div className="sticky top-below-subtabs z-[4] -mx-4 px-4 pt-2 pb-2 bg-[#F2F2F7]/85 backdrop-blur-xl space-y-2">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="銘柄名・コード・分類・セクターで検索"
          className="w-full px-3 py-2.5 rounded-[10px] bg-white text-[14px] text-[#1C1C1E] placeholder:text-[#AEAEB2] shadow-[0_1px_2px_rgba(0,0,0,0.06)] focus:outline-none"
        />
        {availableFilters.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto">
            <button
              onClick={() => setJudgementFilter('all')}
              className={`flex-shrink-0 px-3 h-7 rounded-full text-[12px] font-medium transition-colors ${
                judgementFilter === 'all' ? 'bg-[#1C1C1E] text-white' : 'bg-white text-[#1C1C1E] shadow-[0_1px_2px_rgba(0,0,0,0.06)]'
              }`}
            >
              すべて
            </button>
            {availableFilters.map(f => (
              <button
                key={f.id}
                onClick={() => setJudgementFilter(f.id)}
                className={`flex-shrink-0 px-3 h-7 rounded-full text-[12px] font-medium transition-colors ${
                  judgementFilter === f.id ? 'bg-[#1C1C1E] text-white' : 'bg-white text-[#1C1C1E] shadow-[0_1px_2px_rgba(0,0,0,0.06)]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <p className="px-4 py-6 text-center text-[13px] text-[#AEAEB2]">読み込み中…</p>
      ) : filtered.length === 0 ? (
        <p className="px-4 py-6 text-center text-[13px] text-[#AEAEB2]">
          {items.length === 0 ? '銘柄リストのデータがまだありません（分析スキルからDB連携してください）' : '該当する銘柄がありません'}
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.map(it => {
            const badge = judgementBadge(it.final_judgement)
            return (
              <div key={it.symbol_code} className="ios-card px-4 py-3.5">
                {/* 銘柄名・コード・分類・セクター */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="text-[15px] font-semibold text-[#1C1C1E]">
                    {it.symbol_name || '（銘柄名なし）'}
                    <span className="text-[12px] font-normal text-[#AEAEB2] ml-1.5 tabular-nums">{it.symbol_code}</span>
                  </p>
                  {it.final_judgement && (
                    <p className={`text-[11px] font-semibold px-2 py-1 rounded-full ${badge.bg} ${badge.text}`}>
                      {it.final_judgement}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  {it.category && (
                    <span className="text-[11px] font-medium px-1.5 py-0.5 rounded-full bg-[#007AFF]/10 text-[#007AFF]">{it.category}</span>
                  )}
                  {it.sector && <span className="text-[11px] text-[#8E8E93]">{it.sector}</span>}
                </div>

                {/* 株価・配当（重要指標として銘柄名の直下にラベル付きで表示） */}
                <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-black/[0.05]">
                  <div>
                    <p className="text-[10px] text-[#AEAEB2]">最新株価</p>
                    <p className="text-[14px] font-semibold text-[#1C1C1E] tabular-nums">
                      {it.latest_price != null ? `${numFmt.format(it.latest_price)}円` : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-[#AEAEB2]">配当額</p>
                    <p className="text-[14px] font-semibold text-[#1C1C1E] tabular-nums">
                      {it.dividend_amount != null ? `${numFmt.format(it.dividend_amount)}円` : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-[#AEAEB2]">配当利回り</p>
                    <p className="text-[14px] font-semibold text-[#1C1C1E] tabular-nums">
                      {it.dividend_yield != null ? `${numFmt.format(it.dividend_yield)}%` : '—'}
                    </p>
                  </div>
                </div>

                {/* Layer判定・除外・更新日時（すべて常時表示） */}
                <div className="mt-3 pt-3 border-t border-black/[0.05] space-y-1">
                  <p className="text-[12px] text-[#636366]"><span className="font-semibold text-[#8E8E93]">Layer1判定</span> {it.layer1_judgement || '—'}</p>
                  <p className="text-[12px] text-[#636366]"><span className="font-semibold text-[#8E8E93]">Layer2の状況</span> {it.layer2_status || '—'}</p>
                  <p className="text-[12px] text-[#636366]"><span className="font-semibold text-[#8E8E93]">Layer2信号</span> {it.layer2_signal || '—'}</p>
                  {it.excluded && (
                    <p className="text-[12px] text-[#FF3B30]"><span className="font-semibold">除外</span> {it.excluded}</p>
                  )}
                  {it.screened_at && (
                    <p className="text-[11px] text-[#AEAEB2] pt-1">更新スクリーニング日時: {it.screened_at}</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
