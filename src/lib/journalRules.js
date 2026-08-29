// 仕訳１（一次仕訳）ルールエンジン
//
// 仕訳ルール_統合版.xlsx（535ルール）のうち、銀行系4取引先（横浜銀行・住友銀行・
// ゆうちょ・みずほ銀行、74ルール）＋カード系3取引先（住友VISA・横浜VISA・楽天カード、
// 437ルール）を対象とする。
//
// 自動仕訳区分：
//   auto    … ルール条件だけで一意に分類が決まる。完全自動で確定してよい。
//   special … 自動分類できるが、性質上まだ人間の目を通したい取引。自動分類した上で
//             「確認待ち」の1件として提示する（このアプリでは review と同様、
//             確認キューに積む簡易実装としている）。
//   review  … 摘要文字列だけでは分類先が一意に決まらない（候補が複数ある）。
//             自動確定せず、候補一覧を提示して人間に選ばせる。
//
// 正規化ルール（元Excelの設計方針どおり）：
//   ・半角スペース・全角スペースをすべて除去
//   ・長音符・ダッシュ系の文字（ー／－／-／−／ｰ／‐）をすべて「ー」に統一

import CARD_RULES_DATA from './cardRulesData.json'

export const BANK_RULES = [
  { institution: '横浜銀行', classification: 'ATM', method: 'prefix', pattern: 'ｼﾞﾄﾞｳｷ*', category: 'auto' },
  { institution: '横浜銀行', classification: 'ATM', method: 'exact', pattern: 'ｾﾌﾞﾝ(ｾﾌﾞﾝBK)', category: 'auto' },
  { institution: '横浜銀行', classification: 'ATM', method: 'exact', pattern: 'ﾃｽｳﾘﾖｳ(ｾﾌﾞﾝBK)', category: 'auto' },
  { institution: '横浜銀行', classification: '横浜VISA', method: 'exact', pattern: 'BC', category: 'auto' },
  { institution: '横浜銀行', classification: '楽天カード', method: 'wildcard', pattern: 'ｸﾚｼﾞﾂﾄ*ﾗｸﾃﾝｶーﾄﾞｻーﾋﾞｽ', category: 'auto' },
  { institution: '横浜銀行', classification: '住友VISA', method: 'wildcard', pattern: 'ｸﾚｼﾞﾂﾄ*ﾐﾂｲｽﾐﾄﾓｶーﾄﾞ(ｶ', category: 'auto' },
  { institution: '横浜銀行', classification: '電気', method: 'prefix', pattern: '電気料*', category: 'auto' },
  { institution: '横浜銀行', classification: '水道', method: 'prefix', pattern: '水道料*', category: 'auto' },
  { institution: '横浜銀行', classification: '住宅ローン', method: 'exact', pattern: 'ｺﾞﾍﾝｻｲ', category: 'auto' },
  { institution: '横浜銀行', classification: '保険', method: 'exact', pattern: 'ｺｳｻﾞﾌﾘｶｴﾒﾂﾄﾗｲﾌｾｲﾒｲﾎｹﾝ', category: 'auto' },
  { institution: '横浜銀行', classification: '塾', method: 'exact', pattern: 'ｺｳｻﾞﾌﾘｶｴSMBC(ｶ)ﾘﾝｶｲ', category: 'auto' },
  { institution: '横浜銀行', classification: 'スイミング', method: 'exact', pattern: 'ｺｳｻﾞﾌﾘｶｴｾﾝﾄﾗﾙｽﾎﾟーﾂ', category: 'auto' },
  { institution: '横浜銀行', classification: 'テニス', method: 'exact', pattern: 'ｺｳｻﾞﾌﾘｶｴﾀﾁﾊﾞﾅﾃﾆｽ(SMCC', category: 'auto' },
  { institution: '横浜銀行', classification: '給与', method: 'prefix', pattern: 'ｷﾕｳﾘﾖｳ*', category: 'auto' },
  { institution: '横浜銀行', classification: '賞与', method: 'prefix', pattern: 'ｼﾖｳﾖ*', category: 'auto' },
  { institution: '横浜銀行', classification: '電気購入', method: 'exact', pattern: 'ﾄｳﾃﾞﾝｺｳﾆﾕｳ', category: 'auto' },
  { institution: '横浜銀行', classification: '電気購入', method: 'exact', pattern: 'ｶ)ｴﾈｸｽﾗｲﾌｻー', category: 'auto' },
  { institution: '横浜銀行', classification: '利息', method: 'exact', pattern: 'ｵﾘｿｸ', category: 'auto' },
  { institution: '横浜銀行', classification: '移動（出金）', method: 'wildcard', pattern: 'ｲﾝﾀーﾈﾂﾄ*ｺｾﾑﾗﾄﾓﾋﾛ', category: 'auto' },
  { institution: '横浜銀行', classification: '移動（出金）', method: 'wildcard', pattern: 'ｲﾝﾀーﾈﾂﾄ*ｶ)ﾋﾞﾂﾄﾌﾗｲﾔー', category: 'auto' },
  { institution: '横浜銀行', classification: '移動（入金）', method: 'exact', pattern: 'ｺｾﾑﾗﾄﾓﾋﾛ', category: 'auto' },
  { institution: '横浜銀行', classification: '車購入', method: 'wildcard', pattern: 'ｸﾚｼﾞﾂﾄ*ﾆﾂｻﾝﾌｲﾅﾝｼﾔﾙS', category: 'special' },
  { institution: '横浜銀行', classification: '固定資産税', method: 'exact', pattern: 'PAYBﾊﾞﾗｲ(364)', category: 'special' },
  { institution: '横浜銀行', classification: '家メンテナンス', method: 'exact', pattern: 'ｲﾝﾀーﾈﾂﾄｶ)ｼｴｱﾃﾂｸ', category: 'special' },
  { institution: '横浜銀行', classification: 'その他入金', method: 'exact', pattern: 'SBIｿﾝﾎﾟ(ｿﾝｶﾞｲｻーﾋﾞｽｾﾝﾀー)', category: 'special' },
  { institution: '横浜銀行', classification: 'その他入金', method: 'prefix', pattern: 'ﾂﾙﾐｾﾞｲﾑｼﾖ*', category: 'special' },
  { institution: '住友銀行', classification: '給与', method: 'exact', pattern: '給料振込ｶ)NTTﾃﾞーﾀMSE', category: 'auto' },
  { institution: '住友銀行', classification: '振込', method: 'exact', pattern: '振込ｶ)ｴﾇﾃｲﾃｲﾃﾞーﾀｴﾑｴｽｲー', category: 'auto' },
  { institution: '住友銀行', classification: '住友カード', method: 'exact', pattern: 'ﾐﾂｲｽﾐﾄﾓｶーﾄﾞ(ｶ', category: 'auto' },
  { institution: '住友銀行', classification: 'PayPay', method: 'exact', pattern: 'JD/ﾃﾞｲﾊﾞﾗｲ', category: 'special' },
  { institution: '住友銀行', classification: 'PayPay', method: 'exact', pattern: 'PAYPAY', category: 'review' },
  { institution: '住友銀行', classification: 'PayPay', method: 'exact', pattern: 'ﾍﾟｲﾍﾟｲ', category: 'review' },
  { institution: '住友銀行', classification: '固定資産税', method: 'exact', pattern: 'ﾍﾟｲﾍﾟｲ', category: 'review' },
  { institution: '住友銀行', classification: '固定資産税', method: 'exact', pattern: 'ﾗｲﾝﾍﾟｲ(ｶ', category: 'review' },
  { institution: '住友銀行', classification: '自動車税', method: 'exact', pattern: 'ﾗｲﾝﾍﾟｲ(ｶ', category: 'review' },
  { institution: '住友銀行', classification: '自動車税', method: 'exact', pattern: 'ﾍﾟｲﾍﾟｲ', category: 'review' },
  { institution: '住友銀行', classification: '自動車税', method: 'exact', pattern: 'PAYPAY', category: 'review' },
  { institution: '住友銀行', classification: '修学旅行', method: 'exact', pattern: 'PAYPAY', category: 'review' },
  { institution: '住友銀行', classification: '外食いえ', method: 'exact', pattern: 'PAYPAY', category: 'review' },
  { institution: '住友銀行', classification: '現金出金', method: 'prefix', pattern: 'カードｾﾌﾞﾝBK*', category: 'auto' },
  { institution: '住友銀行', classification: '現金出金', method: 'prefix', pattern: 'カードﾕｳﾁﾖ*', category: 'auto' },
  { institution: '住友銀行', classification: '現金出金', method: 'exact', pattern: 'カード手数料', category: 'auto' },
  { institution: '住友銀行', classification: '利息', method: 'exact', pattern: '普通預金利息', category: 'auto' },
  { institution: '住友銀行', classification: '移動（出金）', method: 'prefix', pattern: 'パソコン振込*', category: 'auto' },
  { institution: '住友銀行', classification: 'その他入金', method: 'prefix', pattern: '振込サービス*', category: 'special' },
  { institution: '住友銀行', classification: 'その他入金', method: 'exact', pattern: '振込ｺｳｼｷｻｲﾄﾀｶﾗｸｼﾞﾄｳｾﾝｷﾝ', category: 'auto' },
  { institution: 'ゆうちょ', classification: '給食', method: 'exact', pattern: '自払/横浜市学校給食', category: 'auto' },
  { institution: 'ゆうちょ', classification: '小学校', method: 'exact', pattern: '授業/獅子ヶ谷小', category: 'auto' },
  { institution: 'ゆうちょ', classification: '小学校', method: 'exact', pattern: '送金/横浜市立獅子ケ谷', category: 'auto' },
  { institution: 'ゆうちょ', classification: '小学校', method: 'exact', pattern: '送金/横浜市立獅子ヶ谷', category: 'auto' },
  { institution: 'ゆうちょ', classification: '学童', method: 'exact', pattern: '自払/第二ひばりの子', category: 'auto' },
  { institution: 'ゆうちょ', classification: '塾', method: 'exact', pattern: '自払/ｶ)ﾘﾝｶｲ', category: 'auto' },
  { institution: 'ゆうちょ', classification: '空手', method: 'exact', pattern: '送金/三澤透', category: 'auto' },
  { institution: 'ゆうちょ', classification: '空手', method: 'exact', pattern: '送金/一般社団法人全', category: 'auto' },
  { institution: 'ゆうちょ', classification: '児童手当', method: 'exact', pattern: '振込/ﾖｺﾊﾏｼｼﾞﾄﾞｳﾃｱﾃ', category: 'auto' },
  { institution: 'ゆうちょ', classification: '児童手当', method: 'exact', pattern: '振込/ﾖｺﾊﾏﾌﾞﾂｶﾀﾞｶﾃｱ', category: 'special' },
  { institution: 'ゆうちょ', classification: '移動（入金）', method: 'exact', pattern: '振込/ｺｾﾑﾗﾄﾓﾋﾛ', category: 'auto' },
  { institution: 'ゆうちょ', classification: '移動（入金）', method: 'exact', pattern: 'カード', category: 'review' },
  { institution: 'ゆうちょ', classification: '現金入金', method: 'exact', pattern: 'カード', category: 'review' },
  { institution: 'ゆうちょ', classification: '移動（出金）', method: 'exact', pattern: 'カード', category: 'review' },
  { institution: 'ゆうちょ', classification: '移動（出金）', method: 'exact', pattern: '送金/楽天証券株式会社', category: 'auto' },
  { institution: 'ゆうちょ', classification: '利息', method: 'exact', pattern: '受取利子', category: 'auto' },
  { institution: 'ゆうちょ', classification: '利息', method: 'exact', pattern: '利子', category: 'auto' },
  { institution: 'ゆうちょ', classification: '税金', method: 'exact', pattern: '税金', category: 'auto' },
  { institution: 'みずほ銀行', classification: '楽天カード', method: 'exact', pattern: 'ラクテンカードサービス', category: 'auto' },
  { institution: 'みずほ銀行', classification: 'PayPay', method: 'exact', pattern: 'ＰＡＹＰＡＹ', category: 'auto' },
  { institution: 'みずほ銀行', classification: 'PayPay', method: 'exact', pattern: 'ペイペイ', category: 'auto' },
  { institution: 'みずほ銀行', classification: 'LinePay', method: 'exact', pattern: 'ラインペイ（カ', category: 'auto' },
  { institution: 'みずほ銀行', classification: '給与', method: 'exact', pattern: '給与', category: 'auto' },
  { institution: 'みずほ銀行', classification: '移動（出金）', method: 'exact', pattern: 'ラクテンシヨウケン（カ', category: 'auto' },
  { institution: 'みずほ銀行', classification: '利息', method: 'exact', pattern: '利息', category: 'auto' },
  { institution: 'みずほ銀行', classification: '現金入金', method: 'exact', pattern: 'ＡＴＭ（３５９）', category: 'review' },
  { institution: 'みずほ銀行', classification: '米', method: 'exact', pattern: 'ネツトササキハルオ', category: 'special' },
  { institution: 'ゆうちょ', classification: '（直前行と同じ）', method: 'inherit', pattern: '料金', category: 'auto' },
]

