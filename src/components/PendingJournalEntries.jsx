import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useBankStatementImport } from '../hooks/useBankStatementImport'
import { useJournalClassificationMap } from '../hooks/useJournalClassificationMap'
import { useEventPeriods } from '../hooks/useEventPeriods'
import { useCustomRules } from '../hooks/useCustomRules'
import { ALL_CLASSIFICATIONS, classificationsForInstitution, classifyDescription } from '../lib/journalRules'

const yen = new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 0 })

// 指定日付を含む登録済みイベント期間を全て返す（複数該当も許容）。
// 2026-09-20、本人の指示：ETC・住友VISAのように取引先だけで内容がわかるものは自動上書きに
// 任せる一方、摘要だけでは内容が分からない取引の方が多いため、手動仕訳時に「その日イベントが
// あった」ことを思い出す手がかりとして表示する。上書き先（overrides）の有無は問わない。
function eventsOnDate(eventPeriods, date) {
  return (eventPeriods || []).filter(p => date >= p.dateFrom && date <= p.dateTo)
}

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
//
// journal_classification_mapへ本人が新規登録した仕訳１のうち、その取引先向けのもの
// （extraClassifications.forInstitution）は常にstage0（初期表示）へ含める（2026-09-26、
// 本人報告「登録できたが未仕訳の分類で出てこない」への対応）。
// 経緯：確認要キューのcandidatesはスキャン時点のスナップショットで、自動仕訳が
// 一致しなかった明細は候補が0件のためALL_CLASSIFICATIONS全件（当時88件）がそのまま
// stage0として保存されている。一度目の修正でstage1（「その他」ボタン後）に追加した
// ところ、①「その他」を押さないと出ない、②押しても88件超に埋もれて見つからない、
// という状態だったため、取引先向けの新規登録分はstage0に直接混ぜる形に変更した。
// 全取引先共通分（extraClassifications.all）は従来どおりstage2（さらに「その他」）に留める。
function candidatesForStage(item, stage, extraClassifications) {
  const stage0Extra = (extraClassifications.forInstitution || []).filter(c => !item.candidates.includes(c))
  const stage0 = [...item.candidates, ...stage0Extra]
  const stage1All = classificationsForInstitution(item.institution).filter(c => !stage0.includes(c))
  const stage1 = stage1All
  const stage2All = [...new Set([...ALL_CLASSIFICATIONS, ...extraClassifications.all])]
  const stage2 = stage2All.filter(c => !stage0.includes(c) && !stage1All.includes(c))
  if (stage === 0) return { shown: stage0, hasMore: stage1.length > 0 }
  if (stage === 1) return { shown: [...stage0, ...stage1], hasMore: stage2.length > 0 }
  return { shown: [...stage0, ...stage1, ...stage2], hasMore: false }
}

