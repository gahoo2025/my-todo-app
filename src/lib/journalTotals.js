// 家計簿（journal_entries）の「実質的な収支」を求めるための共通ロジック。
// AnnualClassificationSummary（分類別年間収支）とFiscalYearBalanceChart（収支推移グラフ）の
// 両方で同じ判定を使うことで、2つの画面の数値が食い違わないようにする（2026-08-30、
// 収支推移グラフ追加にあたり、AnnualClassificationSummary.jsxから共通部分を切り出した）。

// 取引先「すべて」表示時、銀行取引先側の「カード利用額の引き落とし」1行（分類１が
// カード取引先名そのもの）は、カード取引先側の明細（食費・ETC等）と同じお金を指して
// おり合算すると二重計上になるため、集計対象から除く（2026-08-29、本人の指示）。
//
// 判定は必ず「取引先（institution）＋分類１」の組み合わせで行う。分類名の文字列
// だけで判定してはいけない：実データで確認済みの通り、横浜銀行の「楽天カード」分類
// （2026-08-29、本人の指摘で発覚。当初「楽天カード」という分類名だけで一致判定して
// いたため誤って対象に含めていた）は、みずほ銀行の「楽天カードえみ」明細（恵美様名義の
// 楽天カード、みずほ銀行から引き落とし）とは無関係の別物（journal_classification_map
// 上も「投資」に対応付けられており、他のカード引き落とし行の「－」とは扱いが違う）で、
// 対象に含めてはいけない（2026-08-30、「楽天カード」institutionは「楽天カードえみ」に
// 改名済み。横浜銀行側の「楽天カード」分類は無関係のため改名の対象外）。
// 同様に住友銀行の「住友カード」という類似の分類名も、journal_classification_map
// で「雑費とも仕事」という実支出に対応付けられており、二重計上ではないため対象外。
export const CARD_SETTLEMENT_PAIRS = new Set(['横浜銀行|横浜VISA', '横浜銀行|住友VISA', 'みずほ銀行|楽天カードえみ'])

// 自分名義の別口座・証券口座等への資金移動は、実質的な支出・収入ではないため、
// 「移動を除いた」実質収支を見せる場合に除く（2026-08-29、本人の指示）。
export const TRANSFER_CLASSIFICATION = { '出金': '移動（出金）', '入金': '移動（入金）' }

// 上記2つの除外判定は、必ず「変換前の生の分類１の値」に対して行う（分類２／３に変換した
// 後の値では判定しない）。分類２／３では、カード引き落とし行・移動（出金／入金）に加えて
// ATM・現金出金・Suicaチャージ等、他の複数の分類１の値がjournal_classification_map側で
// 同じ「－」という1つの表示ラベルに集約されてしまうため、変換後の値だけでは区別できない
// （2026-08-29、分類２／３表示時に二重計上が再発する問題として発覚・修正）。

// billing_month（YYYYMM）が属する年度（4月始まり）を返す。1〜3月は前年の年度扱い
export function fiscalYearOf(billingMonth) {
  const year = Number(billingMonth.slice(0, 4))
  const month = Number(billingMonth.slice(4, 6))
  return month >= 4 ? year : year - 1
}

// 1件のjournal_entriesの行が、銀行側のカード引き落とし二重計上として除外対象かどうか。
// institutionFilterが特定の1取引先に絞り込まれている場合は、二重計上が起きないため
// 除外しない（取引先「すべて」表示のときだけ意味を持つ判定）。
export function isCardSettlementDup(institution, rawClassification, institutionFilter) {
  return institutionFilter === 'all' && !!rawClassification && CARD_SETTLEMENT_PAIRS.has(`${institution}|${rawClassification}`)
}

// 1件のjournal_entriesの行が、口座間の資金移動（移動（出金）／移動（入金））かどうか。
export function isTransfer(direction, rawClassification) {
  return rawClassification === TRANSFER_CLASSIFICATION[direction]
}

// entries（journal_entries一覧）から、billing_month単位の「実質的な収支」
// （入金合計－出金合計、カード引き落とし二重計上・口座間移動を除く）を集計する。
// 取引先は常に「すべて」（絞り込み無し）の前提で計算する。
export function computeNetByBillingMonth(entries) {
  const netByMonth = new Map()
  for (const e of entries) {
    if (!e.billing_month) continue
    const rawCls = e.classification
    if (isCardSettlementDup(e.institution, rawCls, 'all')) continue
    if (isTransfer(e.direction, rawCls)) continue
    const amount = Number(e.amount) || 0
    const signed = e.direction === '入金' ? amount : -amount
    netByMonth.set(e.billing_month, (netByMonth.get(e.billing_month) || 0) + signed)
  }
  return netByMonth
}