// カード系（住友VISA・横浜VISA・楽天カード）ルール（CARD_RULES_DATA）は、カード名義
// ヘッダー方式（住友VISAの智広様／恵美様の切替）に対応するため、holder制約
// （'智広'|'恵美'|null）付きで持つ。「日付で判断」区分（利用日・区間等の文脈情報が
// 必要なもの、22ルール）は自動判定できないため未収録＝該当摘要は既定ルールがあれば
// そちらが適用され、無ければ確認要（候補提示）に回る。

const ALL_RULES = [
  ...BANK_RULES.map(r => ({ ...r, holder: null })),
  ...CARD_RULES_DATA,
]

const DASH_CHARS = /[ー－\-−ｰ‐]/g

// 摘要・条件文字列の正規化：半角/全角スペース除去 + 長音符・ダッシュ類を「ー」に統一
export function normalizeText(text) {
  if (text == null) return ''
  return String(text).replace(/[ 　]/g, '').replace(DASH_CHARS, 'ー')
}

function wildcardToRegExp(pattern) {
  const escaped = pattern
    .split('*')
    .map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*')
  return new RegExp(`^${escaped}$`)
}

function matchesRule(rule, normalizedDesc) {
  const pattern = normalizeText(rule.pattern)
  if (rule.method === 'exact') return normalizedDesc === pattern
  if (rule.method === 'prefix' || rule.method === 'wildcard') {
    return wildcardToRegExp(pattern).test(normalizedDesc)
  }
  return false
}

