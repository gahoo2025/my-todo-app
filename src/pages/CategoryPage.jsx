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
    opacity: isDragging ? 0.5 : undefined,
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
      className={`bg-white rounded-2xl px-4 py-3 shadow-sm border border-gray-100 flex items-center gap-3 ${isDragging ? 'shadow-lg border-violet-200' : ''}`}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="flex-shrink-0 text-gray-200 hover:text-gray-400 cursor-grab active:cursor-grabbing touch-none p-1 -ml-1"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/>
          <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
          <circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/>
        </svg>
      </button>

      <div className="w-2 h-2 rounded-full bg-violet-400 flex-shrink-0" />

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
          className="flex-1 text-sm px-2 py-1 rounded-lg border border-violet-200 focus:outline-none focus:ring-1 focus:ring-violet-400"
        />
      ) : (
        <span className="flex-1 text-sm font-medium text-gray-700">{cat.name}</span>
      )}

      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={() => { setEditing(true); setEditingName(cat.name) }}
          className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-300 hover:text-violet-500 hover:bg-violet-50 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </button>
        <button
          onClick={() => { if (window.confirm(`「${cat.name}」を削除しますか？`)) onDelete(cat.id) }}
          className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
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
    <div className="min-h-screen bg-slate-50">
      <header className="text-white px-4 py-4 sticky top-0 z-10"
        style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <button onClick={onBack}
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/20 hover:bg-white/30 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-lg font-bold">カテゴリ管理</h1>
            <p className="text-xs text-white/70">{categories.length}件 · ドラッグで並び替え可能</p>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-4 pb-8">
        {/* Add form */}
        <form onSubmit={handleAdd} className="flex gap-2 mb-6">
          <input
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="新しいカテゴリ名..."
            className="flex-1 px-4 py-3 rounded-xl border border-gray-100 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400 text-sm shadow-sm"
          />
          <button
            type="submit"
            disabled={adding || !newName.trim()}
            className="px-4 py-3 text-white rounded-xl font-bold text-sm disabled:opacity-50 transition-all active:scale-95 shadow-sm"
            style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
          >
            追加
          </button>
        </form>

        {/* Fixed "すべて" row */}
        <div className="bg-white rounded-2xl px-4 py-3 shadow-sm border border-gray-100 flex items-center gap-3 mb-2 opacity-60">
          <div className="w-4 h-4 flex-shrink-0" />
          <div className="w-2 h-2 rounded-full bg-gray-300 flex-shrink-0" />
          <span className="flex-1 text-sm font-medium text-gray-400">すべて（固定）</span>
        </div>

        {/* Sortable category list */}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={categories.map(c => c.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
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
