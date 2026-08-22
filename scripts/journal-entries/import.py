#!/usr/bin/env python3
"""
journal_entries 移行スクリプト（2/2: 投入）

transform.py が出力したJSON（過去の仕訳結果）を、Supabaseの journal_entries テーブルへ
バッチでupsertする。`service_role`キーを使ったサーバーサイド接続のため、RLSはバイパスされる。

事前準備：
  1. Supabase側で journal_entries / journal_classification_map テーブルを作成しておくこと
     （DDLは product/journal-entries-db-design.md 参照。既に作成済みなら不要）
  2. 環境変数を設定：
       SUPABASE_URL              例: https://xxxx.supabase.co
       SUPABASE_SERVICE_ROLE_KEY Supabaseの service_role キー（絶対に公開しないこと）
       INGEST_USER_ID             取り込み先のuser_id（uuid）

使い方:
  python3 transform.py /path/to/仕訳１を行ったリスト.xlsx journal_entries.json
  python3 import.py journal_entries.json

冪等性：(user_id, source_sheet, source_row) のunique制約で重複投入を防ぐ
（on_conflict=user_id,source_sheet,source_row で upsert するため、同じファイルを何度流しても安全）。
"""
import sys
import os
import json
import urllib.request
import urllib.error


def get_env():
    url = os.environ.get('SUPABASE_URL')
    service_key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
    user_id = os.environ.get('INGEST_USER_ID')
    missing = [k for k, v in [('SUPABASE_URL', url), ('SUPABASE_SERVICE_ROLE_KEY', service_key),
                               ('INGEST_USER_ID', user_id)] if not v]
    if missing:
        print(f'環境変数が未設定です: {", ".join(missing)}', file=sys.stderr)
        sys.exit(1)
    return url.rstrip('/'), service_key, user_id


def post_batch(url, service_key, table, rows, on_conflict):
    endpoint = f'{url}/rest/v1/{table}?on_conflict={on_conflict}'
    body = json.dumps(rows).encode('utf-8')
    req = urllib.request.Request(endpoint, data=body, method='POST', headers={
        'apikey': service_key,
        'Authorization': f'Bearer {service_key}',
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=minimal',
    })
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status
    except urllib.error.HTTPError as e:
        print(f'エラー ({e.code}): {e.read().decode("utf-8")}', file=sys.stderr)
        raise


def main():
    if len(sys.argv) < 2:
        print('使い方: python3 import.py <jsonファイル> [--table journal_entries|journal_classification_map] [--batch-size N]', file=sys.stderr)
        sys.exit(1)
    in_path = sys.argv[1]
    table = 'journal_entries'
    if '--table' in sys.argv:
        table = sys.argv[sys.argv.index('--table') + 1]
    batch_size = 300
    if '--batch-size' in sys.argv:
        batch_size = int(sys.argv[sys.argv.index('--batch-size') + 1])

    url, service_key, user_id = get_env()

    entries = json.load(open(in_path, encoding='utf-8'))

    if table == 'journal_entries':
        import_batch_id = __import__('uuid').uuid4().hex
        rows = [{
            'user_id': user_id,
            'institution': e['institution'],
            'card_holder': e['card_holder'],
            'transaction_date': e['transaction_date'],
            'billing_month': e['billing_month'],
            'description': e['description'],
            'direction': e['direction'],
            'amount': e['amount'],
            'balance': e['balance'],
            'classification': e['classification'],
            'memo': e['memo'],
            'raw_detail': e['raw_detail'],
            'source_file': '仕訳１を行ったリスト.xlsx',
            'source_sheet': e['source_sheet'],
            'source_row': e['source_row'],
            'import_batch_id': import_batch_id,
        } for e in entries]
        on_conflict = 'user_id,source_sheet,source_row'
    elif table == 'journal_classification_map':
        rows = [{
            'user_id': user_id,
            'institution_or_group': e['institution_or_group'],
            'classification_1': e['classification_1'],
            'classification_2': e['classification_2'],
            'classification_3': e['classification_3'],
            'cashflow_direction': e['cashflow_direction'],
            'related_group': e['related_group'],
            'status': e['status'],
            'note': e['note'],
        } for e in entries]
        on_conflict = 'user_id,institution_or_group,classification_1'
    else:
        print(f'未対応のテーブルです: {table}', file=sys.stderr)
        sys.exit(1)

    total = len(rows)
    print(f'{table} へ {total}件を投入します（バッチサイズ={batch_size}）')
    for i in range(0, total, batch_size):
        batch = rows[i:i + batch_size]
        status = post_batch(url, service_key, table, batch, on_conflict=on_conflict)
        print(f'  {i + len(batch)}/{total} 件目まで投入完了 (status={status})')

    print('完了。件数確認は下記SQLをSupabase側で実行してください：')
    print(f"  select count(*) from {table};")


if __name__ == '__main__':
    main()
