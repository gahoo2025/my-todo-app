import { useEffect } from 'react'
import { useAssetHoldingsImport, isFolderPickerSupported } from '../hooks/useAssetHoldingsImport'

const PERSONS = ['パパ', 'ママ', '長女', '次女', '長男']

const TYPE_LABELS = {
  assetbalanceall: '資産合計＋保有銘柄',
  assetbalanceinvst: '投資信託詳細',
  stockposition: '個別株ポジション',
}

export default function AssetHoldingsImport() {
  const {
    folderName, detectedFiles, scanning, importing, importResult,
    restoreFolder, pickFolder, scanFolder, updateFileAssignment, runImport,
  } = useAssetHoldingsImport()

  useEffect(() => { restoreFolder() }, [restoreFolder])

  if (!isFolderPickerSupported()) {
    return (
      <div className="ios-card px-4 py-4 mb-3">
        <p className="text-[15px] font-semibold text-[#1C1C1E]">資産ファイルの取り込み</p>
        <p className="text-[12px] text-[#8E8E93] mt-1">
          この機能はPCのChromeまたはEdgeでのみ利用できます。
        </p>
      </div>
    )
  }

  const readyCount = detectedFiles.filter(f => f.type && f.person && f.broker).length

  return (
    <div className="ios-card px-4 py-4 mb-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[15px] font-semibold text-[#1C1C1E]">資産ファイルの取り込み</p>
          <p className="text-[12px] text-[#8E8E93] mt-0.5">
            {folderName ? `フォルダ: ${folderName}` : '資産管理アプリの出力フォルダを選択してください'}
          </p>
        </div>
        <button
          onClick={pickFolder}
          className="flex-shrink-0 px-3 py-2 rounded-[10px] bg-black/[0.04] text-[#1C1C1E] text-[13px] font-medium active:opacity-60"
        >
          {folderName ? 'フォルダ変更' : 'フォルダ選択'}
        </button>
      </div>

      {folderName && (
        <button
          onClick={scanFolder}
          disabled={scanning}
          className="mt-3 w-full px-4 py-2.5 rounded-[10px] bg-[#007AFF] text-white text-[14px] font-semibold disabled:opacity-40 active:opacity-70 transition-opacity"
        >
          {scanning ? '読み込み中…' : '取り込む'}
        </button>
      )}

      {detectedFiles.length > 0 && (
        <div className="mt-3 space-y-2">
          <p className="text-[11px] text-[#8E8E93]">
            {detectedFiles.length}件のCSVを検出しました。人物・証券会社を選んでください。
          </p>
          {detectedFiles.map(f => (
            <div key={f.filename} className="p-2.5 rounded-[10px] bg-black/[0.03]">
              <p className="text-[12px] font-medium text-[#1C1C1E] break-all">{f.filename}</p>
              <p className="text-[11px] text-[#8E8E93] mt-0.5">
                {f.type ? TYPE_LABELS[f.type] : '⚠ 形式を判別できませんでした'}
              </p>
              {f.type && (
                <div className="flex gap-2 mt-1.5">
                  <select
                    value={f.person}
                    onChange={e => updateFileAssignment(f.filename, 'person', e.target.value)}
                    className="flex-1 text-[13px] px-2 py-1.5 rounded-[8px] bg-white border border-black/[0.08]"
                  >
                    <option value="">人物を選択</option>
                    {PERSONS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <input
                    value={f.broker}
                    onChange={e => updateFileAssignment(f.filename, 'broker', e.target.value)}
                    placeholder="証券会社（例: 楽天）"
                    className="flex-1 text-[13px] px-2 py-1.5 rounded-[8px] bg-white border border-black/[0.08]"
                  />
                </div>
              )}
            </div>
          ))}
          <button
            onClick={runImport}
            disabled={importing || readyCount === 0}
            className="w-full px-4 py-2.5 rounded-[10px] bg-[#34C759] text-white text-[14px] font-semibold disabled:opacity-40 active:opacity-70 transition-opacity"
          >
            {importing ? '取り込み中…' : `${readyCount}件を取り込む`}
          </button>
        </div>
      )}

      {importResult?.error && (
        <p className="mt-3 text-[12px] text-[#FF3B30]">⚠ {importResult.error}</p>
      )}
      {importResult?.success && (
        <p className="mt-3 text-[12px] text-[#34C759]">
          ✓ 銘柄データ{importResult.holdings}件・資産合計{importResult.totals}件を取り込みました
        </p>
      )}
    </div>
  )
}
