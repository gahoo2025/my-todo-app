import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// journal_custom_rules（未仕訳を手動で仕訳した際に「次回から自動仕訳する」で登録した
// 学習ルール）を取得・追加・削除する。2026-09-20、本人の指示：「未仕訳を仕訳する際、
// 今後は自動仕訳に登録できる仕組みが欲しい」。既存の535件ルール（journalRules.js）で
// 一切マッチしなかった摘要（unmatched）にのみ適用する設計（詳細はjournalRules.jsの
// applyCustomRuleコメント参照）。
export function useCustomRules(userId) {
  const [rules, setRules] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchRules = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    const { data, error } = await supabase
      .from('journal_custom_rules')
      .select('id, institution, card_holder, pattern, classification')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })

    if (!error && data) {
      setRules(data.map(row => ({
        id: row.id,
        institution: row.institution,
        holder: row.card_holder,
        pattern: row.pattern,
        classification: row.classification,
      })))
    }
    setLoading(false)
  }, [userId])

  useEffect(() => { fetchRules() }, [fetchRules])

  // 同一（取引先・名義・摘要パターン）は一意制約でupsertし、分類を上書きする
  // （間違って登録した場合、再度チェックを入れて仕訳し直せば訂正できるようにするため）。
  async function addRule({ institution, holder, pattern, classification }) {
    const { error } = await supabase.from('journal_custom_rules').upsert({
      user_id: userId,
      institution,
      card_holder: holder ?? null,
      pattern,
      classification,
    }, { onConflict: 'user_id,institution,card_holder,pattern' })
    if (error) throw error
    await fetchRules()
  }

  async function deleteRule(id) {
    const { error } = await supabase.from('journal_custom_rules').delete().eq('id', id)
    if (error) throw error
    await fetchRules()
  }

  return { rules, loading, addRule, deleteRule, refetch: fetchRules }
}
