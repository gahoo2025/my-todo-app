// 仕訳１（一次仕訳）ルールエンジン
//
// 仕訳ルール_統合版.xlsx（535ルール）のうち、銀行系4取引先（横浜銀行・住友銀行・
// ゆうちょ・みずほ銀行）分（74ルール）を対象とする。カード系（横浜VISA・住友VISA・
// 楽天カード）は未対応（今後のスコープ）。
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

// 摘要1件を分類する。previousClassification は直前行継承ルール用（同一ファイル内、直前の行の確定分類）。
// 戻り値: { status: 'auto'|'review'|'unmatched', classification: string|null, candidates: string[] }
export function classifyDescription(institution, description, previousClassification) {
  const normalizedDesc = normalizeText(description)
  const rules = BANK_RULES.filter(r => r.institution === institution)

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

  const candidates = [...new Set(matched.map(r => r.classification))]
  if (candidates.length > 1 || matched.some(r => r.category === 'review')) {
    return { status: 'review', classification: null, candidates }
  }

  // auto / special はどちらもこのアプリでは自動確定するが、special は要確認フラグを立てる
  return {
    status: 'auto',
    classification: candidates[0],
    candidates,
    needsConfirmation: matched[0].category === 'special',
  }
}
