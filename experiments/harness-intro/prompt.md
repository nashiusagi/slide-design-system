# プロンプト（harness-intro）

サブエージェントを手動で1回起動して生成する（[DR-0019](../../docs/decisions/0019-claude-only-runner.md)）。`<workspace>` は次のコマンドが出力するディレクトリの絶対パスに置き換える。

```
node scripts/prepare-workspace.mjs create experiments/harness-intro <baseline|harness>
```

サブエージェントへ渡す指示は次のとおり。`<condition>` に応じて該当する節だけを含める。

## 共通

作業ディレクトリは `<workspace>` です。ここで `experiments/harness-intro/brief.md`（もう渡してあります。以下に転記します）のお題に沿ってスライドを実装してください。

> （ここに brief.md の本文をそのまま貼る）

- `<workspace>/src/App.tsx` を書き換えて実装する。`<workspace>` の外にあるファイルへ書き込まない
- 非対話で進める。判断に迷っても質問しない。誰も答えられない。曖昧な点は自分で判断し、最後の報告に理由を書く
- 実装が終わったら `<workspace>` の中で次を実行し、結果を報告する

  ```
  pnpm install && pnpm typecheck && pnpm build
  ```

## baseline 条件のときだけ

`<workspace>` の外にあるファイル（このリポジトリの `DESIGN.md` / `design/` / `skills/` を含む）は読まない。デザインシステムや設計方針は与えられていない。見た目は自分の判断で決める。

## harness 条件のときだけ

`<workspace>` には Skill（`skills/slide-harness/SKILL.md`）と設計契約一式（`DESIGN.md` / `design/`）が既に置かれている。`skills/slide-harness/SKILL.md` の手順に従って実装する。

## 生成後

生成が終わったら、`<workspace>` を渡して Run を保存する。

```
node scripts/evaluate-run.mjs save --experiment=experiments/harness-intro --condition=<baseline|harness> --workspace=<workspace> --prompt=experiments/harness-intro/prompt.md
node scripts/evaluate-run.mjs score --run=experiments/harness-intro/runs/<出力された run-id>
```
