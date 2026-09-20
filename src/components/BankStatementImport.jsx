import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useBankStatementImport, isFolderPickerSupported } from '../hooks/useBankStatementImport'
import { useEventPeriods } from '../hooks/useEventPeriods'

const yen = new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 0 })

// スキャン結果（自動仕訳＋要確認、重複スキップ除く）の全件一覧。確認専用（ここからの分類変更は不可）。
// 未仕訳の確認・確定は別タブ「未仕訳」（PendingJournalEntries）で行う
// （2026-09-20、本人の指示で明細インポートから外だし。スマホからも仕訳できるようにするため）。
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
    autoSaveError, autoSaving,
    restoreFolder, pickFolder, scan, retryAutoSave,
  } = useBankStatementImport(user?.id, onImported, periods)

  useEffect(() => { restoreFolder() }, [restoreFolder])

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

      {duplicateCount > 0 && !scanning && (
        <p className="px-1 text-[12px] text-[#AEAEB2]">
          過去に登録済みの{duplicateCount}件はスキップしました。
        </p>
      )}
    </div>
  )
}
