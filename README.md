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
