import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// イベント期間登録フォームで使う「取引先→分類」上書きパターンのテンプレート
// （journal_override_templates）を取得・追加・削除する。
// 2026-09-13、本人より「毎回同じ組み合わせを手入力するのが手間」との指摘を受けて新設。
// overridesの形は journal_event_periods.overrides と同じ { 取引先名: '分類名', ... }。

// 初回利用時（そのユーザーのテンプレートがまだ1件もない時）に自動生成しておく定番パターン。
// 2026-08-29の汎用化以前、journalRules.js にハードコードされていた旅行時の上書きと同一。
const DEFAULT_TEMPLATES = [
  { name: '娯楽', overrides: { '住友VISA': 'イベント', '横浜VISA': 'ETC娯楽' } },
]

export function useOverrideTemplates(userId) {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchTemplates = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    const { data, error } = await supabase
      .from('journal_override_templates')
      .select('id, name, overrides')
      .eq('user_id', userId)
      .order('name', { ascending: true })

    if (!error && data) {
      if (data.length === 0) {
        // 初回アクセス時のみ、定番テンプレートを自動投入してから取得し直す
        for (const t of DEFAULT_TEMPLATES) {
          await supabase.from('journal_override_templates').insert({ user_id: userId, ...t })
        }
        const retry = await supabase
          .from('journal_override_templates')
          .select('id, name, overrides')
          .eq('user_id', userId)
          .order('name', { ascending: true })
        setTemplates(retry.data || [])
      } else {
        setTemplates(data)
      }
    }
    setLoading(false)
  }, [userId])

  useEffect(() => { fetchTemplates() }, [fetchTemplates])

  async function addTemplate({ name, overrides }) {
    const { error } = await supabase.from('journal_override_templates').insert({ user_id: userId, name, overrides })
    if (error) throw error
    await fetchTemplates()
  }

  async function deleteTemplate(id) {
    const { error } = await supabase.from('journal_override_templates').delete().eq('id', id)
    if (error) throw error
    await fetchTemplates()
  }

  return { templates, loading, addTemplate, deleteTemplate }
}
