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

function decodeText(buf) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf)
  } catch {
    return new TextDecoder('shift_jis').decode(buf)
  }
}

// ファイル名の先頭パターンで種別を判定する（資産管理アプリの手動ダウンロード手順で固定）
function detectTypeFromFilename(filename) {
  if (/^assetbalance\(all\)_/i.test(filename)) return 'assetbalanceall'
  if (/^assetbalance\(invst\)_/i.test(filename)) return 'assetbalanceinvst'
  if (/^balance-summary_/i.test(filename)) return 'balancesummary'
  if (/^stockposition/i.test(filename)) return 'stockposition'
  return null
}

// ファイル名から日付(YYYYMMDD)とその後ろのタイムスタンプ(あれば)を取り出す
function parseFilenameStamp(filename) {
  const m = /_(\d{8})_?(\d{6})?/.exec(filename)
  if (!m) return null
  return { date: m[1], time: m[2] || '' }
}

const REQUIRED_COUNTS = { assetbalanceall: 2, assetbalanceinvst: 3, balancesummary: 1, stockposition: 1 }

// 日付ごとにグループ化し、各種別のタイムスタンプ順で人物・証券会社を自動割り当てする
function buildGroups(files) {
  const byDate = {}
  for (const f of files) {
    const stamp = parseFilenameStamp(f.filename)
    if (!f.type || !stamp) continue
    byDate[stamp.date] ??= { assetbalanceall: [], assetbalanceinvst: [], balancesummary: [], stockposition: [] }
    byDate[stamp.date][f.type].push({ ...f, time: stamp.time })
  }

  const groups = []
  for (const [date, byType] of Object.entries(byDate)) {
    const counts = Object.fromEntries(Object.keys(REQUIRED_COUNTS).map(t => [t, byType[t].length]))
    const ok = Object.entries(REQUIRED_COUNTS).every(([t, n]) => counts[t] === n)
    const assigned = []
    if (ok) {
      const sorted = t => [...byType[t]].sort((a, b) => a.time.localeCompare(b.time))
      const all = sorted('assetbalanceall')
      assigned.push({ ...all[0], person: 'パパ', broker: '楽天' })
      assigned.push({ ...all[1], person: 'ママ', broker: '楽天' })
      const invst = sorted('assetbalanceinvst')
      const invstPersons = ['長女', '次女', '長男']
      invst.forEach((f, i) => assigned.push({ ...f, person: invstPersons[i], broker: '楽天' }))
      assigned.push({ ...byType.balancesummary[0], person: 'パパ', broker: '大和' })
      assigned.push({ ...byType.stockposition[0], person: 'パパ', broker: 'マネックス' })
    }
    groups.push({ date, ok, counts, files: ok ? assigned : [...byType.assetbalanceall, ...byType.assetbalanceinvst, ...byType.balancesummary, ...byType.stockposition] })
  }
  return groups.sort((a, b) => a.date.localeCompare(b.date))
}

export function useAssetHoldingsImport() {
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
        const text = decodeText(buf)
        const type = detectTypeFromFilename(entry.name)
        files.push({ filename: entry.name, text, type })
      }
      setUnmatchedFiles(files.filter(f => !f.type).map(f => f.filename))
      setGroups(buildGroups(files.filter(f => f.type)))
      setScannedFiles(files.map(f => ({
        filename: f.filename,
        type: f.type,
        stamp: f.type ? parseFilenameStamp(f.filename) : null,
      })))
    } finally {
      setScanning(false)
    }
  }

  async function runImport() {
    const readyFiles = groups.filter(g => g.ok).flatMap(g => g.files)
    if (readyFiles.length === 0) {
      setImportResult({ error: '取り込める日付分がありません（7ファイルが揃っている日付がありません）' })
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
          files: readyFiles.map(({ filename, text, type, person, broker }) => ({ filename, text, type, person, broker })),
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
      setGroups([])
    } catch (err) {
      setImportResult({ error: `${err?.name ?? 'Error'}: ${err?.message ?? String(err)}` })
    } finally {
      setImporting(false)
    }
  }

  return {
    folderName, groups, unmatchedFiles, scannedFiles, scanning, importing, importResult,
    restoreFolder, pickFolder, scanFolder, runImport,
  }
}
