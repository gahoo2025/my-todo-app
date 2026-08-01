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

export default function StockListView() {
  const { user } = useAuth()
  const { items, loading, importing, importResult, importList } = useStockList(user?.id)
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter(it =>
      [it.symbol_code, it.symbol_name, it.category, it.sector].filter(Boolean).join(' ').toLowerCase().includes(q)
    )
  }, [items, query])

  return (
    <div className="space-y-3">
      <div className="ios-card px-4 py-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[15px] font-semibold text-[#1C1C1E]">銘柄リストの取り込み</p>
            <p className="text-[12px] text-[#8E8E93] mt-0.5">Googleドライブの銘柄リスト.csvを取り込みます</p>
          </div>
          <button
            onClick={importList}
            disabled={importing}
            className="flex-shrink-0 px-4 py-2.5 rounded-[10px] bg-[#007AFF] text-white text-[14px] font-semibold disabled:opacity-40 active:opacity-70 transition-opacity"
          >
            {importing ? '取り込み中…' : '取り込む'}
          </button>
        </div>
        {importResult?.error && (
          <div className="mt-3">
            <p className="text-[12px] text-[#FF3B30]">⚠ {importResult.error}</p>
            {importResult.warnings?.length > 0 && (
              <ul className="mt-1 space-y-0.5">
                {importResult.warnings.map((w, i) => <li key={i} className="text-[11px] text-[#FF9500]">⚠ {w}</li>)}
              </ul>
            )}
          </div>
        )}
        {importResult?.success && (
          <div className="mt-3">
            <p className="text-[12px] text-[#34C759]">✓ {importResult.imported}件を取り込みました</p>
            {importResult.warnings?.length > 0 && (
              <ul className="mt-1 space-y-0.5">
                {importResult.warnings.map((w, i) => <li key={i} className="text-[11px] text-[#FF9500]">⚠ {w}</li>)}
              </ul>
            )}
          </div>
        )}
        {importResult?.debug && (
          <details className="mt-3">
            <summary className="text-[11px] text-[#007AFF]">デバッグ情報</summary>
            <pre className="mt-2 p-2 rounded-[8px] bg-black/[0.04] text-[10px] text-[#636366] overflow-x-auto whitespace-pre-wrap break-all">
              {JSON.stringify(importResult.debug, null, 2)}
            </pre>
          </details>
        )}
      </div>

      <input
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="銘柄名・コード・分類・セクターで検索"
        className="w-full px-3 py-2.5 rounded-[10px] bg-white text-[14px] text-[#1C1C1E] placeholder:text-[#AEAEB2] shadow-[0_1px_2px_rgba(0,0,0,0.06)] focus:outline-none"
      />

      {loading ? (
        <p className="px-4 py-6 text-center text-[13px] text-[#AEAEB2]">読み込み中…</p>
      ) : filtered.length === 0 ? (
        <p className="px-4 py-6 text-center text-[13px] text-[#AEAEB2]">
          {items.length === 0 ? '「取り込む」から銘柄リストを取り込んでください' : '該当する銘柄がありません'}
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
