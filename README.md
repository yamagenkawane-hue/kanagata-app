# 生産管理システム（kanagata-app）

Next.js 16 / React 19 / TypeScript strict / Supabaseで開発しています。

## 起動

```powershell
npm ci
npm run dev
```

http://localhost:3000 でログインへ進みます。デモは /demo、DB業務画面は /workspace です。

## 実装した範囲

- 設備別・パーツ別のガント（1日・3日・7日表示、30分目盛り）。
- 固定した5工程の自動計算、設備ごとの優先順位、飛び込み挿入、予定固定、変更前後の確認。
- 会社カレンダー、夜間・休日の連続稼働、休憩中稼働の指定。
- 作業開始・終了と休憩控除、作業時間の修正、他の担当者の実績入力。
- メール・パスワードのログイン処理と認証状態確認。

生産計画画面は架空データのデモです。操作内容はメモリ内のみで、ページ再読み込みで戻ります。デモの権限切替は本番の認証ではありません。

## Supabase

`.env.local`に接続URLとPublishable keyを設定済みです。Gitには含めません。
初期テーブルSQLは `supabase/migrations/202609300001_initial_schema.sql` にありますが、リモート適用は未実施です。
BOM、管理画面、DB読取・更新RPC、ガント接続コードを追加しました。ローカルDBで権限・数量・CRUDを検証済みです。クラウドへのSQL適用、Authプロフィール登録、実アカウントによる結合テストは未完了です。
最新の適用手順は `docs/DB設定と操作手順_2026-10-01.md`、追加実装の内容は `docs/追加実装と検証_2026-10-01.md` を参照してください。

## 品質確認

```powershell
npm test
npm run lint
npm run typecheck
npm run build
```

本番ビルドの起動は `npm run start` です。Lintは別途実行します。
Node.js 24を使用します。ESLintは関連プラグインの互換性から9系を使用しています。

GitHub: https://github.com/yamagenkawane-hue/kanagata-app
初期実装と要件文書をmainへプッシュ済みです。編集後はその都度プッシュします。

【次のAIへの引き継ぎ事項】

DB読取・保存、BOM管理、画面遷移と計算処理を実装済み。クラウドSQL適用・Authプロフィール登録・実環境の結合テストを継続する。
初期SQLの適用・利用者登録後、権限とトランザクションを備えた業務APIを実装し、DB結合テストを行う。
前工程の承認済み要件は変更せず、設計判断記録を参照する。
