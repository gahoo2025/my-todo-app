import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { parseBankStatement, billingMonthFromFilename } from '../lib/bankStatementParser'
import { classifyDescription, applyEventPeriodOverride, ALL_CLASSIFICATIONS } from '../lib/journalRules'

const CARD_INSTITUTIONS = new Set(['住友VISA', '横浜VISA', '楽天カードえみ'])

const DB_NAME = 'bank-statement-import-folder'
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

function billingMonthOf(dateStr) {
  return dateStr.replace(/-/g, '').slice(0, 6)
}

// 銀行は利用日=支払月だが、カードはファイル名（例：202607.csv）から支払月を推定する。
// ファイル名から取れない場合は取引日の月で代用する（精度は落ちるが未設定よりは安全）。
function billingMonthFor(institution, transactionDate, sourceFile) {
  if (CARD_INSTITUTIONS.has(institution)) {
    return billingMonthFromFilename(sourceFile) || billingMonthOf(transactionDate)
  }
  return billingMonthOf(transactionDate)
}

function dupKey(institution, date, direction, amount) {
  return `${institution}|${date}|${direction}|${Number(amount)}`
}

export function useBankStatementImport(userId, onImported, eventPeriods) {
  const [folderName, setFolderName] = useState(null)
  const [scanning, setScanning] = useState(false)
  const [importing, setImporting] = useState(false)
  const [unmatchedFiles, setUnmatchedFiles] = useState([]) // 取引先を判別できなかったファイル名
  const [readyRows, setReadyRows] = useState([]) // 自動確定済み（インポート待ち）
  const [queue, setQueue] = useState([]) // 確認要（1件ずつ選択させる）
  const [duplicateCount, setDuplicateCount] = useState(0)
  const [scanResult, setScanResult] = useState(null)
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
    resetScan()
  }

  function resetScan() {
    setUnmatchedFiles([])
    setReadyRows([])
    setQueue([])
    setDuplicateCount(0)
    setScanResult(null)
    setImportResult(null)
  }

  async function scan() {
    setScanning(true)
    resetScan()
    try {
      let handle = await loadHandle()
      if (!handle) { setScanning(false); return }
      const perm = await handle.queryPermission({ mode: 'read' })
      if (perm !== 'granted') {
        const req = await handle.requestPermission({ mode: 'read' })
        if (req !== 'granted') { setScanning(false); return }
      }
      setFolderName(handle.name)

      const unmatched = []
      const parsedRows = [] // { institution, transaction_date, description, direction, amount, balance, source_file }
      for await (const entry of handle.values()) {
        if (entry.kind !== 'file' || !entry.name.toLowerCase().endsWith('.csv')) continue
        const file = await entry.getFile()
        const buf = await file.arrayBuffer()
        const text = decodeText(buf)
        const parsed = parseBankStatement(text)
        if (!parsed) { unmatched.push(entry.name); continue }
        for (const row of parsed.rows) {
          parsedRows.push({ ...row, institution: parsed.institution, source_file: entry.name })
        }
      }

      // 取引先ごとに、ファイル内の並び順のまま仕訳１（一次仕訳）を適用する（直前行継承ルールのため）
      const institutions = [...new Set(parsedRows.map(r => r.institution))]
      const previousByInstitutionFile = {}
      const classifiedAll = parsedRows.map(row => {
        const key = `${row.institution}|${row.source_file}`
        const prev = previousByInstitutionFile[key]
        const classified = classifyDescription(row.institution, row.description, { previousClassification: prev, holder: row.holder })
        // イベント期間（EVENT_PERIODS）に該当する場合、店名パターンによる分類を上書きする
        const result = applyEventPeriodOverride(row.institution, row.transaction_date, classified, eventPeriods)
        if (result.classification) previousByInstitutionFile[key] = result.classification
        return { ...row, ...result }
      })
      // exclude（カード名義ヘッダー行の表記ゆれ・海外利用の換算レート注記行など、実取引ではない行）は除外する
      let excludedCount = 0
      const classified = classifiedAll.filter(row => {
        if (row.status === 'exclude') { excludedCount++; return false }
        return true
      })

      // 既存の登録済み仕訳（過去データ含む）と重複するものはスキップする
      let existingKeys = new Set()
      if (userId && institutions.length > 0) {
        const minDate = classified.reduce((m, r) => (r.transaction_date < m ? r.transaction_date : m), classified[0]?.transaction_date ?? '9999-99-99')
        let all = []
        let from = 0
        const pageSize = 1000
        for (;;) {
          const { data, error } = await supabase
            .from('journal_entries')
            .select('institution,transaction_date,direction,amount')
            .eq('user_id', userId)
            .in('institution', institutions)
            .gte('transaction_date', minDate)
            .range(from, from + pageSize - 1)
          if (error) throw error
          all = all.concat(data || [])
          if (!data || data.length < pageSize) break
          from += pageSize
        }
        existingKeys = new Set(all.map(r => dupKey(r.institution, r.transaction_date, r.direction, r.amount)))
      }

      const ready = []
      const needsReview = []
      let dupCount = 0
      for (const row of classified) {
        const key = dupKey(row.institution, row.transaction_date, row.direction, row.amount)
        if (existingKeys.has(key)) { dupCount++; continue }
        if (row.status === 'auto') {
          ready.push(row)
        } else {
          needsReview.push({
            ...row,
            candidates: row.candidates && row.candidates.length > 0 ? row.candidates : ALL_CLASSIFICATIONS,
          })
        }
      }

      setUnmatchedFiles(unmatched)
      setReadyRows(ready)
      setQueue(needsReview)
      setDuplicateCount(dupCount)
      setScanResult({ totalFiles: unmatched.length + institutions.length, institutions, total: classified.length, ready: ready.length, review: needsReview.length, duplicates: dupCount, excluded: excludedCount })
    } finally {
      setScanning(false)
    }
  }

  // 確認キューの先頭1件に分類を確定する（未選択のままスキップする場合は classification に null を渡す）
  function resolveQueueItem(classification) {
    setQueue(prev => {
      if (prev.length === 0) return prev
      const [first, ...rest] = prev
      setReadyRows(r => [...r, { ...first, classification, classification_source_override: 'manual' }])
      return rest
    })
  }

  async function importReady() {
    if (!userId || readyRows.length === 0) return
    setImporting(true)
    setImportResult(null)
    try {
      const rows = readyRows.map(r => ({
        user_id: userId,
        institution: r.institution,
        card_holder: r.institution === '住友VISA' ? r.holder : null,
        transaction_date: r.transaction_date,
        billing_month: billingMonthFor(r.institution, r.transaction_date, r.source_file),
        description: r.description,
        direction: r.direction,
        amount: r.amount,
        balance: r.balance,
        classification: r.classification,
        classification_source: r.classification_source_override || 'rule_auto',
        memo: r.needsConfirmation ? '（要確認：自動仕訳の再確認対象）' : null,
        source_file: r.source_file,
      }))
      const chunkSize = 500
      let inserted = 0
      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize)
        const { error } = await supabase.from('journal_entries').insert(chunk)
        if (error) throw error
        inserted += chunk.length
      }
      setImportResult({ success: true, inserted })
      setReadyRows([])
      onImported?.()
    } catch (err) {
      setImportResult({ error: `${err?.name ?? 'Error'}: ${err?.message ?? String(err)}` })
    } finally {
      setImporting(false)
    }
  }

  return {
    folderName, scanning, importing,
    unmatchedFiles, readyRows, queue, duplicateCount, scanResult, importResult,
    restoreFolder, pickFolder, scan, resolveQueueItem, importReady,
  }
}
