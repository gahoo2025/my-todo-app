import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useBankStatementImport, isFolderPickerSupported } from '../hooks/useBankStatementImport'
import { useEventPeriods } from '../hooks/useEventPeriods'
import { JOURNAL_INSTITUTIONS } from '../hooks/useJournalEntries'
import { ALL_CLASSIFICATIONS } from '../lib/journalRules'

const yen = new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 0 })

function formatPeriodDate(s) {
  const [y, m, d] = s.split('-').map(Number)
  return `${y}/${m}/${d}`
}

function emptyOverrideRow() {
  return { institution: JOURNAL_INSTITUTIONS[0], classification: '' }
}

// イベント期間（journal_event_periods）の登録フォーム＋一覧表示。
// 旅行・お出かけに限らず、ピアノの発表会・空手の試合・散髪など日付で分類できる
// 出来事全般を、画面から登録・削除できるようにする（2026-08-29、本人の指示で
// journalRules.js内のハードコードからDBテーブル化）。
function EventPeriodsPanel({ periods, loading, onAdd, onDelete }) {
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [rows, setRows] = useState([emptyOverrideRow()])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  function resetForm() {
    setName('')
    setDateFrom('')
    setDateTo('')
    setRows([emptyOverrideRow()])
    setError(null)
  }

  function updateRow(i, patch) {
    setRows(prev => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  }

  async function handleSubmit() {
    setError(null)
    const validRows = rows.filter(r => r.institution && r.classification.trim())
    if (!name.trim() || !dateFrom || !dateTo || validRows.length === 0) {
      setError('名前・開始日・終了日・上書き先分類（少なくとも1件）を入力してください。')
      return
    }
    if (dateTo < dateFrom) {
      setError('終了日は開始日以降にしてください。')
      return
    }
    const overrides = {}
    for (const r of validRows) overrides[r.institution] = r.classification.trim()

    setSaving(true)
    try {
      await onAdd({ name: name.trim(), dateFrom, dateTo, overrides })
      resetForm()
      setShowForm(false)
    } catch (err) {
      setError(`${err?.name ?? 'Error'}: ${err?.message ?? String(err)}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="ios-card px-4 py-4">
      <div className="flex items-center justify-between mb-1">
        <p className="text-[13px] font-semibold text-[#1C1C1E]">登録済みのイベント期間</p>
        <button
          onClick={() => setShowForm(v => !v)}
          className="text-[12px] font-medium text-[#007AFF]"
        >
          {showForm ? '閉じる' : '+ 追加'}
        </button>
      </div>
      <p className="text-[12px] text-[#8E8E93] mb-3">
        旅行・お出かけに限らず、ピアノの発表会・空手の試合・散髪など、期間中の取引を
        取引先ごとの分類へ自動で上書きしたい出来事を登録できます（新規インポート時のみ適用。既存データには影響しません）。
      </p>

      {showForm && (
        <div className="rounded-xl bg-black/[0.03] px-3 py-3 mb-3 space-y-2.5">
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="名前（例：ピアノの発表会）"
            className="w-full px-3 py-2 rounded-[10px] bg-white text-[13px] text-[#1C1C1E] placeholder:text-[#AEAEB2] focus:outline-none"
          />
          <div className="flex gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="flex-1 px-3 py-2 rounded-[10px] bg-white text-[13px] text-[#1C1C1E] focus:outline-none"
            />
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="flex-1 px-3 py-2 rounded-[10px] bg-white text-[13px] text-[#1C1C1E] focus:outline-none"
            />
          </div>
          <p className="text-[11px] text-[#AEAEB2]">単日の出来事は開始日・終了日を同じ日にしてください。</p>

          <datalist id="classification-options">
            {ALL_CLASSIFICATIONS.map(c => <option key={c} value={c} />)}
          </datalist>
          {rows.map((row, i) => (
            <div key={i} className="flex gap-2 items-center">
              <select
                value={row.institution}
                onChange={e => updateRow(i, { institution: e.target.value })}
                className="px-2 py-2 rounded-[10px] bg-white text-[13px] text-[#1C1C1E] focus:outline-none"
              >
                {JOURNAL_INSTITUTIONS.map(inst => <option key={inst} value={inst}>{inst}</option>)}
              </select>
              <span className="text-[12px] text-[#AEAEB2]">→</span>
              <input
                type="text"
                list="classification-options"
                value={row.classification}
                onChange={e => updateRow(i, { classification: e.target.value })}
                placeholder="上書き後の分類"
                className="flex-1 px-3 py-2 rounded-[10px] bg-white text-[13px] text-[#1C1C1E] placeholder:text-[#AEAEB2] focus:outline-none"
              />
              {rows.length > 1 && (
                <button
                  onClick={() => setRows(prev => prev.filter((_, idx) => idx !== i))}
                  className="text-[#FF3B30] text-[13px] px-1"
                  aria-label="この取引先を削除"
                >
                  ×
                </button>
              )}
            </div>
          ))}
          <button
            onClick={() => setRows(prev => [...prev, emptyOverrideRow()])}
            className="text-[12px] font-medium text-[#007AFF]"
          >
            + 取引先を追加
          </button>

          {error && <p className="text-[12px] text-[#FF3B30]">{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={saving}
            className="w-full py-2 rounded-[10px] bg-[#007AFF] text-white text-[13px] font-medium active:opacity-70 disabled:opacity-40"
          >
            {saving ? '登録中…' : '登録する'}
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-[12px] text-[#AEAEB2]">読み込み中…</p>
      ) : periods.length === 0 ? (
        <p className="text-[12px] text-[#AEAEB2]">登録されているイベント期間はありません。</p>
      ) : (
        <div className="space-y-2.5">
          {periods.map(p => (
            <div key={p.id} className="rounded-xl bg-black/[0.03] px-3 py-2.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[13px] font-medium text-[#1C1C1E]">{p.name}</p>
                  <p className="text-[12px] text-[#8E8E93] mt-0.5">
                    {formatPeriodDate(p.dateFrom)} 〜 {formatPeriodDate(p.dateTo)}
                  </p>
                </div>
                <button
                  onClick={() => onDelete(p.id)}
                  className="text-[11px] text-[#FF3B30] flex-shrink-0"
                >
                  削除
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {Object.entries(p.overrides).map(([institution, classification]) => (
                  <span
                    key={institution}
                    className="text-[11px] font-medium px-1.5 py-0.5 rounded-full bg-[#007AFF]/10 text-[#007AFF]"
                  >
                    {institution} → {classification}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function BankStatementImport({ onImported }) {
  const { user } = useAuth()
  const { periods, loading: periodsLoading, addPeriod, deletePeriod } = useEventPeriods(user?.id)
  const {
    folderName, scanning, importing,
    unmatchedFiles, readyRows, queue, duplicateCount, scanResult, importResult,
    restoreFolder, pickFolder, scan, resolveQueueItem, importReady,
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

  const current = queue[0] ?? null
  const scanning_or_importing = scanning || importing

  return (
    <div className="space-y-3">
      <EventPeriodsPanel periods={periods} loading={periodsLoading} onAdd={addPeriod} onDelete={deletePeriod} />

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
            <p>
              読み込み件数: {scanResult.total}件（自動仕訳 {scanResult.ready}件／要確認 {scanResult.review}件／
              重複スキップ {scanResult.duplicates}件{scanResult.excluded > 0 ? `／非取引行除外 ${scanResult.excluded}件` : ''}）
            </p>
          </div>
        )}
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
