import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useEventPeriods } from '../hooks/useEventPeriods'
import { useOverrideTemplates } from '../hooks/useOverrideTemplates'
import { JOURNAL_INSTITUTIONS } from '../hooks/useJournalEntries'
import { ALL_CLASSIFICATIONS } from '../lib/journalRules'

function formatPeriodDate(s) {
  const [y, m, d] = s.split('-').map(Number)
  return `${y}/${m}/${d}`
}

function emptyOverrideRow() {
  return { institution: JOURNAL_INSTITUTIONS[0], classification: '' }
}

// 上書き行（取引先→分類）のテンプレート選択・保存・削除UI。
// 2026-09-13、本人より「娯楽イベントの度に同じ組み合わせを手入力するのが手間」との
// 指摘を受けて新設。テンプレートはあくまで上書き行の初期値候補であり、適用後も
// 通常通り編集・行の追加削除ができる（固定ではない）。
function OverrideTemplatePicker({ templates, loading, rows, onApply, onSave, onDelete }) {
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)
  const validRows = rows.filter(r => r.institution && r.classification.trim())

  async function handleSave() {
    if (!newName.trim() || validRows.length === 0) return
    const overrides = {}
    for (const r of validRows) overrides[r.institution] = r.classification.trim()
    setSaving(true)
    try {
      await onSave({ name: newName.trim(), overrides })
      setNewName('')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-1.5">
      <p className="text-[12px] text-[#8E8E93]">テンプレート（クリックで上書き行に反映）</p>
      <div className="flex flex-wrap gap-1.5">
        {loading ? (
          <span className="text-[12px] text-[#AEAEB2]">読み込み中…</span>
        ) : templates.length === 0 ? (
          <span className="text-[12px] text-[#AEAEB2]">まだテンプレートはありません</span>
        ) : (
          templates.map(t => (
            <span key={t.id} className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-full bg-[#007AFF]/10">
              <button onClick={() => onApply(t)} className="text-[12px] font-medium text-[#007AFF]">
                {t.name}
              </button>
              <button
                onClick={() => onDelete(t.id)}
                aria-label={`テンプレート「${t.name}」を削除`}
                className="text-[#FF3B30] text-[12px] px-0.5"
              >
                ×
              </button>
            </span>
          ))
        )}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          placeholder="現在の上書き行を名前を付けて保存"
          className="flex-1 px-3 py-2 rounded-[10px] bg-white text-[13px] text-[#1C1C1E] placeholder:text-[#AEAEB2] focus:outline-none"
        />
        <button
          onClick={handleSave}
          disabled={saving || !newName.trim() || validRows.length === 0}
          className="px-3 py-2 rounded-[10px] bg-black/[0.06] text-[#1C1C1E] text-[13px] font-medium active:opacity-70 disabled:opacity-40"
        >
          保存
        </button>
      </div>
    </div>
  )
}

// イベント期間（journal_event_periods）の登録・編集・削除・一覧表示。
// 旅行・お出かけに限らず、ピアノの発表会・空手の試合・散髪など日付で分類できる
// 出来事全般を、画面から登録・削除できるようにする（2026-08-29、本人の指示で
// journalRules.js内のハードコードからDBテーブル化）。
// 2026-09-20、本人の指示で「明細インポート」タブから独立タブへ外だしし、
// 登録済みイベントの編集機能を追加。
// 2026-09-20、本人の指示で取引先→分類の上書き行を任意化（0件でも登録可能に）。
// ETCや住友VISAのように取引先だけで内容が分かるものは自動上書きに任せ、摘要だけでは
// 内容が分からない取引が多いことから、上書き先が無い「名前・期間のみ」のイベントも
// 登録できるようにし、未仕訳画面での手動仕訳時に「その日イベントがあった」ことを
// 思い出す手がかりとして使う運用（PendingJournalEntries.jsx参照）。
export default function EventPeriodsPage() {
  const { user } = useAuth()
  const { periods, loading, addPeriod, updatePeriod, deletePeriod } = useEventPeriods(user?.id)
  const { templates, loading: templatesLoading, addTemplate, deleteTemplate } = useOverrideTemplates(user?.id)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [name, setName] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [rows, setRows] = useState([emptyOverrideRow()])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  function resetForm() {
    setEditingId(null)
    setName('')
    setDateFrom('')
    setDateTo('')
    setRows([emptyOverrideRow()])
    setError(null)
  }

  function startEdit(period) {
    setEditingId(period.id)
    setName(period.name)
    setDateFrom(period.dateFrom)
    setDateTo(period.dateTo)
    const entries = Object.entries(period.overrides)
    setRows(entries.length > 0
      ? entries.map(([institution, classification]) => ({ institution, classification }))
      : [emptyOverrideRow()])
    setError(null)
    setShowForm(true)
  }

  function toggleForm() {
    if (showForm) {
      resetForm()
      setShowForm(false)
    } else {
      setShowForm(true)
    }
  }

  function updateRow(i, patch) {
    setRows(prev => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  }

  function applyTemplate(template) {
    const entries = Object.entries(template.overrides)
    setRows(entries.length > 0
      ? entries.map(([institution, classification]) => ({ institution, classification }))
      : [emptyOverrideRow()])
  }

  async function handleSubmit() {
    setError(null)
    const validRows = rows.filter(r => r.institution && r.classification.trim())
    if (!name.trim() || !dateFrom || !dateTo) {
      setError('名前・開始日・終了日を入力してください。')
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
      if (editingId) {
        await updatePeriod(editingId, { name: name.trim(), dateFrom, dateTo, overrides })
      } else {
        await addPeriod({ name: name.trim(), dateFrom, dateTo, overrides })
      }
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
          onClick={toggleForm}
          className="text-[12px] font-medium text-[#007AFF]"
        >
          {showForm ? '閉じる' : '+ 追加'}
        </button>
      </div>
      <p className="text-[12px] text-[#8E8E93] mb-3">
        旅行・お出かけに限らず、ピアノの発表会・空手の試合・散髪など、日付で分かる出来事を登録できます。
        取引先→分類の上書き（下部）は任意です。設定すると期間中の対象取引先の新規インポート分が自動で分類されます（既存データには影響しません）。
        上書きを設定しない場合は、名前・期間だけが記録され、「未仕訳」タブでその日の明細を仕訳する際に思い出す手がかりとして表示されます。
      </p>

      {showForm && (
        <div className="rounded-xl bg-black/[0.03] px-3 py-3 mb-3 space-y-2.5">
          {editingId && (
            <p className="text-[12px] font-medium text-[#007AFF]">イベント期間を編集</p>
          )}
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

          <OverrideTemplatePicker
            templates={templates}
            loading={templatesLoading}
            rows={rows}
            onApply={applyTemplate}
            onSave={addTemplate}
            onDelete={deleteTemplate}
          />

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
            {saving ? (editingId ? '更新中…' : '登録中…') : (editingId ? '更新する' : '登録する')}
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
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => startEdit(p)}
                    className="text-[11px] text-[#007AFF]"
                  >
                    編集
                  </button>
                  <button
                    onClick={() => deletePeriod(p.id)}
                    className="text-[11px] text-[#FF3B30]"
                  >
                    削除
                  </button>
                </div>
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
