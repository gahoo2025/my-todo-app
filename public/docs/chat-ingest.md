# 銘柄分析 取り込みAPI（チャット入力用）

資産タブ「個別銘柄」の分析結果を、画面の手入力に加えて **API経由**（Claudeチャットやcurl）で登録するための仕組み。

## 仕組み

- Vercel のサーバーレス関数 `api/stock-analysis.js` を用意
- 強力な `service_role` キーは **サーバー側（Vercel環境変数）にのみ** 保持し、外には出さない
- 呼び出しは共有シークレット `INGEST_TOKEN` で認証
- 登録された分析は通常どおりアプリの資産タブに表示される

## Vercel に設定する環境変数

Vercel → プロジェクト → Settings → Environment Variables に以下を登録（Production / Preview 両方推奨）。

| 変数名 | 値 |
| --- | --- |
| `SUPABASE_URL` | Supabase プロジェクト URL（`VITE_SUPABASE_URL` と同じ値） |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → `service_role` シークレット |
| `INGEST_TOKEN` | 自分で発行した共有シークレット（例: `openssl rand -hex 24`） |
| `INGEST_USER_ID` | 登録先ユーザーの `user_id`（下記参照） |

設定後、再デプロイで反映される。

### `INGEST_USER_ID` の調べ方

Supabase の SQL Editor で:

```sql
select id from auth.users where email = 'あなたのログインメール';
```

または Authentication → Users で対象ユーザーの UID をコピー。

## 使い方

### 登録（POST）

```bash
curl -X POST https://<あなたのドメイン>/api/stock-analysis \
  -H "Authorization: Bearer $INGEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "トヨタ自動車 7203",
    "memo": "## 結論\n割安。\n\n| 指標 | 値 |\n| --- | --- |\n| PER | 10.2 |",
    "analyzed_on": "2026-06-14"
  }'
```

- `title` … 必須（企業名・銘柄コード）
- `memo` … 任意（Markdown / 表対応）
- `analyzed_on` … 任意（`YYYY-MM-DD`。省略時はサーバーの当日）

### 確認（GET）

```bash
curl "https://<あなたのドメイン>/api/stock-analysis?limit=5" \
  -H "Authorization: Bearer $INGEST_TOKEN"
```

## Claudeチャットからの登録

このリポジトリのセッションで分析内容を伝えると、Claude が上記 POST を実行して登録する。
そのためには Claude が `INGEST_TOKEN` とドメインを知っている必要があるため、セッション中にトークンを共有するか、
実行環境のシークレットに `INGEST_TOKEN` を登録しておく。

---

# 資産残高 取り込みAPI（株式・投資信託）

資産タブ上部の「現在の資産額」に表示される残高を登録するAPI。
環境変数・認証は銘柄分析APIと共通（`INGEST_TOKEN` など）。

## 登録（POST）

```bash
curl -X POST https://<あなたのドメイン>/api/asset-balance \
  -H "Authorization: Bearer $INGEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "kind": "stock", "amount": 1234567, "as_of": "2026-07-05" }'
```

- `kind` … `stock`（株式）または `fund`（投資信託）
- `amount` … 資産額（円、数値）
- `as_of` … いつ時点か（`YYYY-MM-DD`。省略時は当日）

同じ kind を新しい `as_of` で登録すると、その値が「現在の資産額」に反映される（履歴も残る）。

## 確認（GET）

```bash
curl "https://<あなたのドメイン>/api/asset-balance?latest=1" \
  -H "Authorization: Bearer $INGEST_TOKEN"
```

---

# 暗号資産価格 取り込みAPI（bitcoin.csv → DB直結）

資産タブ「指標データ」に表示されるビットコイン価格を、`market_index_history`テーブル（symbol='bitcoin'）に**Google Driveを経由せず直接**登録するAPI。環境変数・認証は他のAPIと共通（`INGEST_TOKEN`など）。

これにより、ローカルの`bitcoin-csv-update`スキルが`bitcoin.csv`を更新したあと、「手でGoogle Driveにアップロード→アプリの取り込みボタンを押す」という手動ステップを省略できる。ローカルCLIから直接このAPIをcurlで叩けば、その場でDBに反映される。

## 登録（POST）

```bash
curl -X POST https://<あなたのドメイン>/api/crypto-price \
  -H "Authorization: Bearer $INGEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "bitcoin",
    "points": [
      { "trade_date": "2026-08-12", "value": 64914.7 },
      { "trade_date": "2026-08-13", "value": 65200.0 }
    ]
  }'
```

