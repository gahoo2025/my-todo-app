# My Todo App

カテゴリと期限付きタスク管理 PWA アプリ

## 技術スタック

- React 19 + Vite
- Supabase（認証 + データベース）
- Tailwind CSS v4
- PWA対応（vite-plugin-pwa）

## セットアップ

1. 依存関係のインストール
   ```bash
   npm install
   ```

2. 環境変数の設定
   ```bash
   cp .env.example .env
   # .env を編集して Supabase の URL と ANON_KEY を設定
   ```

3. Supabase でテーブルを作成（SQL エディタで実行）
   ```sql
   create table tasks (
     id uuid default gen_random_uuid() primary key,
     user_id uuid references auth.users not null,
     title text not null,
     category text not null default 'その他',
     due_date date,
     completed boolean not null default false,
     created_at timestamptz default now()
   );

   alter table tasks enable row level security;

   create policy "Users can manage their own tasks"
     on tasks for all
     using (auth.uid() = user_id);
   ```

4. 開発サーバー起動
   ```bash
   npm run dev
   ```

## おまけ: 家族の資産集計連携

ローカルで動く別アプリ「資産管理アプリ」から、純資産合計・家族毎の内訳のみを連携して「資産」タブに表示できます（保有銘柄などの詳細は連携しません）。利用するにはSupabaseで以下のテーブルを作成してください。

```sql
create table asset_summary (
  user_id uuid primary key references auth.users,
  total numeric not null,
  by_person jsonb not null,
  by_person_asset jsonb,
  updated_at timestamptz not null default now()
);

alter table asset_summary enable row level security;

create policy "Users can view their own asset summary"
  on asset_summary for select
  using (auth.uid() = user_id);
```

このテーブルへの書き込みは資産管理アプリ側（`service_role`キーを使ったサーバーサイド連携）で行うため、このアプリ側にはINSERT/UPDATE用のポリシーは不要です。

`by_person_asset` は後から追加した列です。すでに `asset_summary` テーブルを作成済みの場合は、以下を実行してください。

```sql
alter table asset_summary add column by_person_asset jsonb;
```

## おまけ: 純資産の長期推移（証券・現金・保険の内訳）連携

ローカルの資産管理Excel（証券・現金・保険の内訳を長期間にわたって年次で記録しているもの）を、`api/asset-category-sync.js`（INGEST_TOKEN方式）経由でDBに反映できます。個別銘柄の保有履歴（`asset_holdings_history`）や証券会社別合計（`asset_total_history`）とは別に、家族全体の粗い区分・長期推移を保存する専用テーブルです。利用するにはSupabaseで以下のテーブルを作成してください。

```sql
create table asset_category_history (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users,
  category text not null check (category in ('securities','cash','insurance')),
  as_of date not null,
  amount numeric not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, category, as_of)
);

alter table asset_category_history enable row level security;

create policy "Users can view their own asset category history"
  on asset_category_history for select
  using (auth.uid() = user_id);
```

## おまけ: メモにURL欄を追加

メモ（`notes`テーブル）にタイトル・本文とは別のURL専用欄を追加しました。既存の`notes`テーブルには`url`列が無いため、Supabaseで以下を実行してください。

```sql
alter table notes add column url text;
```

書き込みは`service_role`キーを使ったサーバーサイド連携（`api/asset-category-sync.js`）で行うため、INSERT/UPDATE用のポリシーは不要です。使い方の詳細は`public/docs/chat-ingest.md`を参照してください。

## おまけ: 家計簿の仕訳結果（journal_entries）

横浜銀行・住友銀行・ゆうちょ・みずほ銀行・横浜VISA・住友VISA・楽天カードの過去の取引明細（分類済み）を保存するテーブルです。設計の詳細は`gahoo-company`リポジトリの`product/journal-entries-db-design.md`を参照してください。利用するにはSupabaseで以下のテーブルを作成してください（**2026-08-22時点、本番プロジェクトには適用済み**）。