// 実取引ではない行（カード名義ヘッダー行の表記ゆれ・海外利用の換算レート注記行など）を示す分類
function isNonTransactionMarker(classification) {
  return classification === '－' || classification === 'ー' || classification.includes('非仕訳対象')
}

// 摘要1件を分類する。
//   previousClassification … 直前行継承ルール用（同一ファイル内、直前の行の確定分類）
//   holder                 … カード名義ヘッダーの状態（住友VISA用。'智広'|'恵美'|null）
// 戻り値: { status: 'auto'|'review'|'unmatched'|'exclude', classification: string|null, candidates: string[] }
export function classifyDescription(institution, description, { previousClassification, holder } = {}) {
  const normalizedDesc = normalizeText(description)
  const rules = ALL_RULES.filter(r => r.institution === institution && (r.holder == null || r.holder === holder))

  const inheritRule = rules.find(r => r.method === 'inherit' && normalizeText(r.pattern) === normalizedDesc)
  if (inheritRule) {
    return {
      status: previousClassification ? 'auto' : 'review',
      classification: previousClassification || null,
      candidates: previousClassification ? [previousClassification] : [],
    }
  }

  const matched = rules.filter(r => r.method !== 'inherit' && matchesRule(r, normalizedDesc))
  if (matched.length === 0) {
    return { status: 'unmatched', classification: null, candidates: [] }
  }

  // 分類欄に「Ａ／Ｂ／Ｃ」のように複数候補が1行にまとめられているケースを展開する
  const candidates = [...new Set(matched.flatMap(r => r.classification.split('／')))]
  if (candidates.length > 1 || matched.some(r => r.category === 'review')) {
    return { status: 'review', classification: null, candidates }
  }

  if (isNonTransactionMarker(candidates[0])) {
    return { status: 'exclude', classification: candidates[0], candidates: [] }
  }

  // auto / special はどちらもこのアプリでは自動確定するが、special は要確認フラグを立てる
  return {
    status: 'auto',
    classification: candidates[0],
    candidates,
    needsConfirmation: matched[0].category === 'special',
  }
}

