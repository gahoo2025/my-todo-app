import { useState, useRef } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useSparks } from '../hooks/useSparks'

const KIND_CONFIG = {
  insight:  { label: '気づき', emoji: '💡', color: 'text-[#FF9500]', bg: 'bg-[#FF9500]/10' },
  question: { label: '疑問',   emoji: '❓', color: 'text-[#AF52DE]', bg: 'bg-[#AF52DE]/10' },
}

function AutoTextarea({ value, onChange, placeholder, taRef, className }) {
  return (
    <textarea
      ref={taRef}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      rows={1}
      onInput={e => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px' }}
      className={`w-full bg-transparent focus:outline-none resize-none leading-relaxed max-h-40 overflow-y-auto ${className}`}
    />
  )
}

function QuickAdd({ onAdd }) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [kind, setKind] = useState('insight')
  const [saving, setSaving] = useState(false)
  const titleRef = useRef(null)
  const contentRef = useRef(null)

  async function handleAdd(e) {
    e.preventDefault()
    if (!title.trim() && !content.trim()) return
    setSaving(true)
    await onAdd({ title: title.trim() || null, content: content.trim() || null, kind, resolved: false })
    setTitle('')
    setContent('')
    setSaving(false)
    if (titleRef.current) titleRef.current.style.height = 'auto'
    if (contentRef.current) contentRef.current.style.height = 'auto'
  }

  return (
    <form onSubmit={handleAdd} className="ios-card overflow-hidden">
      <div className="flex items-center gap-1 px-3 pt-2.5">
        {Object.entries(KIND_CONFIG).map(([key, cfg]) => (
          <button
            key={key}
            type="button"
            onClick={() => setKind(key)}
            className={`text-[12px] font-medium px-2.5 py-1 rounded-full transition-colors ${
              kind === key ? `${cfg.color} ${cfg.bg}` : 'text-[#AEAEB2]'
            }`}
          >
            {cfg.emoji} {cfg.label}
          </button>
        ))}
      </div>
      <div className="px-3 pb-2.5 pt-1.5 space-y-1">
        <AutoTextarea
          taRef={titleRef}
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="タイトル"
          className="text-[15px] font-semibold text-[#1C1C1E] placeholder:text-[#AEAEB2] placeholder:font-normal py-1"
        />
        <AutoTextarea
          taRef={contentRef}
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="補足（任意）"
          className="text-[14px] text-[#3C3C43] placeholder:text-[#AEAEB2] py-1"
        />
        <div className="flex justify-end pt-0.5">
          <button
            type="submit"
            disabled={saving || (!title.trim() && !content.trim())}
            className="text-[14px] font-semibold text-[#007AFF] disabled:opacity-30 active:opacity-50 transition-opacity"
          >
            追加
          </button>
        </div>
      </div>
    </form>
  )
}

