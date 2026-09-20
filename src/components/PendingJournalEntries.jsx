import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useBankStatementImport } from '../hooks/useBankStatementImport'
import { useJournalClassificationMap } from '../hooks/useJournalClassificationMap'
import { ALL_CLASSIFICATIONS, classificationsForInstitution } from '../lib/journalRules'

const yen = new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 0 })

// 確認要の候補ボタン1つ分。ラベル（分類１）の下に、journal_classification_mapから引いた
// 分類２・分類３を常時小さく表示する（2026-09-19、本人の指示。候補ごとに別の「詳細」ボタンを
// 置くと第3段階＝全分類でボタン数が倍増し使い勝手が悪化するため、追加の操作要素は作らず
// サブテキスト表示のみにした）。対応データが無い場合は何も表示しない。
function CandidateButton({ classification, institution, classificationMap, disabled, onClick }) {
  const detail = classificationMap.get(`${institution}|${classification}`)
  const sub = detail ? [detail.classification_2, detail.classification_3].filter(Boolean).join(' / ') : ''
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="px-3 py-1.5 rounded-[14px] bg-[#007AFF]/10 text-[#007AFF] text-[13px] font-medium active:opacity-60 disabled:opacity-40 text-left"
    >
      <span className="block">{classification}</span>
      {sub && <span className="block text-[10px] font-normal text-[#AEAEB2] mt-0.5">{sub}</span>}
    </button>
  )
}

// 確認要の候補を3段階（摘要固有→取引先全体→全取引先共通）で組み立てる。
// stageが進むごとに、既に表示済みの候補は重複させない（2026-09-19新設）。
function candidatesForStage(item, stage) {
  const stage0 = item.candidates
  const stage1All = classificationsForInstitution(item.institution)
  const stage1 = stage1All.filter(c => !stage0.includes(c))
  const stage2 = ALL_CLASSIFICATIONS.filter(c => !stage0.includes(c) && !stage1All.includes(c))
  if (stage === 0) return { shown: stage0, hasMore: stage1.length > 0 }
  if (stage === 1) return { shown: [...stage0, ...stage1], hasMore: stage2.length > 0 }
  return { shown: [...stage0, ...stage1, ...stage2], hasMore: false }
}

// 選択中の1件を確定するための、メモ入力＋分類候補ボタンのパネル（行タップで展開する部分）。
function ResolvePanel({ item, classificationMap, resolving, queueError, onResolve }) {
  const [memoInput, setMemoInput] = useState('')
  const [otherStage, setOtherStage] = useState(0)

  const { shown, hasMore } = candidatesForStage(item, otherStage)

  return (
    <div className="px-3 pb-3 pt-1 bg-black/[0.015]">
      <input
        type="text"
        value={memoInput}
        onChange={e => setMemoInput(e.target.value)}
        placeholder="メモ（任意）"
        disabled={resolving}
        className="w-full px-3 py-2 rounded-[10px] bg-white text-[13px] text-[#1C1C1E] placeholder:text-[#AEAEB2] focus:outline-none mb-2 disabled:opacity-60"
      />
      <div className="flex flex-wrap gap-2">
        {shown.map(c => (
          <CandidateButton
            key={c}
            classification={c}
            institution={item.institution}
            classificationMap={classificationMap}
            disabled={resolving}
            onClick={() => onResolve(c, memoInput)}
          />
        ))}
        {hasMore && (
          <button
            onClick={() => setOtherStage(s => s + 1)}
            disabled={resolving}
            className="px-3 py-1.5 rounded-full bg-black/[0.06] text-[#8E8E93] text-[13px] font-medium active:opacity-60 disabled:opacity-40"
          >
            その他
          </button>
        )}
        <button
          onClick={() => onResolve(null, memoInput)}
          disabled={resolving}
          className="px-3 py-1.5 rounded-full bg-black/[0.06] text-[#8E8E93] text-[13px] font-medium active:opacity-60 disabled:opacity-40"
        >
          未分類のまま保存
        </button>
      </div>
      {queueError && (
        <p className="mt-2 text-[13px] text-[#FF3B30]">保存に失敗しました：{queueError}（もう一度お試しください）</p>
      )}
    </div>
  )
}

