# My Todo App

カテゴリと期限付きタスク管理 PWA アプリ

## おまけ：パックマン 🟡

`public/pacman.html` に、依存なし・ログイン不要で遊べるパックマンを同梱しています。

- 開発サーバー起動後に `http://localhost:5173/pacman.html` を開く
- もしくは `public/pacman.html` をブラウザで直接開くだけでもプレイ可能
- 操作：矢印キー / WASD / スワイプ・画面下のボタン（モバイル）
- 4体のゴースト（追跡・待ち伏せAI）、パワーエサでの反撃、スコア・残機・レベルあり

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
