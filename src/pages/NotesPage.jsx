import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useNotes } from '../hooks/useNotes'
import Markdown from '../components/Markdown'

const URL_REGEX = /(https?:\/\/[^\s　-鿿＀-￯]+)/g

function LinkedText({ text, className }) {
  if (!text) return null
  const parts = text.split(URL_REGEX)
  return (
    <span className={className}>
      {parts.map((part, i) =>
        URL_REGEX.test(part) ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="text-[#007AFF] underline underline-offset-1 break-all"
          >
            {part}
          </a>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  )
}

const NOTE_COLORS = [
  { value: '#FFFFFF', label: 'デフォルト' },
  { value: '#FAAFA8', label: 'コーラル' },
  { value: '#F39F76', label: 'ピーチ' },
  { value: '#FFF8B8', label: 'サンド' },
  { value: '#E2F6D3', label: 'ミント' },
  { value: '#B4DDD3', label: 'セージ' },
  { value: '#D4E4ED', label: 'フォグ' },
  { value: '#AECCDC', label: 'ストーム' },
  { value: '#D3BFDB', label: 'ダスク' },
  { value: '#F6E2DD', label: 'ブロッサム' },
  { value: '#E9E3D4', label: 'クレイ' },
]

function PinIcon({ filled, className }) {
  return filled ? (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M16 3H8a1 1 0 000 2h.5v6.36l-2.2 2.2A1 1 0 007 15.27V16a1 1 0 001 1h3v4.5a1 1 0 002 0V17h3a1 1 0 001-1v-.73a1 1 0 00-.3-.71l-2.2-2.2V5h.5a1 1 0 000-2z"/>
    </svg>
  ) : (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 4H8m1 1v6.5l-2.5 2.5V16h11v-2l-2.5-2.5V5M12 17v4.5"/>
    </svg>
  )
}

function ColorDots({ selected, onSelect }) {
  return (
    <div className="flex gap-2 flex-wrap">
      {NOTE_COLORS.map(c => (
        <button
          key={c.value}
          type="button"
          title={c.label}
          onClick={() => onSelect(c.value)}
          className={`w-7 h-7 rounded-full border transition-transform active:scale-90 ${
            selected === c.value ? 'ring-2 ring-[#007AFF] ring-offset-1 border-transparent' : 'border-black/10'
          }`}
          style={{ backgroundColor: c.value }}
        />
      ))}
    </div>
  )
}

function CategorySelect({ value, onChange, categories, className = '' }) {
  return (
    <select
      value={value ?? ''}
      onChange={e => onChange(e.target.value || null)}
      className={`text-[13px] text-[#8E8E93] bg-transparent focus:outline-none ${className}`}
      onClick={e => e.stopPropagation()}
    >
      <option value="">カテゴリなし</option>
      {categories.map(cat => (
        <option key={cat.id} value={cat.name}>{cat.name}</option>
      ))}
    </select>
  )
}

// 新規メモ入力
function QuickAdd({ onAdd, categories, defaultCategory }) {
  const [expanded, setExpanded] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [color, setColor] = useState('#FFFFFF')
  const [category, setCategory] = useState(defaultCategory ?? null)
  const [saving, setSaving] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    setCategory(defaultCategory ?? null)
  }, [defaultCategory])

  async function save() {
    if (!title.trim() && !content.trim()) { reset(); return }
    setSaving(true)
    await onAdd({ title: title.trim() || null, content: content.trim() || null, color, pinned: false, category })
    setSaving(false)
    reset()
  }

  function reset() {
    setExpanded(false)
    setTitle('')
    setContent('')
    setColor('#FFFFFF')
    setCategory(defaultCategory ?? null)
  }

  useEffect(() => {
    if (!expanded) return
    function handle(e) {
      if (ref.current && !ref.current.contains(e.target)) save()
    }
    document.addEventListener('mousedown', handle)
    document.addEventListener('touchstart', handle)
    return () => {
      document.removeEventListener('mousedown', handle)
      document.removeEventListener('touchstart', handle)
    }
  })

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="w-full text-left px-4 py-3 rounded-[14px] bg-white text-[15px] text-[#8E8E93] shadow-[0_1px_2px_rgba(0,0,0,0.06),0_2px_8px_rgba(0,0,0,0.04)] active:bg-black/[0.02] transition-colors"
      >
        メモを入力…
      </button>
    )
  }

  return (
    <div
      ref={ref}
      className="rounded-[14px] shadow-[0_2px_12px_rgba(0,0,0,0.1)] overflow-hidden border border-black/5"
      style={{ backgroundColor: color }}
    >
      <input
        autoFocus
        type="text"
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="タイトル"
        className="w-full px-4 pt-3 pb-1 text-[16px] font-semibold text-[#1C1C1E] placeholder:text-[#8E8E93]/60 bg-transparent focus:outline-none"
      />
      <textarea
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder="メモを入力…"
        rows={4}
        className="w-full px-4 py-1 text-[16px] text-[#1C1C1E] placeholder:text-[#8E8E93]/60 bg-transparent focus:outline-none resize-none leading-relaxed"
      />
      <div className="flex items-center justify-between px-3 py-2 gap-2">
        <ColorDots selected={color} onSelect={setColor} />
        <div className="flex items-center gap-2 flex-shrink-0">
          <CategorySelect value={category} onChange={setCategory} categories={categories} />
          <button
            onClick={save}
            disabled={saving}
            className="text-[14px] font-semibold text-[#007AFF] px-3 py-1.5 rounded-full active:opacity-50 disabled:opacity-40 transition-opacity"
          >
            {saving ? '保存中…' : '閉じる'}
          </button>
        </div>
      </div>
    </div>
  )
}

