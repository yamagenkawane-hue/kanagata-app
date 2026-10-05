# 金型生産管理システム（kanagata-app）

Next.js 16 / React 19 / TypeScript strict / Supabase。PCで約10名の利用を想定する。
最新仕様・設定手順・確認状態は[最新仕様と実装状況](docs/最新仕様と実装状況_2026-10-05_名称リスト.md)、変更履歴は[docs一覧](docs/README.md)を参照する。

## 起動

Node.js 24を使用する。

```powershell
npm ci
npm run dev
```

`http://localhost:3000/login`でユーザーID・パスワードを入力する。初回管理者登録は`/setup`（合言葉なし、登録パスワード8文字以上）。追加ユーザーは管理者がユーザー設定から登録する。
DB業務画面は`/workspace`、デモは`/demo`。デモだけが架空データ・メモリ内操作で再読み込み時に戻る。

## 主な実装

- 金型別ガント、工程別・機械別詳細への遷移、パーツ名表示。
- BOM名称リスト管理、プレート初期10種類の選択、必要工程と数量分割、登録済みプレートの除外・編集。
- 加工順・飛び込み・固定予定・空き時間と後工程の計算・確認して確定。
- 勤務時間・休憩・夜間・休日・会社カレンダーExcel取込。
- 他の担当者を含む実績入力・修正、休憩控除・日別時間・履歴保持。
- DB読取・保存API、管理者／担当者権限、数量上限・更新競合・監査ログ。
- 工程管理（機械の登録・編集・使用停止）、ユーザーIDによる利用者登録。

## Supabase設定

`.env.local`にプロジェクトURL・Publishable key・サーバー専用Secret keyを設定する。環境変数と実接続キーはGitに含めない。
新規DBでは`supabase/migrations`の初期・BOM・ログインユーザー登録・BOM区分準備・名称リスト管理の5つのSQLを順番に1回適用する。適用済みファイルを再実行しない。具体的手順は最新仕様文書を参照する。
SQL実行済み・実ログイン成功はユーザー報告あり。全CRUD・権限・Excel実ファイルを含む実環境の結合確認は未完了。

## 品質確認

```powershell
npm test
npm run lint
npm run typecheck
npm run build
```

本番は`npm run build`後に`npm run start`。最新コード変更時にテスト28件・Lint・型チェック・ビルドが成功。文書の更新は機能の実環境確認を意味しない。

[GitHub](https://github.com/yamagenkawane-hue/kanagata-app)。編集後は確認・コミット・originへのプッシュを行う。

【次のAIへの引き継ぎ事項】

最新仕様と実装状況を入口とする。実ログイン成功の報告あり。実環境でのBOM・予定・実績・権限の結合確認と本番公開の準備を継続する。認証情報を出力・プッシュしない。
