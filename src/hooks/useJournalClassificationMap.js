import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// journal_classification_map（分類１→分類２→分類３の対応表）を全件取得し、
// (institution, classification_1) -> { classification_2, classification_3 } のMapを組む。
// 146件程度（2026-08-29時点）なので全件取得で十分。
export function useJournalClassificationMap(userId) {
  const [map, setMap] = useState(new Map())
  // 取引先横断の仕訳２・仕訳３・取引先/グループのdistinct値一覧（未仕訳タブの
  // 「＋ 新しい仕訳分類を追加」フォームで、既存値からの選択・入力候補として使う。
  // 2026-09-21新設、2026-09-23：明細登録ではなく仕訳分類定義の登録用途に作り直し）。
  const [classification2Options, setClassification2Options] = useState([])
  const [classification3Options, setClassification3Options] = useState([])
  const [institutionGroupOptions, setInstitutionGroupOptions] = useState([])
  // 取引先ごとの仕訳１一覧、および全取引先共通の仕訳１一覧（2026-09-26新設）。
  // 未仕訳の候補ボタンはjournalRules.js（535ルール）由来のALL_CLASSIFICATIONS等から
  // 生成されており、journal_classification_mapへ新規登録した仕訳１はそれだけでは
  // 候補に出てこないというバグが発覚（本人報告：「登録できたが未仕訳の分類で出てこない」）。
  // PendingJournalEntries側でALL_CLASSIFICATIONSとマージして候補に含めるための一覧。
  const [classification1ByInstitution, setClassification1ByInstitution] = useState(new Map())
  const [allClassification1, setAllClassification1] = useState([])
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
      const groups = new Set()
      const c1ByInstitution = new Map()
      const c1All = new Set()
      for (const row of data) {
        m.set(`${row.institution_or_group}|${row.classification_1}`, {
          classification_2: row.classification_2,
          classification_3: row.classification_3,
        })
        if (row.classification_2) c2.add(row.classification_2)
        if (row.classification_3) c3.add(row.classification_3)
        if (row.institution_or_group) groups.add(row.institution_or_group)
        if (row.classification_1) {
          c1All.add(row.classification_1)
          if (row.institution_or_group) {
            if (!c1ByInstitution.has(row.institution_or_group)) c1ByInstitution.set(row.institution_or_group, new Set())
            c1ByInstitution.get(row.institution_or_group).add(row.classification_1)
          }
        }
      }
      setMap(m)
      setClassification2Options([...c2].sort())
      setClassification3Options([...c3].sort())
      setInstitutionGroupOptions([...groups].sort())
      setClassification1ByInstitution(new Map([...c1ByInstitution].map(([k, v]) => [k, [...v].sort()])))
      setAllClassification1([...c1All].sort())
    }
    setLoading(false)
  }, [userId])

  useEffect(() => { fetchMap() }, [fetchMap])

  // 仕訳分類定義（仕訳１→仕訳２・仕訳３）を新規登録する（2026-09-23新設、本人の指示：
  // 「未仕訳を仕訳するときに新しい明細を登録できるようにしてほしい」の真意が実は
  // 「候補に無い仕訳の組み合わせをその場で定義したい」だったと判明したため作り直した。
  // 実際の取引（journal_entries）とは無関係のため日付・金額は扱わない）。
  // (user_id, institution_or_group, classification_1)一意制約でupsertし、同じ組み合わせの
  // 再登録は上書き更新になる（journal_custom_rulesのaddRuleと同じ考え方）。
  async function addDefinition({ institutionOrGroup, classification1, classification2, classification3, cashflowDirection, note }) {
    const { error } = await supabase.from('journal_classification_map').upsert({
      user_id: userId,
      institution_or_group: institutionOrGroup,
      classification_1: classification1,
      classification_2: classification2,
      classification_3: classification3,
      cashflow_direction: cashflowDirection,
      status: '新規',
      note: note || null,
    }, { onConflict: 'user_id,institution_or_group,classification_1' })
    if (error) throw error
    await fetchMap()
  }

  return {
    map, classification2Options, classification3Options, institutionGroupOptions,
    classification1ByInstitution, allClassification1,
    loading, refetch: fetchMap, addDefinition,
  }
}
