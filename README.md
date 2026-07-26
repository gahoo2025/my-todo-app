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
