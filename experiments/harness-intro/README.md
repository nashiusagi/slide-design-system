# experiments/harness-intro/

第1弾の比較実験（[DR-0014](../../docs/decisions/0014-baseline-comparison.md) / [DR-0015](../../docs/decisions/0015-first-experiment.md)）の装置一式。実際の生成・比較は #12 のスコープで、ここは装置だけを持つ（#10）。

| パス | 役割 |
| --- | --- |
| `manifest.json` | baseline / harness 条件の定義 |
| `brief.md` | 両条件へ同一に渡すお題 |
| `prompt.md` | サブエージェントを起動するときの指示テンプレート |
| `starter/` | 両条件へ渡す共通の初期状態。ビルド設定とスライド機構（`src/runtime/**`）のみで、設計契約・Skill は含まない（[DR-0021](../../docs/decisions/0021-starter-contains-runtime-only.md)）。ルート直下の `src/runtime/**` / `src/index.css` と内容が一致することを `pnpm experiment:starter:check` が検査する（[DR-0039](../../docs/decisions/0039-experiment-starter-checked-against-root-scaffold.md)） |
| `schemas/run.schema.json` | 保存 Run（`runs/<id>/run.json`）の JSON Schema |
| `runs/` | 保存済み Run。形式は `runs/README.md` |

## 使い方

```bash
# 1. 条件ごとに隔離ワークスペースを用意する
node scripts/prepare-workspace.mjs create experiments/harness-intro baseline
node scripts/prepare-workspace.mjs create experiments/harness-intro harness

# 2. prompt.md の指示でサブエージェントを起動し、上のワークスペースへ生成させる（手動、DR-0019）

# 3. 生成結果を Run として保存する
node scripts/evaluate-run.mjs save --experiment=experiments/harness-intro --condition=baseline --workspace=<手順1のディレクトリ> --prompt=experiments/harness-intro/prompt.md

# 4. 保存済み Run を採点する（AI 呼び出し無し。何度でも再実行できる）
node scripts/evaluate-run.mjs score --run=experiments/harness-intro/runs/<run-id>

# 5. 複数の Run を比較する
node scripts/compare-runs.mjs experiments/harness-intro/runs/<baseline-run-id> experiments/harness-intro/runs/<harness-run-id>
```

スクリプト自体の役割分担は [DR-0020](../../docs/decisions/0020-scripts-do-not-invoke-ai.md) にある。
