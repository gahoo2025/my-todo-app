import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { buildGroups, detectTypeFromFilename, parseFilenameStamp } from '../lib/assetImportGroups'

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

function decodeText(buf) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf)
  } catch {
    return new TextDecoder('shift_jis').decode(buf)
  }
}

export function useAssetHoldingsImport(onImported) {
  const [folderName, setFolderName] = useState(null)
  const [groups, setGroups] = useState([])
  const [unmatchedFiles, setUnmatchedFiles] = useState([])
  const [scannedFiles, setScannedFiles] = useState([])
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
    setGroups([])
    setUnmatchedFiles([])
    setImportResult(null)
  }

  async function doImport(readyFiles) {
    setImporting(true)
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
          files: readyFiles.map(({ filename, text, type, person, broker, recordedAtOverride }) => ({ filename, text, type, person, broker, recordedAtOverride })),
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
      onImported?.()
    } catch (err) {
      setImportResult({ error: `${err?.name ?? 'Error'}: ${err?.message ?? String(err)}` })
    } finally {
      setImporting(false)
    }
  }

  // フォルダ確認→対象日付の判定→取り込みまでを1回の操作で行う
  async function scanAndImport() {
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
        const text = decodeText(buf)
        const type = detectTypeFromFilename(entry.name)
        files.push({ filename: entry.name, text, type })
      }
      setUnmatchedFiles(files.filter(f => !f.type).map(f => f.filename))
      const builtGroups = buildGroups(files.filter(f => f.type))
      setGroups(builtGroups)
      setScannedFiles(files.map(f => ({
        filename: f.filename,
        type: f.type,
        stamp: f.type ? parseFilenameStamp(f.filename) : null,
      })))

      const readyFiles = builtGroups.filter(g => g.ok).flatMap(g => g.files)
      setScanning(false)
      if (readyFiles.length === 0) {
        setImportResult({ error: '取り込める日付分がありません（7ファイルが揃っている日付がありません）' })
        return
      }
      await doImport(readyFiles)
    } finally {
      setScanning(false)
    }
  }

  return {
    folderName, groups, unmatchedFiles, scannedFiles, scanning, importing, importResult,
    restoreFolder, pickFolder, scanAndImport,
  }
}