// 「明細インポート」から独立した未仕訳（確認要）タブ。フォルダ選択API（PC専用）には依存しないため、
// スマホからも仕訳の確認・確定ができる（2026-09-20、本人の指示：「明細インポートの未仕訳も外だし
// すべき」「スマホから仕訳ができない」。未仕訳キュー（journal_pending_entries）はDB保存されており、
// 明細インポート画面のフォルダスキャンとは独立して読み書きできるため、フォルダ選択の可否に
// 関わらずこのタブ単体で完結する）。
// 未仕訳を全件一覧表示し、任意の1件をタップして仕訳できる（2026-09-20、本人の指示：
// 「未仕訳は全部確認できるようにしてほしい」「選んだやつから仕訳させて」。1件ずつ強制的に
// 先頭から処理させる方式をやめ、リストから選んで確定できるアコーディオン形式にした）。
export default function PendingJournalEntries({ onImported }) {
  const { user } = useAuth()
  const { queue, queueError, resolvingPendingId, resolveQueueItem } = useBankStatementImport(user?.id, onImported)
  const { map: classificationMap } = useJournalClassificationMap(user?.id)
  const [selectedId, setSelectedId] = useState(null)

  // キューが更新されて選択中の項目が無くなった場合（確定済み等）は選択を解除する
  useEffect(() => {
    if (selectedId != null && !queue.some(item => item.pendingId === selectedId)) {
      setSelectedId(null)
    }
  }, [queue, selectedId])

  const totals = useMemo(() => {
    let out = 0
    let inn = 0
    for (const item of queue) {
      const amount = Number(item.amount) || 0
      if (item.direction === '出金') out += amount
      else inn += amount
    }
    return { count: queue.length, out, inn }
  }, [queue])

  async function handleResolve(pendingId, classification, memo) {
    await resolveQueueItem(pendingId, classification, memo)
  }

  return (
    <div className="space-y-3">
      <div className="ios-card px-4 py-4">
        <p className="text-[13px] font-semibold text-[#1C1C1E] mb-1">未仕訳（確認要）</p>
        <p className="text-[12px] text-[#8E8E93]">
          明細インポートで自動分類できなかった取引です。タップした明細から仕訳を確定できます。
        </p>
      </div>

      {totals.count > 0 && (
        <div className="ios-card px-4 py-3.5 grid grid-cols-3 gap-2">
          <div>
            <p className="text-[10px] text-[#AEAEB2]">件数</p>
            <p className="text-[16px] font-semibold text-[#1C1C1E] tabular-nums">{yen.format(totals.count)}件</p>
          </div>
          <div>
            <p className="text-[10px] text-[#AEAEB2]">出金合計</p>
            <p className="text-[16px] font-semibold text-[#1C1C1E] tabular-nums">{yen.format(totals.out)}円</p>
          </div>
          <div>
            <p className="text-[10px] text-[#AEAEB2]">入金合計</p>
            <p className="text-[16px] font-semibold text-[#248A3D] tabular-nums">{yen.format(totals.inn)}円</p>
          </div>
        </div>
      )}

      {totals.count === 0 && (
        <div className="ios-card px-4 py-4">
          <p className="text-[13px] text-[#8E8E93]">未仕訳の明細はありません。</p>
        </div>
      )}

      {totals.count > 0 && (
        <div className="ios-card p-0 overflow-hidden divide-y divide-black/[0.06]">
          {queue.map(item => {
            const isOpen = selectedId === item.pendingId
            const isResolving = resolvingPendingId === item.pendingId
            return (
              <div key={item.pendingId}>
                <button
                  onClick={() => setSelectedId(isOpen ? null : item.pendingId)}
                  className="w-full text-left px-3 py-2.5 active:bg-black/[0.03]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                      <span className={`inline-block text-[#AEAEB2] transition-transform flex-shrink-0 ${isOpen ? 'rotate-90' : ''}`}>›</span>
                      <span className="text-[11px] font-medium px-1.5 py-0.5 rounded-full bg-[#007AFF]/10 text-[#007AFF] flex-shrink-0">
                        {item.institution}
                      </span>
                      {item.holder && <span className="text-[11px] text-[#8E8E93] flex-shrink-0">{item.holder}様</span>}
                      <span className="text-[11px] text-[#AEAEB2] flex-shrink-0">{item.transaction_date}</span>
                    </div>
                    <p className="text-[14px] font-semibold tabular-nums flex-shrink-0 text-[#1C1C1E]">
                      {item.direction === '出金' ? '−' : '+'}{yen.format(Math.abs(item.amount))}円
                    </p>
                  </div>
                  <p className="text-[13px] text-[#1C1C1E] mt-1">{item.description || '（摘要なし）'}</p>
                </button>
                {isOpen && (
                  <ResolvePanel
                    item={item}
                    classificationMap={classificationMap}
                    resolving={isResolving}
                    queueError={isResolving ? queueError : null}
                    onResolve={(classification, memo) => handleResolve(item.pendingId, classification, memo)}
                  />
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
