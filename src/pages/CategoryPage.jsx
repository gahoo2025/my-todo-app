import { useState } from 'react'
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

function SortableCategoryRow({ cat, onEdit, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: cat.id })
  const [editingName, setEditingName] = useState('')
  const [editing, setEditing] = useState(false)

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
  }

  async function handleSave() {
    if (!editingName.trim()) return
    await onEdit(cat.id, editingName)
    setEditing(false)
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white flex items-center gap-3 px-4 py-3 ${
        isDragging ? 'shadow-[0_8px_24px_rgba(0,0,0,0.12)] rounded-[14px] relative' : ''
      }`}
    >
      {/* ドラッグハンドル */}
      <button
        {...attributes}
        {...listeners}
        className="flex-shrink-0 text-[#D1D1D6] hover:text-[#AEAEB2] cursor-grab active:cursor-grabbing touch-none -ml-1.5 p-1"
      >
        <svg className="w-[14px] h-[14px]" fill="currentColor" viewBox="0 0 24 24">
          <circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/>
          <circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/>
          <circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/>
        </svg>
      </button>

      {editing ? (
        <input
          autoFocus
          type="text"
          value={editingName}
          onChange={e => setEditingName(e.target.value)}
          onBlur={handleSave}
          onKeyDown={e => {
            if (e.key === 'Enter') handleSave()
            if (e.key === 'Escape') setEditing(false)
          }}
          className="flex-1 text-[15px] px-3 py-1.5 rounded-[10px] bg-[#767680]/10 text-[#1C1C1E] focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30"
        />
      ) : (
        <span className="flex-1 text-[15px] text-[#1C1C1E]">{cat.name}</span>
      )}

      <div className="flex items-center flex-shrink-0">
        <button
          onClick={() => { setEditing(true); setEditingName(cat.name) }}
          className="ios-icon-btn"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
        <button
          onClick={() => { if (window.confirm(`「${cat.name}」を削除しますか？`)) onDelete(cat.id) }}
          className="ios-icon-btn hover:text-[#FF3B30] -mr-1.5"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  )
}

export default function CategoryPage({ categories, onAdd, onUpdate, onDelete, onReorder, onBack }) {
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  )

  async function handleAdd(e) {
    e.preventDefault()
    if (!newName.trim()) return
    setAdding(true)
    await onAdd(newName)
    setNewName('')
    setAdding(false)
  }

  function handleDragEnd(event) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    onReorder(active.id, over.id)
  }

  return (
    <div className="min-h-screen">
      {/* ナビゲーションバー */}
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
            <h1 className="text-[28px] font-bold tracking-tight text-[#1C1C1E] leading-tight">カテゴリ</h1>
            <p className="text-[13px] text-[#8E8E93] mt-0.5">{categories.length}件 · ドラッグで並び替え</p>
          </div>
        </div>
      </header>

      <main className="max-w-lg md:max-w-2xl mx-auto px-4 py-4 pb-10">
        {/* 追加フォーム */}
        <form onSubmit={handleAdd} className="flex gap-2 mb-6">
          <input
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="新しいカテゴリ名…"
            className="flex-1 px-4 py-2.5 rounded-[12px] bg-white text-[15px] text-[#1C1C1E] placeholder:text-[#AEAEB2] shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30"
          />
          <button
            type="submit"
            disabled={adding || !newName.trim()}
            className="px-5 py-2.5 rounded-[12px] bg-[#007AFF] text-white font-semibold text-[14px] active:opacity-70 disabled:opacity-40 transition-opacity"
          >
            追加
          </button>
        </form>

        {/* 固定「すべて」 */}
        <div className="ios-card overflow-hidden mb-3">
          <div className="flex items-center gap-3 px-4 py-3 opacity-50">
            <div className="w-[14px] flex-shrink-0" />
            <span className="flex-1 text-[15px] text-[#8E8E93]">すべて（固定）</span>
            <svg className="w-4 h-4 text-[#C7C7CC]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
        </div>

        {/* 並び替え可能なカテゴリリスト */}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={categories.map(c => c.id)} strategy={verticalListSortingStrategy}>
            <div className="ios-card overflow-hidden divide-y divide-black/[0.04]">
              {categories.map(cat => (
                <SortableCategoryRow
                  key={cat.id}
                  cat={cat}
                  onEdit={onUpdate}
                  onDelete={onDelete}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </main>
    </div>
  )
}