// メモ編集モーダル
function NoteModal({ note, onSave, onDelete, onClose, categories }) {
  const [title, setTitle] = useState(note.title ?? '')
  const [content, setContent] = useState(note.content ?? '')
  const [color, setColor] = useState(note.color ?? '#FFFFFF')
  const [pinned, setPinned] = useState(note.pinned)
  const [category, setCategory] = useState(note.category ?? null)
  const [preview, setPreview] = useState(false)
  const [expanded, setExpanded] = useState(false)

  async function handleClose() {
    const changed =
      (title.trim() || null) !== note.title ||
      (content.trim() || null) !== note.content ||
      color !== note.color ||
      pinned !== note.pinned ||
      category !== note.category
    if (changed) {
      await onSave(note.id, {
        title: title.trim() || null,
        content: content.trim() || null,
        color,
        pinned,
        category,
      })
    }
    onClose()
  }

  async function handleDelete() {
    if (!window.confirm('このメモを削除しますか？')) return
    await onDelete(note.id)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={handleClose} />
      <div
        className={`relative w-full rounded-t-[20px] md:rounded-[20px] shadow-2xl overflow-hidden flex flex-col h-[90vh] max-h-[90vh] transition-all duration-200 ${
          expanded
            ? 'max-w-lg md:max-w-5xl md:h-[94vh]'
            : 'max-w-lg md:max-w-2xl md:h-[78vh]'
        }`}
        style={{ backgroundColor: color }}
      >
        <div className="flex items-center justify-between px-3 pt-3">
          <button
            onClick={() => setPinned(!pinned)}
            className={`w-9 h-9 flex items-center justify-center rounded-full active:bg-black/5 transition-colors ${
              pinned ? 'text-[#1C1C1E]' : 'text-[#8E8E93]'
            }`}
            title={pinned ? 'ピンを外す' : 'ピン留め'}
          >
            <PinIcon filled={pinned} className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-1">
            {/* 拡大トグル（PCのみ） */}
            <button
              onClick={() => setExpanded(e => !e)}
              className="hidden md:flex w-9 h-9 items-center justify-center rounded-full text-[#8E8E93] hover:text-[#1C1C1E] active:bg-black/5 transition-colors"
              title={expanded ? '通常サイズ' : '拡大'}
            >
              {expanded ? (
                <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 9L4 4m0 0v4m0-4h4m11 5l5 5m0 0v-4m0 4h-4M9 15l-5 5m0 0v-4m0 4h4m11-5l5-5m0 0v4m0-4h-4" />
                </svg>
              ) : (
                <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
              )}
            </button>
            <button
              onClick={() => setPreview(p => !p)}
              className={`text-[13px] font-medium px-3 py-1.5 rounded-full active:opacity-50 transition-colors ${
                preview ? 'text-[#007AFF] bg-[#007AFF]/10' : 'text-[#8E8E93]'
              }`}
              title="Markdownプレビュー"
            >
              {preview ? '編集' : 'プレビュー'}
            </button>
            <button
              onClick={handleClose}
              className="text-[15px] font-semibold text-[#007AFF] px-3 py-1.5 rounded-full active:opacity-50 transition-opacity"
            >
              完了
            </button>
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden px-4 pb-2">
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="タイトル"
            className="flex-shrink-0 w-full py-2 text-[18px] font-semibold text-[#1C1C1E] placeholder:text-[#8E8E93]/60 bg-transparent focus:outline-none"
          />
          {preview ? (
            content.trim() ? (
              <div className="flex-1 overflow-y-auto py-1 min-h-[180px]">
                <Markdown className="!text-[15px]">{content}</Markdown>
              </div>
            ) : (
              <p className="py-3 text-[15px] text-[#8E8E93]/60">プレビューする内容がありません</p>
            )
          ) : (
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="メモを入力…（Markdown / 表に対応）"
              className="flex-1 min-h-[200px] w-full py-1 text-[16px] text-[#1C1C1E] placeholder:text-[#8E8E93]/60 bg-transparent focus:outline-none resize-none leading-relaxed"
            />
          )}
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t border-black/[0.06] gap-2">
          <ColorDots selected={color} onSelect={setColor} />
          <div className="flex items-center gap-2 flex-shrink-0">
            <CategorySelect value={category} onChange={setCategory} categories={categories} />
            <button
              onClick={handleDelete}
              className="w-9 h-9 flex items-center justify-center rounded-full text-[#8E8E93] hover:text-[#FF3B30] active:bg-black/5 transition-colors"
              title="削除"
            >
              <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const CATEGORY_TINTS = {
  '仕事':  'text-[#007AFF]',
  '個人':  'text-[#AF52DE]',
  '買い物': 'text-[#34C759]',
  '健康':  'text-[#FF3B30]',
  'その他': 'text-[#8E8E93]',
}

export default function NotesPage({ onBack, embedded, categories = [], filterCategory, onFilterChange }) {
  const { user } = useAuth()
  const { notes, loading, addNote, updateNote, deleteNote } = useNotes(user?.id)
  const [editing, setEditing] = useState(null)

  const activeFilter = filterCategory ?? 'すべて'
  const categoryNames = categories.map(c => c.name)

  const filteredNotes = activeFilter === 'すべて'
    ? notes
    : activeFilter === 'なし'
      ? notes.filter(n => !n.category)
      : notes.filter(n => n.category === activeFilter)

  const pinnedNotes = filteredNotes.filter(n => n.pinned)
  const otherNotes = filteredNotes.filter(n => !n.pinned)

  const defaultCategory = activeFilter !== 'すべて' && activeFilter !== 'なし' ? activeFilter : null

  function NoteCard({ note }) {
    const tint = CATEGORY_TINTS[note.category] ?? 'text-[#8E8E93]'
    return (
      <div
        onClick={() => setEditing(note)}
        className="w-full text-left rounded-[14px] p-4 mb-3 break-inside-avoid shadow-[0_1px_2px_rgba(0,0,0,0.05),0_2px_8px_rgba(0,0,0,0.04)] border border-black/[0.04] active:scale-[0.98] transition-transform relative cursor-pointer"
        style={{ backgroundColor: note.color ?? '#FFFFFF' }}
      >
        {note.pinned && (
          <PinIcon filled className="absolute top-2.5 right-2.5 w-4 h-4 text-[#8E8E93]" />
        )}
        {note.title && (
          <p className="text-[15px] font-semibold text-[#1C1C1E] mb-1 pr-5 break-words">{note.title}</p>
        )}
        {note.content && (
          <div className="max-h-[360px] overflow-hidden">
            <Markdown>{note.content}</Markdown>
          </div>
        )}
        {!note.title && !note.content && (
          <p className="text-[13px] text-[#AEAEB2]">（空のメモ）</p>
        )}
        {note.category && (
          <p className={`text-[11px] font-medium mt-2 ${tint}`}>{note.category}</p>
        )}
      </div>
    )
  }

  const content = (
    <>
      {/* モバイル カテゴリピル（embedded時のみ — PC は TodoPage のサイドバーで対応） */}
      {embedded && (
        <div className="md:hidden sticky top-[44px] z-[5] -mx-4 px-4 pt-2 pb-2.5 bg-[#F2F2F7]/85 backdrop-blur-xl flex gap-2 overflow-x-auto">
          {['すべて', ...categoryNames, 'なし'].map(cat => (
            <button
              key={cat}
              onClick={() => onFilterChange?.(cat)}
              className={`flex-shrink-0 px-3.5 h-8 rounded-full text-[13px] font-medium transition-all duration-200 ${
                activeFilter === cat
                  ? 'bg-[#1C1C1E] text-white'
                  : 'bg-white text-[#1C1C1E] shadow-[0_1px_2px_rgba(0,0,0,0.06)]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* 新規メモ入力 */}
      <div className="max-w-xl mx-auto mb-6">
        <QuickAdd onAdd={addNote} categories={categories} defaultCategory={defaultCategory} />
      </div>

      {loading ? (
        <div className="text-center py-20 text-[#AEAEB2] text-[13px]">読み込み中…</div>
      ) : filteredNotes.length === 0 ? (
        <div className="text-center py-24">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#767680]/10 flex items-center justify-center">
            <svg className="w-7 h-7 text-[#AEAEB2]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </div>
          <p className="text-[15px] font-medium text-[#8E8E93]">メモがありません</p>
          <p className="text-[13px] text-[#AEAEB2] mt-1">上の入力欄からメモを作成できます</p>
        </div>
      ) : (
        <>
          {pinnedNotes.length > 0 && (
            <div className="mb-4">
              <p className="text-[12px] font-semibold text-[#8E8E93] mb-2 px-1">ピン留め</p>
              <div className="columns-2 md:columns-3 gap-3">
                {pinnedNotes.map(n => <NoteCard key={n.id} note={n} />)}
              </div>
            </div>
          )}
          {otherNotes.length > 0 && (
            <div>
              {pinnedNotes.length > 0 && (
                <p className="text-[12px] font-semibold text-[#8E8E93] mb-2 px-1">その他</p>
              )}
              <div className="columns-2 md:columns-3 gap-3">
                {otherNotes.map(n => <NoteCard key={n.id} note={n} />)}
              </div>
            </div>
          )}
        </>
      )}
    </>
  )

  if (editing) {
    // NoteModal は embedded/standalone 共通でポータルのように表示
  }

  if (embedded) {
    return (
      <div>
        <main className="max-w-lg md:max-w-5xl mx-auto px-4 py-4 pb-28 md:pb-10 md:flex md:gap-8 md:items-start">
          {/* PC サイドバー */}
          <aside className="hidden md:block w-52 flex-shrink-0 sticky top-[60px]">
            <p className="text-[13px] font-semibold text-[#8E8E93] mb-2 px-3">カテゴリ</p>
            <div className="ios-card overflow-hidden divide-y divide-black/[0.04]">
              {['すべて', ...categoryNames, 'なし'].map(cat => (
                <button
                  key={cat}
                  onClick={() => onFilterChange?.(cat)}
                  className={`w-full flex items-center justify-between text-left px-4 py-2.5 text-[15px] transition-colors duration-150 ${
                    activeFilter === cat
                      ? 'text-[#007AFF] font-semibold bg-[#007AFF]/[0.06]'
                      : 'text-[#1C1C1E] hover:bg-black/[0.025] active:bg-black/5'
                  }`}
                >
                  {cat}
                  {activeFilter === cat && (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </aside>
          <div className="flex-1 min-w-0">{content}</div>
        </main>
        {editing && (
          <NoteModal
            note={editing}
            onSave={updateNote}
            onDelete={deleteNote}
            onClose={() => setEditing(null)}
            categories={categories}
          />
        )}
      </div>
    )
  }

  // スタンドアロン表示（将来のサブページ利用想定）
  return (
    <div className="min-h-screen">
      <header className="safe-top sticky top-0 z-10 bg-[#F2F2F7]/80 backdrop-blur-xl border-b border-black/5">
        <div className="max-w-lg md:max-w-4xl mx-auto px-4">
          <div className="flex items-center h-11">
            <button onClick={onBack} className="flex items-center text-[#007AFF] active:opacity-50 transition-opacity -ml-1">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              <span className="text-[16px]">戻る</span>
            </button>
          </div>
          <div className="pb-3 pt-1">
            <h1 className="text-[28px] font-bold tracking-tight text-[#1C1C1E] leading-tight">メモ</h1>
            <p className="text-[13px] text-[#8E8E93] mt-0.5">{notes.length}件</p>
          </div>
        </div>
      </header>
      <main className="max-w-lg md:max-w-4xl mx-auto px-4 py-4 pb-10">{content}</main>
      {editing && (
        <NoteModal
          note={editing}
          onSave={updateNote}
          onDelete={deleteNote}
          onClose={() => setEditing(null)}
          categories={categories}
        />
      )}
    </div>
  )
}