// 全ルールに登場する分類の一覧（未マッチ行の手動選択肢用）。非取引マーカーは除外する。
export const ALL_CLASSIFICATIONS = [...new Set(
  ALL_RULES
    .filter(r => r.method !== 'inherit')
    .flatMap(r => r.classification.split('／'))
    .filter(c => !isNonTransactionMarker(c))
)].sort()

// ── 娯楽期間による分類上書き ─────────────────────────────────────────
//
// 元のExcel（仕訳１を行ったリスト.xlsx）では、店名パターンだけでなく「旅行・イベントの
// 期間かどうか」で分類を上書きしていた（例：横浜VISAの「ＥＴＣ首都高」は通常「ETC」だが、
// 旅行期間中の同じ摘要は「ETC娯楽」。住友VISAでは「セブン－イレブン」等の日用品店も、
// 旅行期間中は「イベント」に上書きされている）。しかし店名パターンのみで判定するこの
// ルールエンジンには、この「期間による上書き」が実装されていなかった（2026-08-29、
// GW旅行のETC明細が「娯楽」にならなかった件で発覚。過去分は本番DBを手動修正済み）。
//
// 今後の取り込みで同じ漏れが起きないよう、ここに旅行・イベントの期間を追記していくと、
// classifyDescriptionの結果に対して自動で上書きが適用される（BankStatementImport経由の
// 新規取り込み時のみ。既にDBに入っている過去データは対象外＝手動修正が必要）。
//
// 使い方：旅行等が終わったら、以下の配列に1件追記する。
//   { name: '説明（任意）', dateFrom: 'YYYY-MM-DD', dateTo: 'YYYY-MM-DD',
//     overrides: { 取引先名: '上書き後の分類', ... } }
// overridesに列挙されていない取引先はこの期間の対象外（上書きしない）。
//
// 過去分（本番DBは手動修正済み）も、期間の記録として・将来同じデータが再取り込みされた
// 場合の一貫性のためにここへ登録しておく。
export const LEISURE_PERIODS = [
  { name: '2026年GW岡山旅行', dateFrom: '2026-05-03', dateTo: '2026-05-06',
    overrides: { '横浜VISA': 'ETC娯楽', '住友VISA': 'イベント' } },
  { name: '2026年5月 ソレイユの丘（三浦半島）お出かけ', dateFrom: '2026-05-17', dateTo: '2026-05-17',
    overrides: { '横浜VISA': 'ETC娯楽', '住友VISA': 'イベント' } },
]

