import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const DB_NAME = 'asset-import-folder'
const STORE = 'handles'
const KEY = 'folder'

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function saveHandle(handle) {
  const db = await openDb()
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(handle, KEY)
    tx.oncomplete = resolve
    tx.onerror = () => reject(tx.error)
  })
}

async function loadHandle() {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(KEY)
    req.onsuccess = () => resolve(req.result ?? null)
    req.onerror = () => reject(req.error)
  })
}

// File System Access API はChrome/Edge等のデスクトップブラウザのみ対応
export function isFolderPickerSupported() {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window
}

export function useAssetHoldingsImport(userId) {
  const [folderName, setFolderName] = useState(null)
  const [detectedFiles, setDetectedFiles] = useState([])
  const [scanning, setScanning] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)

  const restoreFolder = useCallback(async () => {
    try {
      const handle = await loadHandle()
      if (!handle) return
      const perm = await handle.queryPermission({ mode: 'read' })
      if (perm === 'granted') setFolderName(handle.name)
    } catch {
      // 保存先が無い/壊れている場合は無視
    }
  }, [])

  async function pickFolder() {
    const handle = await window.showDirectoryPicker()
    await saveHandle(handle)
    setFolderName(handle.name)
    setDetectedFiles([])
    setImportResult(null)
  }

  async function scanFolder() {
    setScanning(true)
    setImportResult(null)
    try {
      let handle = await loadHandle()
      if (!handle) { setScanning(false); return }
      const perm = await handle.queryPermission({ mode: 'read' })
      if (perm !== 'granted') {
        const req = await handle.requestPermission({ mode: 'read' })
        if (req !== 'granted') { setScanning(false); return }
      }
      setFolderName(handle.name)

      const files = []
      for await (const entry of handle.values()) {
        if (entry.kind !== 'file' || !entry.name.toLowerCase().endsWith('.csv')) continue
        const file = await entry.getFile()
        const buf = await file.arrayBuffer()
        let text
        try {
          text = new TextDecoder('shift_jis').decode(buf)
        } catch {
          text = new TextDecoder('utf-8').decode(buf)
        }
        const type = detectTypeClient(text)
        files.push({ filename: entry.name, text, type, person: '', broker: '' })
      }
      setDetectedFiles(files)
    } finally {
      setScanning(false)
    }
  }

  function updateFileAssignment(filename, field, value) {
    setDetectedFiles(prev => prev.map(f => f.filename === filename ? { ...f, [field]: value } : f))
  }

  async function runImport() {
    const ready = detectedFiles.filter(f => f.type && f.person && f.broker)
    if (ready.length === 0) {
      setImportResult({ error: '取り込むファイルがありません（人物・証券会社を選択してください）' })
      return
    }
    setImporting(true)
    setImportResult(null)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      if (!token) {
        setImportResult({ error: 'ログイン情報が取得できませんでした' })
        return
      }
      const r = await fetch('/api/import-asset-holdings', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: ready.map(({ filename, text, person, broker }) => ({ filename, text, person, broker })),
        }),
      })
      const text = await r.text()
      let body
      try { body = JSON.parse(text) } catch {
        setImportResult({ error: `サーバー応答を解析できませんでした（HTTP ${r.status}）` })
        return
      }
      if (!r.ok) {
        setImportResult({ error: body?.error?.message || body?.error || '取り込みに失敗しました' })
        return
      }
      setImportResult({ success: true, ...body })
      setDetectedFiles([])
    } catch (err) {
      setImportResult({ error: `${err?.name ?? 'Error'}: ${err?.message ?? String(err)}` })
    } finally {
      setImporting(false)
    }
  }

  return {
    folderName, detectedFiles, scanning, importing, importResult,
    restoreFolder, pickFolder, scanFolder, updateFileAssignment, runImport,
  }
}

function detectTypeClient(text) {
  const firstLine = (text.split(/\r?\n/)[0] || '').trim()
  if (firstLine.replace(/"/g, '') === '■資産合計欄') return 'assetbalanceall'
  if (firstLine.includes('投資信託種別')) return 'assetbalanceinvst'
  if (firstLine.includes('銘柄コード') && firstLine.includes('日付')) return 'stockposition'
  return null
}