- `symbol` … 省略時は `bitcoin`（将来他の暗号資産を追加する場合に備えて指定可能にしてある）
- `points` … 必須。`trade_date`（`YYYY-MM-DD`）と`value`（終値、数値）の配列。複数日まとめて送信できる
- 同じ`(symbol, trade_date)`の組み合わせで再送すると、値が上書きされる（当日値の確定前後での再送に対応）

## 確認（GET）

```bash
curl "https://<あなたのドメイン>/api/crypto-price?symbol=bitcoin&limit=5" \
  -H "Authorization: Bearer $INGEST_TOKEN"
```

## bitcoin-csv-updateスキルとの連携

ローカルの`bitcoin-csv-update`スキル（`gahoo-company/.claude/skills/bitcoin-csv-update/`）が、`bitcoin.csv`をローカル更新したあと、その日の差分行を上記APIへPOSTする運用にできる。Google Driveへのミラー更新（既存の手動ドラッグ＆ドロップ）は、バックアップとして引き続き行ってもよいが、**アプリのDBへの反映という目的においては必須ではなくなる**。

**2026-08-12、指標データタブの「取り込む」ボタンからのbitcoin.csv取り込みは廃止した。** 以前は`api/import-market-index.js`がGoogleドライブ上の`bitcoin.csv`を検索・ダウンロードして取り込む処理を持っていたが、上記APIへの直接POSTに一本化したため削除した。「取り込む」ボタンは指標（日経平均・TOPIX・ドル円等）のGoogleスプレッドシート取り込みのみを行う。

---

# 銘柄リスト（3層フレームワーク）同期API（銘柄リスト.csv → DB直結）

資産タブ「銘柄リスト」が使う`stock_master_list`テーブルに、**Google Driveを経由せず直接**登録するAPI。環境変数・認証は他のAPIと共通（`INGEST_TOKEN`など）。

これにより、ローカルの`fundamental-3layer-screening`スキルがスクリーニングを実行したあと、「手でGoogle Driveにアップロード→アプリの取り込みボタンを押す」という手動ステップを省略できる。ローカルCLIから直接このAPIをcurlで叩けば、その場でDBに反映される。

## 登録（POST）

```bash
curl -X POST https://<あなたのドメイン>/api/stock-list-sync \
  -H "Authorization: Bearer $INGEST_TOKEN" \
  -H "Content-Type: application/json" \
  --data @payload.json
```

`payload.json`の例：

```json
{
  "items": [
    {
      "symbol_code": "8951",
      "symbol_name": "日本ビルファンド投資法人",
      "category": "REIT候補",
      "sector": "不動産投資信託",
      "latest_price": 480000,
      "dividend_amount": 12000,
      "dividend_yield": 2.5,
      "layer1_judgement": "81点（80点以上）",
      "layer2_status": "信用倍率3.76倍（過熱水準）",
      "layer2_signal": null,
      "final_judgement": "監視リスト",
      "excluded": null,
      "screened_at": "2026-08-12"
    }
  ],
  "replace": true
}
```

- `items` … 必須。銘柄リスト.csvの1行＝1オブジェクト。`symbol_code`のみ必須、他は省略可（nullになる）
- `replace` … 省略時`true`。`true`の場合、`items`に含まれない既存銘柄（DB上にあるがCSVから消えた行）は削除される（＝銘柄リスト.csv全体を送る運用を想定）。スクリーニング結果の一部銘柄だけを差分更新したい場合は`false`を指定する
- 同じ`symbol_code`の行は上書きされる

## 確認（GET）

```bash
curl "https://<あなたのドメイン>/api/stock-list-sync?limit=10" \
  -H "Authorization: Bearer $INGEST_TOKEN"
```

## fundamental-3layer-screeningスキルとの連携

ローカルの`fundamental-3layer-screening`スキル（`gahoo-company/.claude/skills/fundamental-3layer-screening/`）が、`銘柄リスト.csv`をローカル更新したあと、CSV全行を上記APIへ`items`としてPOSTする運用にできる。Google Driveへのミラー更新（既存の手動ドラッグ＆ドロップ）は、バックアップとして引き続き行ってもよいが、**アプリのDBへの反映という目的においては必須ではなくなる**。

**2026-08-13、資産タブ「銘柄リスト」の「取り込む」ボタン（Google Drive経由）は廃止した。** 以前は`api/import-stock-list.js`がGoogleドライブ上の`銘柄リスト.csv`を検索・ダウンロードして取り込む処理を持っていたが、上記APIへの直接POSTに一本化したため削除した（bitcoin.csvのときと同じ整理）。銘柄リストタブは検索・絞り込み表示のみを行う。

