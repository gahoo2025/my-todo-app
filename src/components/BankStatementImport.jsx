import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useBankStatementImport, isFolderPickerSupported } from '../hooks/useBankStatementImport'
import { useEventPeriods } from '../hooks/useEventPeriods'
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

// スキャン結果（自動仕訳＋要確認、重複スキップ除く）の全件一覧。確認専用（ここからの分類変更は不可）。
function ScanDetailList({ readyRows, queue }) {
  const [show, setShow] = useState(false)
  const queueSet = new Set(queue)
  const allRows = [...readyRows, ...queue].sort((a, b) => a.transaction_date.localeCompare(b.transaction_date))

  if (allRows.length === 0) return null

  return (
    <div className="mt-3">
      <button
        onClick={() => setShow(v => !v)}
        className="text-[12px] font-medium text-[#007AFF]"
      >
        {show ? '明細一覧を閉じる' : `明細一覧を表示（${allRows.length}件）`}
      </button>
      {show && (
        <div className="mt-2 max-h-96 overflow-y-auto rounded-xl bg-black/[0.03] divide-y divide-black/[0.06]">
          {allRows.map((row, i) => {
            const needsReview = queueSet.has(row)
            return (
              <div key={i} className="px-3 py-2">
                <div className="flex items-center justify-between gap-2 text-[11px] text-[#8E8E93]">
                  <span>{row.institution}{row.holder ? `（${row.holder}）` : ''}・{row.transaction_date}</span>
                  <span className="tabular-nums flex-shrink-0">
                    {row.direction} {yen.format(Math.abs(row.amount))}円{row.amount < 0 && '（返品）'}
                  </span>
                </div>
                <p className="text-[13px] text-[#1C1C1E] mt-0.5">{row.description || '（摘要なし）'}</p>
                <p className="text-[11px] mt-0.5">
                  {needsReview ? (
                    <span className="text-[#FF9500]">要確認</span>
                  ) : (
                    <span className="text-[#248A3D]">{row.classification || '未分類'}</span>
                  )}
                </p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function BankStatementImport({ onImported }) {
  const { user } = useAuth()
  const { periods } = useEventPeriods(user?.id)
  const {
    folderName, scanning,
    unmatchedFiles, readyRows, queue, duplicateCount, scanResult,
    autoSaveError, autoSaving, queueError, resolvingItem,
    restoreFolder, pickFolder, scan, resolveQueueItem, retryAutoSave,
  } = useBankStatementImport(user?.id, onImported, periods)
  const { map: classificationMap } = useJournalClassificationMap(user?.id)
  const [memoInput, setMemoInput] = useState('')
  const [otherStage, setOtherStage] = useState(0)

  useEffect(() => { restoreFolder() }, [restoreFolder])

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

  if (!isFolderPickerSupported()) {
    return (
      <div className="ios-card px-4 py-4 mb-3">
        <p className="text-[13px] text-[#8E8E93]">
          この機能はPCのChromeまたはEdgeでのみ利用できます（フォルダ選択APIが必要です）。
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="ios-card px-4 py-4">
        <p className="text-[13px] font-semibold text-[#1C1C1E] mb-2">明細インポート</p>
        <p className="text-[12px] text-[#8E8E93] mb-3">
          横浜銀行・住友銀行・ゆうちょ・みずほ銀行・住友VISA・横浜VISA・楽天カードえみのCSV明細が
          入ったフォルダを選択してください。複数ファイルをまとめて取り込めます。取引先はファイルの
          内容から自動判別します。
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={pickFolder}
            className="px-3.5 py-2 rounded-full bg-[#007AFF] text-white text-[13px] font-medium active:opacity-70"
          >
            {folderName ? 'フォルダを変更' : 'フォルダを選択'}
          </button>
          {folderName && (
            <button
              onClick={scan}
              disabled={scanning}
              className="px-3.5 py-2 rounded-full bg-black/[0.06] text-[#1C1C1E] text-[13px] font-medium active:opacity-70 disabled:opacity-40"
            >
              {scanning ? '読み込み中…' : 'フォルダを確認する'}
            </button>
          )}
        </div>
        {folderName && <p className="mt-2 text-[12px] text-[#AEAEB2]">選択中: {folderName}</p>}

        {unmatchedFiles.length > 0 && (
          <div className="mt-3 text-[12px] text-[#FF9500]">
            取引先を判別できなかったファイル: {unmatchedFiles.join(', ')}
          </div>
        )}

        {scanResult && (
          <div className="mt-3 text-[12px] text-[#1C1C1E] space-y-0.5">
            <p>取引先: {scanResult.institutions.join('・') || 'なし'}</p>
            <p>
              読み込み件数: {scanResult.total}件（自動仕訳 {scanResult.ready}件／要確認 {scanResult.review}件／
              重複スキップ {scanResult.duplicates}件{scanResult.excluded > 0 ? `／非取引行除外 ${scanResult.excluded}件` : ''}）
            </p>
          </div>
        )}

        {autoSaving && (
          <p className="mt-2 text-[13px] text-[#8E8E93]">自動仕訳分を保存中…</p>
        )}
        {autoSaveError && (
          <div className="mt-2 text-[13px] text-[#FF3B30]">
            <p>自動仕訳分の保存に失敗しました：{autoSaveError}</p>
            <button
              onClick={retryAutoSave}
              className="mt-1.5 px-3 py-1.5 rounded-full bg-black/[0.06] text-[#1C1C1E] text-[13px] font-medium active:opacity-70"
            >
              再試行
            </button>
          </div>
        )}
        {!autoSaving && !autoSaveError && scanResult && scanResult.ready > 0 && (
          <p className="mt-2 text-[13px] text-[#248A3D]">自動仕訳{scanResult.ready}件を保存しました。</p>
        )}

        <ScanDetailList readyRows={readyRows} queue={queue} />
      </div>

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
      {duplicateCount > 0 && !scanning && (
        <p className="px-1 text-[12px] text-[#AEAEB2]">
          過去に登録済みの{duplicateCount}件はスキップしました。
        </p>
      )}
    </div>
  )
}