function SparkRow({ spark, onToggleResolved, onEdit }) {
  const cfg = KIND_CONFIG[spark.kind] ?? KIND_CONFIG.insight
  const timeLabel = new Date(spark.created_at).toLocaleString('ja-JP', {
    month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })

  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <button
        onClick={() => onToggleResolved(spark.id, spark.resolved)}
        className={`flex-shrink-0 mt-0.5 w-[22px] h-[22px] rounded-full border-[1.5px] flex items-center justify-center transition-all duration-200 ${
          spark.resolved
            ? 'bg-[#34C759] border-[#34C759]'
            : 'border-[#C7C7CC] hover:border-[#34C759] active:scale-90'
        }`}
        title={spark.resolved ? '未解決に戻す' : '解決済みにする'}
      >
        {spark.resolved && (
          <svg className="w-[11px] h-[11px] text-white" fill="none" viewBox="0 0 12 12">
            <path d="M2 6.2l2.8 2.8L10 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </button>

      <button onClick={() => onEdit(spark)} className="flex-1 min-w-0 text-left">
        {spark.title && (
          <p className={`text-[15px] font-semibold leading-snug whitespace-pre-wrap break-words ${
            spark.resolved ? 'line-through text-[#AEAEB2]' : 'text-[#1C1C1E]'
          }`}>
            {spark.title}
          </p>
        )}
        {spark.content && (
          <p className={`text-[14px] leading-relaxed whitespace-pre-wrap break-words ${
            spark.title ? 'mt-0.5' : ''
          } ${spark.resolved ? 'line-through text-[#AEAEB2]' : 'text-[#3C3C43]'}`}>
            {spark.content}
          </p>
        )}
        <div className="flex items-center gap-2 mt-1.5">
          <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded-full ${cfg.color} ${cfg.bg}`}>
            {cfg.emoji} {cfg.label}
          </span>
          <span className="text-[11px] text-[#AEAEB2]">{timeLabel}</span>
        </div>
      </button>

      <button
        onClick={() => onEdit(spark)}
        className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full text-[#C7C7CC] hover:text-[#8E8E93] active:opacity-60 transition-colors"
        aria-label="編集"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      </button>
    </div>
  )
}

function SparkModal({ spark, onSave, onDelete, onClose }) {
  const [title, setTitle] = useState(spark.title ?? '')
  const [content, setContent] = useState(spark.content ?? '')
  const [kind, setKind] = useState(spark.kind ?? 'insight')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!title.trim() && !content.trim()) return
    setSaving(true)
    await onSave(spark.id, {
      title: title.trim() || null,
      content: content.trim() || null,
      kind,
    })
    setSaving(false)
    onClose()
  }

  async function handleDelete() {
    if (!window.confirm('このメモを削除しますか？')) return
    await onDelete(spark.id)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-[2px] flex items-end md:items-center md:justify-center z-40" onClick={onClose}>
      <div
        className="w-full bg-[#F2F2F7] rounded-t-[16px] md:rounded-[16px] max-w-lg mx-auto shadow-2xl max-h-[92vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-[#F2F2F7]/90 backdrop-blur-xl px-4 py-3 flex items-center justify-between border-b border-black/5 rounded-t-[16px]">
          <button onClick={onClose} className="ios-toolbar-btn">キャンセル</button>
          <h2 className="text-[16px] font-semibold text-[#1C1C1E]">メモを編集</h2>
          <button
            onClick={handleSave}
            disabled={saving || (!title.trim() && !content.trim())}
            className="ios-toolbar-btn font-semibold disabled:opacity-30"
          >
            {saving ? '保存中…' : '保存'}
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* 種類選択 */}
          <div className="flex items-center gap-1">
            {Object.entries(KIND_CONFIG).map(([key, cfg]) => (
              <button
                key={key}
                type="button"
                onClick={() => setKind(key)}
                className={`text-[13px] font-medium px-3 py-1.5 rounded-full transition-colors ${
                  kind === key ? `${cfg.color} ${cfg.bg}` : 'text-[#AEAEB2] bg-black/[0.03]'
                }`}
              >
                {cfg.emoji} {cfg.label}
              </button>
            ))}
          </div>

          {/* タイトル・補足 */}
          <div className="ios-card overflow-hidden divide-y divide-black/[0.04]">
            <textarea
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="タイトル"
              rows={1}
              onInput={e => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px' }}
              className="w-full px-4 py-3 text-[16px] font-semibold text-[#1C1C1E] placeholder:text-[#AEAEB2] placeholder:font-normal bg-transparent focus:outline-none resize-none leading-relaxed"
            />
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="補足（任意）"
              rows={4}
              className="w-full px-4 py-3 text-[14px] text-[#1C1C1E] placeholder:text-[#AEAEB2] bg-transparent focus:outline-none resize-none leading-relaxed"
            />
          </div>

          <button
            onClick={handleDelete}
            className="w-full py-3 rounded-[12px] text-[#FF3B30] text-[15px] font-medium bg-[#FF3B30]/[0.08] active:opacity-70 transition-opacity"
          >
            メモを削除
          </button>
        </div>
      </div>
    </div>
  )
}

export default function SparksPage({ onBack, embedded }) {
  const { user } = useAuth()
  const { sparks, loading, addSpark, updateSpark, deleteSpark } = useSparks(user?.id)
  const [filterKind, setFilterKind] = useState('すべて')
  const [editing, setEditing] = useState(null)

  const filtered = filterKind === 'すべて' ? sparks : sparks.filter(s => s.kind === filterKind)
  const unresolved = filtered.filter(s => !s.resolved)
  const resolved = filtered.filter(s => s.resolved)

  function toggleResolved(id, resolved) {
    updateSpark(id, { resolved: !resolved })
  }

  return (
    <div className={embedded ? '' : 'min-h-screen'}>
      {!embedded && (
        <header className="safe-top sticky top-0 z-10 bg-[#F2F2F7]/80 backdrop-blur-xl border-b border-black/5">
          <div className="max-w-lg md:max-w-2xl mx-auto px-4">
            <div className="flex items-center h-11">
              <button onClick={onBack} className="flex items-center text-[#007AFF] active:opacity-50 transition-opacity -ml-1">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                <span className="text-[16px]">戻る</span>
              </button>
            </div>
            <div className="pb-3 pt-1">
              <h1 className="text-[28px] font-bold tracking-tight text-[#1C1C1E] leading-tight">ひらめきメモ</h1>
            </div>
          </div>
        </header>
      )}

      <main className={`max-w-lg md:max-w-2xl mx-auto px-4 py-4 space-y-4 ${embedded ? 'pb-28 md:pb-10' : 'pb-10'}`}>
        <QuickAdd onAdd={addSpark} />

        {/* 種類フィルター */}
        <div className="sticky top-[44px] z-[5] -mx-4 px-4 pt-2 pb-2.5 bg-[#F2F2F7]/85 backdrop-blur-xl flex gap-2 overflow-x-auto">
          {['すべて', 'insight', 'question'].map(k => (
            <button
              key={k}
              onClick={() => setFilterKind(k)}
              className={`flex-shrink-0 px-3.5 h-8 rounded-full text-[13px] font-medium transition-all duration-200 ${
                filterKind === k
                  ? 'bg-[#1C1C1E] text-white'
                  : 'bg-white text-[#1C1C1E] shadow-[0_1px_2px_rgba(0,0,0,0.06)]'
              }`}
            >
              {k === 'すべて' ? 'すべて' : `${KIND_CONFIG[k].emoji} ${KIND_CONFIG[k].label}`}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-20 text-[#AEAEB2] text-[13px]">読み込み中…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#767680]/10 flex items-center justify-center text-3xl">💡</div>
            <p className="text-[15px] font-medium text-[#8E8E93]">まだメモがありません</p>
            <p className="text-[13px] text-[#AEAEB2] mt-1">気づいたこと・疑問を残しておきましょう</p>
          </div>
        ) : (
          <>
            {unresolved.length > 0 && (
              <div className="ios-card overflow-hidden divide-y divide-black/[0.04]">
                {unresolved.map(s => (
                  <SparkRow key={s.id} spark={s} onToggleResolved={toggleResolved} onEdit={setEditing} />
                ))}
              </div>
            )}
            {resolved.length > 0 && (
              <div>
                <p className="text-[13px] font-semibold text-[#8E8E93] mb-2 px-3">解決済み</p>
                <div className="ios-card overflow-hidden divide-y divide-black/[0.04]">
                  {resolved.map(s => (
                    <SparkRow key={s.id} spark={s} onToggleResolved={toggleResolved} onEdit={setEditing} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {editing && (
        <SparkModal
          spark={editing}
          onSave={updateSpark}
          onDelete={deleteSpark}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