---

# 純資産の長期推移（証券・現金・保険の内訳）同期API

家族の資産管理Excel（証券・現金・保険の内訳を長期間・年次で記録しているもの）を、DBへ直接反映するAPI。個別銘柄の保有履歴（`asset_holdings_history`）・証券会社別合計（`asset_total_history`）とは別に、家族全体の粗い区分・長期推移だけを保存する専用テーブル（`asset_category_history`）を使う。**アプリのUIには現時点では表示しない（DB保存のみ）**。

事前にSupabaseでテーブルを作成する必要がある。手順は`README.md`の「おまけ: 純資産の長期推移（証券・現金・保険の内訳）連携」を参照。

## 登録（POST）

```bash
curl -X POST https://<あなたのドメイン>/api/asset-category-sync \
  -H "Authorization: Bearer $INGEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      { "category": "securities", "as_of": "2025-12-31", "amount": 42104345 },
      { "category": "cash",       "as_of": "2025-12-31", "amount": 7984219 },
      { "category": "insurance",  "as_of": "2025-12-31", "amount": 7977742 }
    ]
  }'
```

- `category` … 必須。`securities`（証券）・`cash`（現金）・`insurance`（保険）のいずれか
- `as_of` … 必須。`YYYY-MM-DD`形式。年次データの場合は`YYYY-12-31`等で表現する
- `amount` … 必須。円単位の数値
- 同じ`(category, as_of)`の組み合わせへの再送は上書きされる

## 確認（GET）

```bash
curl "https://<あなたのドメイン>/api/asset-category-sync?limit=20" \
  -H "Authorization: Bearer $INGEST_TOKEN"
```

`category`パラメータで絞り込みも可能（例：`?category=securities&limit=10`）。

---

# マーケットログ 同期API（日次・週次・月次・年次の実績・見通し）

Claudeチャット（investment部署）で行った株式市場の分析結果（実績・見通し）を、資産タブ「マーケットログ」に直接反映するAPI。`market_log_entries`（実績・見通し本体）・`market_log_stocks`（関連銘柄）・`market_log_todos`（関連TODO）へ書き込む。環境変数・認証は他のAPIと共通（`INGEST_TOKEN`など）。

アプリのUIから手動でテキストを貼り付けて登録する既存の運用（`marketLogParser.js`）と並行して使える。**同じ`entry_at`+`period`の組み合わせで既にエントリが存在する場合は上書き（actual/outlook/raw_textを更新、stocks/todosは全入れ替え）する。存在しなければ新規作成する**（2026-08-14、upsert方式に変更。以前は呼ぶたびに新規作成だったため、送信失敗時の再送信で重複登録される事例があった）。同じ日に複数回チェックする場合は`entry_at`を分けるか、最新の内容で上書きされる前提で運用する。削除は引き続きアプリのUIから行う。

## 登録（POST）

```bash
curl -X POST https://<あなたのドメイン>/api/market-log-sync \
  -H "Authorization: Bearer $INGEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "period": "daily",
    "entry_at": "2026-08-13",
    "actual": "日経平均は前日比+320円の反発。半導体関連が牽引。",
    "outlook": "短期的には様子見。米CPI発表待ちのレンジ推移を想定。",
    "stocks": [
      { "block": "actual", "name": "東京エレクトロン", "code": "8035" }
    ],
    "todos": [
      { "content": "米CPI発表後の反応を確認する", "done": false }
    ]
  }'
```

- `period` … 省略時`daily`。`daily`/`weekly`/`monthly`/`yearly`のいずれか
- `entry_at` … 省略時はサーバーの現在時刻。分析対象の日時（`YYYY-MM-DD`等）
- `actual` … 実績のまとめ（Markdown可）。`outlook`とどちらか必須
- `outlook` … 見通しのまとめ（Markdown可）。`actual`とどちらか必須
- `raw_text` … 任意。分析の元テキスト全文
- `stocks` … 任意。関連銘柄の配列（`block`・`name`・`code`・`score`）。**`block`は`'actual'`または`'outlook'`のいずれか固定値**（DBのCHECK制約で強制。「上昇/下落」等の自由な評価ラベルではなく、実績側の銘柄か見通し側の銘柄かを示す）
- `todos` … 任意。関連TODOの配列（`content`・`done`）

## 確認（GET）

```bash
curl "https://<あなたのドメイン>/api/market-log-sync?limit=10" \
  -H "Authorization: Bearer $INGEST_TOKEN"
```
