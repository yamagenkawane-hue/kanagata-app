# Supabase 接続手順

プロジェクト: https://mtpztsbcwcywcmlhwkzx.supabase.co

1. `.env.local`のURLとPublishable keyは設定済み。内容をGitやチャットへ出力しない。
2. 開発サーバーを再起動する。
3. SupabaseのSQL Editorで`supabase/migrations/202609300001_initial_schema.sql`を実行する。初回専用で既存テーブルは変更・削除しない。まだリモート適用・SQL実行検証はしていない。
4. AuthenticationのUsers画面で利用者のメールアカウントを登録する。メールの送信・招待を行う場合は管理者が実行する。
5. 作成されたAuth UserのUUIDを使い、SQL Editorでprofilesへdisplay_name、role（admin/operator）を登録する。SQL末尾にコメント例あり。
6. `/login`からメール・パスワードでログインし、`/workspace`で認証と業務アカウントの確認を行う。

秘密鍵・DBパスワードはチャットやGitへ載せない。公開の新規登録画面は作成していない。
Supabase Auth側の公開新規登録可否は、社内運用前に管理者が確認する。

## 現在できること

- `/`と`/planning`: デモの生産計画。予定変更・優先順位・飛び込み・実績入力・カレンダーと再計算の確認。
- `/login`: Supabaseへメール・パスワード認証するコードを実装。
- `/workspace`: 認証済みの利用者とprofilesを確認するコードを実装。
- `/api/connection`: キーを返さず接続設定・認証・profilesの確認状態を返す。

## 未完了

- 初期スキーマのリモート適用。公開RESTの確認ではprofilesテーブル未作成（PGRST205）。
- Supabase実アカウントでのログイン・RLS検証。
- 業務の更新RPC、予定・実績の実データAPI、DBデータを使ったガント。
- 初期スキーマは読み取り権限だけを許可。デモの操作がDBへ保存されることはない。
- 設備・担当者・会社カレンダーの実データ登録。
- デモでは会社カレンダーの勤務時間と休憩は確定した時刻を使用。設備名・担当者名は架空。

【次のAIへの引き継ぎ事項】

接続設定済み。まずスキーマ適用を行い、実アカウントで認証と権限を検証する。
DB更新処理は権限・トランザクション・実績と日程の再計算を検証してから有効化する。
デモを実運用完了と誤認させない。

