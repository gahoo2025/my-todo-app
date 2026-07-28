import { useEffect } from 'react'
import { useAssetHoldingsImport, isFolderPickerSupported } from '../hooks/useAssetHoldingsImport'

const TYPE_LABELS = {
  assetbalanceall: '資産合計＋保有銘柄',
  assetbalanceinvst: '投資信託詳細',
  balancesummary: '大和残高',
  stockposition: '個別株ポジション',
}

const REQUIRED_LABELS = 'assetbalanceall×2・assetbalanceINVST×3・balancesummary×1・stockposition×1（計7）'

function formatDate(yyyymmdd) {
  return `${yyyymmdd.slice(0, 4)}/${yyyymmdd.slice(4, 6)}/${yyyymmdd.slice(6, 8)}`
}

export default function AssetHoldingsImport() {
  const {
    folderName, groups, unmatchedFiles, scannedFiles, scanning, importing, importResult,
    restoreFolder, pickFolder, scanFolder, runImport,
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

  const readyCount = groups.filter(g => g.ok).length

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
          {scanning ? '読み込み中…' : 'フォルダを確認'}
        </button>
      )}

      {scannedFiles.length > 0 && (
        <details className="mt-3">
          <summary className="text-[11px] text-[#007AFF]">検出したファイル一覧（{scannedFiles.length}件）</summary>
          <div className="mt-1.5 space-y-0.5">
            {scannedFiles.map(f => (
              <p key={f.filename} className="text-[10px] text-[#8E8E93] break-all">
                {f.filename} — {f.type ?? '判別不可'}
                {f.stamp && `（日付:${f.stamp.date} 時刻:${f.stamp.time || 'なし'}）`}
              </p>
            ))}
          </div>
        </details>
      )}

      {groups.length > 0 && (
        <div className="mt-3 space-y-2">
          <p className="text-[11px] text-[#AEAEB2]">1日付につき {REQUIRED_LABELS} が揃っている必要があります</p>
          {groups.map(g => (
            <div key={g.date} className={`p-2.5 rounded-[10px] ${g.ok ? 'bg-black/[0.03]' : 'bg-[#FF3B30]/[0.06]'}`}>
              <div className="flex items-center justify-between">
                <p className="text-[13px] font-semibold text-[#1C1C1E]">{formatDate(g.date)}</p>
                <p className={`text-[11px] font-medium ${g.ok ? 'text-[#34C759]' : 'text-[#FF3B30]'}`}>
                  {g.ok ? '取り込み対象' : 'スキップ（ファイル不足）'}
                </p>
              </div>
              {!g.ok && (
                <p className="text-[11px] text-[#8E8E93] mt-1">
                  assetbalanceall:{g.counts.assetbalanceall}/2　assetbalanceINVST:{g.counts.assetbalanceinvst}/3　balancesummary:{g.counts.balancesummary}/1　stockposition:{g.counts.stockposition}/1
                </p>
              )}
              {g.ok && (
                <div className="mt-1.5 space-y-0.5">
                  {g.files.map(f => (
                    <p key={f.filename} className="text-[11px] text-[#8E8E93]">
                      {f.person}（{f.broker}）— {TYPE_LABELS[f.type]}
                    </p>
                  ))}
                </div>
              )}
            </div>
          ))}
          {unmatchedFiles.length > 0 && (
            <p className="text-[11px] text-[#AEAEB2]">
              判別できないファイル {unmatchedFiles.length}件は無視されます
            </p>
          )}
          <button
            onClick={runImport}
            disabled={importing || readyCount === 0}
            className="w-full px-4 py-2.5 rounded-[10px] bg-[#34C759] text-white text-[14px] font-semibold disabled:opacity-40 active:opacity-70 transition-opacity"
          >
            {importing ? '取り込み中…' : `${readyCount}日分を取り込む`}
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
