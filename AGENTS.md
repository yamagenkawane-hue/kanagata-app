<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data.

Before writing any code:

1. Read the relevant guide in `node_modules/next/dist/docs/`.
2. Read and apply all relevant project Skills in `.codex/skills/`.
3. Heed all deprecation notices.
4. Follow `AGENTS.md` before making implementation decisions.

<!-- END:nextjs-agent-rules -->

## Git運用（ユーザー指定）

- 編集を行った際は、内容に応じた確認を実施してコミットし、GitHubのoriginへプッシュする。
- 通常のコミット・プッシュは毎回の確認を求めずに実行する。
- 環境変数ファイル、認証情報、実際の接続キーはプッシュしない。`.env.example`に実値が入っている場合も対象から外す。
- プッシュが失敗した場合は、成功したと報告せず、理由と未プッシュの状態を伝える。
- force pushや他者の変更の破棄は、この指示の対象に含めない。