```sql
create table journal_entries (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users,

  institution text not null check (institution in (
    '横浜銀行', '住友銀行', 'ゆうちょ', 'みずほ銀行',
    '横浜VISA', '住友VISA', '楽天カード'
  )),
  card_holder text check (card_holder in ('智広', '恵美')),

  transaction_date date not null,
  billing_month text,

  description text not null,
  direction text not null check (direction in ('入金', '出金')),
  amount numeric not null check (amount >= 0),
  balance numeric,

  classification text,
  classification_source text not null default 'historical_import'
    check (classification_source in ('historical_import', 'rule_auto', 'manual')),

  memo text,
  raw_detail jsonb,

  source_file text not null default '仕訳１を行ったリスト.xlsx',
  source_sheet text not null,
  source_row int,
  import_batch_id uuid,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (user_id, source_sheet, source_row)
);

create index journal_entries_lookup_idx on journal_entries (user_id, institution, transaction_date);
create index journal_entries_classification_idx on journal_entries (user_id, classification);

alter table journal_entries enable row level security;

create policy "Users can view their own journal entries"
  on journal_entries for select
  using (auth.uid() = user_id);

create table journal_classification_map (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users,

  institution_or_group text not null,
  classification_1 text not null,
  classification_2 text not null,
  classification_3 text not null,
  cashflow_direction text not null check (cashflow_direction in ('入金', '出金')),
  related_group text,
  status text not null default '既存' check (status in ('既存', '新規')),
  note text,

  created_at timestamptz not null default now(),

  unique (user_id, institution_or_group, classification_1)
);

alter table journal_classification_map enable row level security;

create policy "Users can view their own classification map"
  on journal_classification_map for select
  using (auth.uid() = user_id);
```

### 過去データの移行手順

書き込みは`service_role`キーを使ったローカル実行スクリプト（`scripts/journal-entries/`）で行います。ローカルのExcel（`仕訳１を行ったリスト.xlsx`）を直接読み込むため、家計取引データがこのリポジトリにコミットされることはありません。

```bash
cd scripts/journal-entries
pip install openpyxl

export SUPABASE_URL=https://xxxx.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=xxxxx   # Supabaseの service_role キー（絶対に公開しないこと）
export INGEST_USER_ID=xxxxxxxx-xxxx-...  # 取り込み先のuser_id

# 1) 過去の仕訳結果（journal_entries）
python3 transform.py /path/to/仕訳１を行ったリスト.xlsx journal_entries.json
python3 import.py journal_entries.json

# 2) 分類1→2→3の展開ルール（journal_classification_map）
python3 transform_classification_map.py /path/to/仕訳１を行ったリスト.xlsx journal_classification_map.json
python3 import.py journal_classification_map.json --table journal_classification_map
```

`(user_id, source_sheet, source_row)` のunique制約でupsertするため、同じファイルを何度流しても重複投入されません。**2026-08-22時点、パイプラインの正しさは横浜銀行の実データ100件で検証済み**（日付の年推定・住友VISAのカード名義ヘッダー機構・みずほ銀行の列レイアウトの揺れ等、変換ロジックの詳細はスクリプト内コメントと`journal-entries-db-design.md`を参照）。残りのデータの投入は、Supabase認証情報を持つ環境（ローカルCLI等）で上記コマンドを実行してください。

## おまけ: テトリス 🎮

ログイン不要で遊べるテトリスを同梱しています。依存ライブラリゼロの自己完結型 HTML（Canvas + 純粋 JS）です。

- 開発サーバー起動後: `http://localhost:5173/tetris.html`
- ビルド後: `dist/tetris.html`

### 操作方法

| キー | 動作 |
| --- | --- |
| `←` `→` | 左右移動 |
| `↑` / `X` | 右回転（`Z` で左回転） |
| `↓` | ソフトドロップ |
| `Space` | ハードドロップ |
| `C` / `Shift` | ホールド |
| `P` | ポーズ |

スマホではタッチボタン、または盤面のスワイプ（左右=移動 / 下=落下 / タップ=回転）に対応しています。
7-bag によるピース抽選、SRS 準拠の壁蹴り回転、ゴースト表示、ネクスト/ホールド、レベルに応じた落下速度アップを実装しています。
