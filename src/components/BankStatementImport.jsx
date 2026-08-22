import { useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useBankStatementImport, isFolderPickerSupported } from '../hooks/useBankStatementImport'

const yen = new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 0 })

export default function BankStatementImport({ onImported }) {
  const { user } = useAuth()
  const {
    folderName, scanning, importing,
    unmatchedFiles, readyRows, queue, duplicateCount, scanResult, importResult,
    restoreFolder, pickFolder, scan, resolveQueueItem, importReady,
  } = useBankStatementImport(user?.id, onImported)

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

  const current = queue[0] ?? null
  const scanning_or_importing = scanning || importing

  return (
    <div className="space-y-3">
      <div className="ios-card px-4 py-4">
        <p className="text-[13px] font-semibold text-[#1C1C1E] mb-2">明細インポート（銀行系）</p>
        <p className="text-[12px] text-[#8E8E93] mb-3">
          横浜銀行・住友銀行・ゆうちょ・みずほ銀行のCSV明細が入ったフォルダを選択してください。
          複数ファイルをまとめて取り込めます。取引先はファイルの内容から自動判別します。
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
              disabled={scanning_or_importing}
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
            <p>読み込み件数: {scanResult.total}件（自動仕訳 {scanResult.ready}件／要確認 {scanResult.review}件／重複スキップ {scanResult.duplicates}件）</p>
          </div>
        )}
      </div>

      {current && (
        <div className="ios-card px-4 py-4">
          <p className="text-[13px] font-semibold text-[#1C1C1E] mb-1">
            確認要（残り{queue.length}件）
          </p>
          <div className="rounded-xl bg-black/[0.03] px-3 py-2.5 mb-3">
            <p className="text-[12px] text-[#8E8E93]">{current.institution}・{current.transaction_date}</p>
            <p className="text-[15px] text-[#1C1C1E] mt-0.5">{current.description || '（摘要なし）'}</p>
            <p className="text-[15px] font-semibold text-[#1C1C1E] mt-0.5">
              {current.direction} {yen.format(current.amount)}円
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {current.candidates.map(c => (
              <button
                key={c}
                onClick={() => resolveQueueItem(c)}
                className="px-3 py-1.5 rounded-full bg-[#007AFF]/10 text-[#007AFF] text-[13px] font-medium active:opacity-60"
              >
                {c}
              </button>
            ))}
            <button
              onClick={() => resolveQueueItem(null)}
              className="px-3 py-1.5 rounded-full bg-black/[0.06] text-[#8E8E93] text-[13px] font-medium active:opacity-60"
            >
              未分類のまま保存
            </button>
          </div>
        </div>
      )}

      {!current && readyRows.length > 0 && (
        <div className="ios-card px-4 py-4">
          <p className="text-[13px] text-[#1C1C1E] mb-3">
            {readyRows.length}件が取り込み可能です（自動仕訳・確認済み合計）。
          </p>
          <button
            onClick={importReady}
            disabled={importing}
            className="px-3.5 py-2 rounded-full bg-[#248A3D] text-white text-[13px] font-medium active:opacity-70 disabled:opacity-40"
          >
            {importing ? '取り込み中…' : `${readyRows.length}件をインポート`}
          </button>
        </div>
      )}

      {importResult?.error && (
        <div className="ios-card px-4 py-3 text-[13px] text-[#FF3B30]">{importResult.error}</div>
      )}
      {importResult?.success && (
        <div className="ios-card px-4 py-3 text-[13px] text-[#248A3D]">{importResult.inserted}件をインポートしました。</div>
      )}
      {duplicateCount > 0 && !scanning && (
        <p className="px-1 text-[12px] text-[#AEAEB2]">
          過去に登録済みの{duplicateCount}件はスキップしました。
        </p>
      )}
    </div>
  )
}
