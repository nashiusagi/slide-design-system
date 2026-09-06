# 決定記録（Decision Record / DR）

このプロジェクトの意思決定を、理由と却下した選択肢つきで記録する。形式は MADR に準拠する。

呼称と方針の根拠は [DR-0024](./0024-decision-records-not-adr.md) にある。要点は二つ。

- アーキテクチャに限らない決定（デザイン方針を含む）を対象にする
- **デザインの値は DR に複製しない。** 値の正本は `DESIGN.md` / `design/tokens.json` / `design/rules.json` であり、DR は決定の要約・理由・却下案・正本へのリンクだけを持つ

## 索引

### 目的とスコープ

| # | 決定 |
|---|---|
| [0001](./0001-phase-1-is-ai-harness.md) | Phase 1 は「AI に書かせる Harness」から始める |
| [0004](./0004-phase-1-runtime-scope.md) | Phase 1 のランタイムはスケーリングと URL 同期のみとする |
| [0005](./0005-single-theme-personal.md) | 自分専用の単一テーマとし、primitive 層を持たない |
| [0006](./0006-online-sharing-first.md) | オンライン共有を優先する |

### デザイン方針

| # | 決定 | 値の正本 |
|---|---|---|
| [0007](./0007-north-star.md) | 北極星は「白い紙面と黒い文字。強調は赤紫の一色だけ」 | `DESIGN.md`, `design/tokens.json` |
| [0008](./0008-accent-hue-purple.md) | アクセントの赤紫はパープル寄りにする | `design/tokens.json` |
| [0012](./0012-min-font-size.md) | 本文の最小フォントサイズに下限を設ける | `design/rules.json` |

### 技術スタック

| # | 決定 |
|---|---|
| [0002](./0002-source-format-jsx-react.md) | AI が生成するソースは JSX / React とし、静的出力へビルドする |
| [0003](./0003-custom-slide-runtime.md) | スライド機構は自作の薄いランタイムで持つ |
| [0018](./0018-plain-css-with-tokens.md) | スタイルは素の CSS + トークン変数で書き、Tailwind を使わない |
| [0022](./0022-plain-vite-build-output.md) | 最終出力は `vite build` の素の成果物とする |
| [0026](./0026-typescript-5-for-eslint-ast.md) | TypeScript は 5 系に留め、7 系へは上げない |
| [0027](./0027-build-scaffold-workspace-and-test-stack.md) | 足場は pnpm workspace とし、テストは Vitest で書く |

### 契約の構造

| # | 決定 |
|---|---|
| [0009](./0009-five-layer-contract.md) | 契約は Atlas の 5 層をフル写像する |
| [0010](./0010-three-layouts.md) | レイアウト variant は 3 種から始める |
| [0016](./0016-deck-contract-markdown.md) | deck 契約は Markdown + frontmatter で書く |
| [0017](./0017-key-message-required-body-optional.md) | deck 契約は keyMessage を必須、body を任意とする |

### 検査

| # | 決定 |
|---|---|
| [0011](./0011-lint-and-measure.md) | 検査は lint（静的）と measure（実測）の 2 系統で行う |
| [0028](./0028-single-check-entry-point.md) | 検査の実行口を `pnpm check` に一本化する |

### 実験と運用

| # | 決定 |
|---|---|
| [0013](./0013-agent-skill-and-resolver.md) | AI への契約供給は Agent Skill + resolve スクリプトで行う |
| [0014](./0014-baseline-comparison.md) | Baseline との比較実験を行う |
| [0015](./0015-first-experiment.md) | 第 1 弾のお題は「この仕組み自体の紹介スライド」とする |
| [0019](./0019-claude-only-runner.md) | ランナーは Claude Code のみとし、`claude -p` を使わない |
| [0020](./0020-scripts-do-not-invoke-ai.md) | 実験スクリプトは AI を起動しない |
| [0021](./0021-starter-contains-runtime-only.md) | starter にはスライド機構のみを入れ、契約は Harness 側だけに渡す |
| [0023](./0023-public-repo-with-audit.md) | public リポジトリで公開し、sanitize と audit を実装する |
| [0025](./0025-issue-driven-development-flow.md) | Issue 起点の開発フローを Agent Skill として固定する |

### メタ

| # | 決定 |
|---|---|
| [0024](./0024-decision-records-not-adr.md) | 決定記録は `docs/decisions/` に置き、「DR」と呼ぶ |

## 新しい決定を追加するとき

1. 連番で `NNNN-slug.md` を作る
2. 「文脈 / 決定 / 理由 / 検討した他の選択肢と却下理由 / 帰結」を書く
3. 値を含む決定なら `**正本**:` 行を置き、値そのものは書かない
4. この索引に追記する

既存の決定を覆す場合は、新しい DR を立てて旧 DR の状態を「置き換え済み」に変える。旧 DR は削除しない。
