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