// 期間による上書きの対象外とする分類（給与・固定費・ローン・保険・習い事の月謝など、
// 旅行期間中であっても旅行とは無関係に発生する定期的な取引は上書きしない）。
// 2026-08-29時点の実データ観察（同じ旅行期間中でも Amazon Downloads のサブスク課金や
// 自宅近くの日用品店は「イベント」に上書きされていなかった）に基づく。
const LEISURE_OVERRIDE_EXEMPT = new Set([
  '給与', '賞与', '住宅ローン', '保険', '地震保険', '自動車保険', 'NHK', '携帯電話',
  '電気', '電気購入', '水道', 'ガス', '浄水', '学童', '塾', 'スイミング', 'テニス',
  '空手', '習字', '習い事', 'ピアノ', '児童手当', '利息', '税金', '固定資産税', '自動車税',
  '移動（出金）', '移動（入金）', 'サブスク', '車購入', '車メンテ', '車検', '矯正歯科',
  '現金出金', '現金入金', 'ATM', '見守り',
])

// classifyDescriptionの結果に、娯楽期間による上書きを適用する。
//   institution      … 取引先名
//   transactionDate  … 'YYYY-MM-DD'（利用日。billing_monthではなく実際の取引日で判定する）
//   result           … classifyDescriptionの戻り値
// 戻り値: 上書き後の結果（元のresultと同じ形。対象外なら引数のresultをそのまま返す）
export function applyLeisurePeriodOverride(institution, transactionDate, result) {
  if (!transactionDate || result.status === 'exclude') return result
  const period = LEISURE_PERIODS.find(p =>
    transactionDate >= p.dateFrom && transactionDate <= p.dateTo && p.overrides[institution]
  )
  if (!period) return result
  if (result.classification && LEISURE_OVERRIDE_EXEMPT.has(result.classification)) return result

  const overrideClassification = period.overrides[institution]
  return {
    status: 'auto',
    classification: overrideClassification,
    candidates: [overrideClassification],
    needsConfirmation: false,
  }
}
