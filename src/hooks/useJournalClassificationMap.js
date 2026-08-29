import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// journal_classification_map（分類１→分類２→分類３の対応表）を全件取得し、
// (institution, classification_1) -> { classification_2, classification_3 } のMapを組む。
// 146件程度（2026-08-29時点）なので全件取得で十分。
export function useJournalClassificationMap(userId) {
  const [map, setMap] = useState(new Map())
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
      for (const row of data) {
        m.set(`${row.institution_or_group}|${row.classification_1}`, {
          classification_2: row.classification_2,
          classification_3: row.classification_3,
        })
      }
      setMap(m)
    }
    setLoading(false)
  }, [userId])

  useEffect(() => { fetchMap() }, [fetchMap])

  return { map, loading, refetch: fetchMap }
}
