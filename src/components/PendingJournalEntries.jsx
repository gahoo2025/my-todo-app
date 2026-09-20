import { useEffect, useState } from 'react'
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
function candidatesForStage(current, stage) {
  const stage0 = current.candidates
  const stage1All = classificationsForInstitution(current.institution)
  const stage1 = stage1All.filter(c => !stage0.includes(c))
  const stage2 = ALL_CLASSIFICATIONS.filter(c => !stage0.includes(c) && !stage1All.includes(c))
  if (stage === 0) return { shown: stage0, hasMore: stage1.length > 0 }
  if (stage === 1) return { shown: [...stage0, ...stage1], hasMore: stage2.length > 0 }
  return { shown: [...stage0, ...stage1, ...stage2], hasMore: false }
}

// 「明細インポート」から独立した未仕訳（確認要）タブ。フォルダ選択API（PC専用）には依存しないため、
// スマホからも仕訳の確認・確定ができる（2026-09-20、本人の指示：「明細インポートの未仕訳も外だし
// すべき」「スマホから仕訳ができない」。未仕訳キュー（journal_pending_entries）はDB保存されており、
// 明細インポート画面のフォルダスキャンとは独立して読み書きできるため、フォルダ選択の可否に
// 関わらずこのタブ単体で完結する）。
export default function PendingJournalEntries({ onImported }) {
  const { user } = useAuth()
  const { queue, queueError, resolvingItem, resolveQueueItem } = useBankStatementImport(user?.id, onImported)
  const { map: classificationMap } = useJournalClassificationMap(user?.id)
  const [memoInput, setMemoInput] = useState('')
  const [otherStage, setOtherStage] = useState(0)

  const current = queue[0] ?? null
  // 確認要キューが次の明細に進むたびに、メモ入力欄と「その他」の展開段階をリセットする
  const currentKey = current ? `${current.transaction_date}|${current.description}|${current.direction}|${current.amount}` : null
  useEffect(() => {
    setMemoInput('')
    setOtherStage(0)
  }, [currentKey])

  async function handleResolve(classification) {
    await resolveQueueItem(classification, memoInput)
  }

  return (
    <div className="space-y-3">
      <div className="ios-card px-4 py-4">
        <p className="text-[13px] font-semibold text-[#1C1C1E] mb-1">未仕訳（確認要）</p>
        <p className="text-[12px] text-[#8E8E93]">
          明細インポートで自動分類できなかった取引です。スマホからも確認・確定できます。
        </p>
      </div>

      {!current && (
        <div className="ios-card px-4 py-4">
          <p className="text-[13px] text-[#8E8E93]">未仕訳の明細はありません。</p>
        </div>
      )}

      {current && (
        <div className="ios-card px-4 py-4">
          <p className="text-[13px] font-semibold text-[#1C1C1E] mb-1">
            確認要（残り{queue.length}件）
          </p>
          <div className="rounded-xl bg-black/[0.03] px-3 py-2.5 mb-3">
            <p className="text-[12px] text-[#8E8E93]">
              {current.institution}{current.holder ? `（${current.holder}）` : ''}・{current.transaction_date}
            </p>
            <p className="text-[15px] text-[#1C1C1E] mt-0.5">{current.description || '（摘要なし）'}</p>
            <p className="text-[15px] font-semibold text-[#1C1C1E] mt-0.5">
              {current.direction} {yen.format(Math.abs(current.amount))}円{current.amount < 0 && '（返品）'}
            </p>
          </div>
          <input
            type="text"
            value={memoInput}
            onChange={e => setMemoInput(e.target.value)}
            placeholder="メモ（任意）"
            disabled={resolvingItem}
            className="w-full px-3 py-2 rounded-[10px] bg-black/[0.03] text-[13px] text-[#1C1C1E] placeholder:text-[#AEAEB2] focus:outline-none mb-2 disabled:opacity-60"
          />
          {(() => {
            const { shown, hasMore } = candidatesForStage(current, otherStage)
            return (
              <div className="flex flex-wrap gap-2">
                {shown.map(c => (
                  <CandidateButton
                    key={c}
                    classification={c}
                    institution={current.institution}
                    classificationMap={classificationMap}
                    disabled={resolvingItem}
                    onClick={() => handleResolve(c)}
                  />
                ))}
                {hasMore && (
                  <button
                    onClick={() => setOtherStage(s => s + 1)}
                    disabled={resolvingItem}
                    className="px-3 py-1.5 rounded-full bg-black/[0.06] text-[#8E8E93] text-[13px] font-medium active:opacity-60 disabled:opacity-40"
                  >
                    その他
                  </button>
                )}
                <button
                  onClick={() => handleResolve(null)}
                  disabled={resolvingItem}
                  className="px-3 py-1.5 rounded-full bg-black/[0.06] text-[#8E8E93] text-[13px] font-medium active:opacity-60 disabled:opacity-40"
                >
                  未分類のまま保存
                </button>
              </div>
            )
          })()}
          {queueError && (
            <p className="mt-2 text-[13px] text-[#FF3B30]">保存に失敗しました：{queueError}（もう一度お試しください）</p>
          )}
        </div>
      )}
    </div>
  )
}
