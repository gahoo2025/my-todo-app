import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// journal_classification_map（分類１→分類２→分類３の対応表）を全件取得し、
// (institution, classification_1) -> { classification_2, classification_3 } のMapを組む。
// 146件程度（2026-08-29時点）なので全件取得で十分。
export function useJournalClassificationMap(userId) {
  const [map, setMap] = useState(new Map())
  // 取引先横断の仕訳２・仕訳３のdistinct値一覧（未仕訳の明細手動登録フォームで、
  // 仕訳２・仕訳３を「既存のものから選択」させるための選択肢。2026-09-21新設）。
  const [classification2Options, setClassification2Options] = useState([])
  const [classification3Options, setClassification3Options] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchMap = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    const { data, error } = await supabase
      .from('journal_classification_map')
      .select('institution_or_group, classification_1, classification_2, classification_3')
      .eq('user_id', userId)

    if (!error && data) {
      const m = new Map()
      const c2 = new Set()
      const c3 = new Set()
      for (const row of data) {
        m.set(`${row.institution_or_group}|${row.classification_1}`, {
          classification_2: row.classification_2,
          classification_3: row.classification_3,
        })
        if (row.classification_2) c2.add(row.classification_2)
        if (row.classification_3) c3.add(row.classification_3)
      }
      setMap(m)
      setClassification2Options([...c2].sort())
      setClassification3Options([...c3].sort())
    }
    setLoading(false)
  }, [userId])

  useEffect(() => { fetchMap() }, [fetchMap])

  return { map, classification2Options, classification3Options, loading, refetch: fetchMap }
}