// 選択中の1件を確定するための、メモ入力＋分類候補ボタンのパネル（行タップで展開する部分）。
// canLearnRule（既存535件ルールに一切マッチしない摘要のときのみtrue）の場合、「次回から
// 自動仕訳する」チェックボックスを表示する（2026-09-20、本人の指示：「未仕訳を仕訳する際、
// 今後は自動仕訳に登録できる仕組みが欲しい」）。PayPay等、あえて毎回確認が必要な設計の
// 摘要（review状態）ではチェックしても効果が無く紛らわしいため、その場合は表示しない。
function ResolvePanel({ item, classificationMap, extraClassifications, resolving, queueError, canLearnRule, onResolve }) {
  const [memoInput, setMemoInput] = useState('')
  const [otherStage, setOtherStage] = useState(0)
  const [saveAsRule, setSaveAsRule] = useState(false)

  const { shown, hasMore } = candidatesForStage(item, otherStage, extraClassifications)

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
      {canLearnRule && (
        <label className="flex items-center gap-1.5 mb-2 text-[12px] text-[#8E8E93]">
          <input
            type="checkbox"
            checked={saveAsRule}
            onChange={e => setSaveAsRule(e.target.checked)}
            disabled={resolving}
          />
          次回から自動仕訳する（同じ摘要が来たら自動でこの分類にする）
        </label>
      )}
      <div className="flex flex-wrap gap-2">
        {shown.map(c => (
          <CandidateButton
            key={c}
            classification={c}
            institution={item.institution}
            classificationMap={classificationMap}
            disabled={resolving}
            onClick={() => onResolve(c, memoInput, saveAsRule)}
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
          onClick={() => onResolve(null, memoInput, false)}
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

// 仕訳分類定義（仕訳１→仕訳２・仕訳３の組み合わせ）を新規登録するフォーム
// （2026-09-23、本人の指示：「未仕訳を仕訳するときに新しい明細を登録できるようにしてほしい」の
// 真意が「実際の取引ではなく、候補に無い仕訳の組み合わせをその場で定義したい」だったと判明し
// 作り直した。実際の取引ではないため日付・金額は扱わない）。
// 仕訳１は既存分類の候補（datalist）を出しつつ自由入力も可能、仕訳２・仕訳３は
// journal_classification_mapに既に存在する値のみから選択（新規作成不可、必須）とする。
// 仕訳１が対応表にマッチする場合は仕訳２・仕訳３をデフォルト補完する。
function AddClassificationDefinitionForm({ classificationMap, classification2Options, classification3Options, institutionGroupOptions, saving, onSubmit, onCancel }) {
  const [institutionOrGroup, setInstitutionOrGroup] = useState('')
  const [classification1, setClassification1] = useState('')
  const [classification2, setClassification2] = useState('')
  const [classification3, setClassification3] = useState('')
  const [cashflowDirection, setCashflowDirection] = useState('出金')
  const [note, setNote] = useState('')
  const [error, setError] = useState(null)

  // 仕訳１が対応表にマッチしたら仕訳２・３をデフォルト補完する（本人が後から変更可能）
  function handleClassification1Change(value) {
    setClassification1(value)
    const detail = classificationMap.get(`${institutionOrGroup}|${value}`)
    if (detail) {
      setClassification2(detail.classification_2 || '')
      setClassification3(detail.classification_3 || '')
    }
  }

  async function handleSubmit() {
    setError(null)
    if (!institutionOrGroup.trim() || !classification1.trim() || !classification2 || !classification3) {
      setError('取引先・グループ、仕訳１～３はすべて必須です')
      return
    }
    const result = await onSubmit({
      institutionOrGroup: institutionOrGroup.trim(),
      classification1: classification1.trim(),
      classification2,
      classification3,
      cashflowDirection,
      note,
    })
    if (result?.error) {
      setError(result.error)
    }
  }

  return (
    <div className="ios-card px-4 py-4 space-y-2.5">
      <p className="text-[13px] font-semibold text-[#1C1C1E]">新しい仕訳分類を追加</p>
      <p className="text-[12px] text-[#8E8E93]">
        候補に無い「仕訳１→仕訳２・仕訳３」の組み合わせをここで定義できます（実際の取引の登録ではありません）。
      </p>

      <input
        type="text"
        list="classification-definition-institution-options"
        value={institutionOrGroup}
        onChange={e => setInstitutionOrGroup(e.target.value)}
        placeholder="取引先・グループ（既存から選択、または新規入力）"
        disabled={saving}
        className="w-full px-3 py-2 rounded-[10px] bg-black/[0.04] text-[13px] text-[#1C1C1E] placeholder:text-[#AEAEB2] disabled:opacity-60"
      />
      <datalist id="classification-definition-institution-options">
        {institutionGroupOptions.map(g => <option key={g} value={g} />)}
      </datalist>

      <input
        type="text"
        list="classification-definition-classification1-options"
        value={classification1}
        onChange={e => handleClassification1Change(e.target.value)}
        placeholder="仕訳１（既存から選択、または新規入力）"
        disabled={saving}
        className="w-full px-3 py-2 rounded-[10px] bg-black/[0.04] text-[13px] text-[#1C1C1E] placeholder:text-[#AEAEB2] disabled:opacity-60"
      />
      <datalist id="classification-definition-classification1-options">
        {ALL_CLASSIFICATIONS.map(c => <option key={c} value={c} />)}
      </datalist>

      <div className="grid grid-cols-2 gap-2">
        <select
          value={classification2}
          onChange={e => setClassification2(e.target.value)}
          disabled={saving}
          className="px-3 py-2 rounded-[10px] bg-black/[0.04] text-[13px] text-[#1C1C1E] disabled:opacity-60"
        >
          <option value="">仕訳２（必須）</option>
          {classification2Options.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          value={classification3}
          onChange={e => setClassification3(e.target.value)}
          disabled={saving}
          className="px-3 py-2 rounded-[10px] bg-black/[0.04] text-[13px] text-[#1C1C1E] disabled:opacity-60"
        >
          <option value="">仕訳３（必須）</option>
          {classification3Options.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <select
        value={cashflowDirection}
        onChange={e => setCashflowDirection(e.target.value)}
        disabled={saving}
        className="w-full px-3 py-2 rounded-[10px] bg-black/[0.04] text-[13px] text-[#1C1C1E] disabled:opacity-60"
      >
        <option value="出金">出金</option>
        <option value="入金">入金</option>
      </select>

      <input
        type="text"
        value={note}
        onChange={e => setNote(e.target.value)}
        placeholder="備考（任意）"
        disabled={saving}
        className="w-full px-3 py-2 rounded-[10px] bg-black/[0.04] text-[13px] text-[#1C1C1E] placeholder:text-[#AEAEB2] disabled:opacity-60"
      />

      {error && <p className="text-[13px] text-[#FF3B30]">{error}</p>}

      <div className="flex gap-2 pt-1">
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="px-4 py-2 rounded-[10px] bg-[#007AFF] text-white text-[13px] font-medium active:opacity-60 disabled:opacity-40"
        >
          {saving ? '登録中…' : '登録する'}
        </button>
        <button
          onClick={onCancel}
          disabled={saving}
          className="px-4 py-2 rounded-[10px] bg-black/[0.06] text-[#8E8E93] text-[13px] font-medium active:opacity-60 disabled:opacity-40"
        >
          キャンセル
        </button>
      </div>
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
  const {
    map: classificationMap, classification2Options, classification3Options, institutionGroupOptions,
    classification1ByInstitution, allClassification1,
    addDefinition,
  } = useJournalClassificationMap(user?.id)
  const { periods: eventPeriods } = useEventPeriods(user?.id)
  const { addRule: addCustomRule } = useCustomRules(user?.id)
  const [selectedId, setSelectedId] = useState(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [addFormSaving, setAddFormSaving] = useState(false)

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

  async function handleResolve(item, classification, memo, saveAsRule) {
    if (saveAsRule && classification) {
      await addCustomRule({
        institution: item.institution,
        holder: item.holder,
        pattern: item.description,
        classification,
      })
    }
    await resolveQueueItem(item.pendingId, classification, memo)
  }

  // 候補に無い仕訳分類定義（仕訳１→仕訳２・仕訳３）を新規登録する。同じ
  // （取引先・グループ、仕訳１）の組み合わせが既にあれば上書き更新される（addDefinition側でupsert）。
  async function handleAddDefinition(definition) {
    setAddFormSaving(true)
    try {
      await addDefinition(definition)
      setShowAddForm(false)
      return { success: true }
    } catch (err) {
      return { error: `${err?.name ?? 'Error'}: ${err?.message ?? String(err)}` }
    } finally {
      setAddFormSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="ios-card px-4 py-4">
        <p className="text-[13px] font-semibold text-[#1C1C1E] mb-1">未仕訳（確認要）</p>
        <p className="text-[12px] text-[#8E8E93]">
          明細インポートで自動分類できなかった取引です。タップした明細から仕訳を確定できます。
        </p>
      </div>

      {!showAddForm && (
        <button
          onClick={() => setShowAddForm(true)}
          className="w-full ios-card px-4 py-3 text-[13px] font-medium text-[#007AFF] active:opacity-60"
        >
          ＋ 新しい仕訳分類を追加
        </button>
      )}
      {showAddForm && (
        <AddClassificationDefinitionForm
          classificationMap={classificationMap}
          classification2Options={classification2Options}
          classification3Options={classification3Options}
          institutionGroupOptions={institutionGroupOptions}
          saving={addFormSaving}
          onSubmit={handleAddDefinition}
          onCancel={() => setShowAddForm(false)}
        />
      )}

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
            const matchedEvents = eventsOnDate(eventPeriods, item.transaction_date)
            const canLearnRule = classifyDescription(item.institution, item.description, { holder: item.holder }).status === 'unmatched'
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
                  {matchedEvents.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {matchedEvents.map(ev => (
                        <span
                          key={ev.id}
                          className="text-[11px] font-medium px-1.5 py-0.5 rounded-full bg-[#FF9500]/10 text-[#FF9500]"
                        >
                          📅 {ev.name}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
                {isOpen && (
                  <ResolvePanel
                    item={item}
                    classificationMap={classificationMap}
                    extraClassifications={{
                      forInstitution: classification1ByInstitution.get(item.institution) || [],
                      all: allClassification1,
                    }}
                    resolving={isResolving}
                    queueError={isResolving ? queueError : null}
                    canLearnRule={canLearnRule}
                    onResolve={(classification, memo, saveAsRule) => handleResolve(item, classification, memo, saveAsRule)}
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
