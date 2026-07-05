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
