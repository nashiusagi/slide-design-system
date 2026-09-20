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
| [0032](./0032-ajv-for-contract-validation.md) | 契約の JSON Schema 検証は ajv で行い、strict モードで走らせる |
| [0036](./0036-js-yaml-for-deck-frontmatter.md) | deck の frontmatter パースは js-yaml で行う |
| [0041](./0041-postcss-for-layout-class-check.md) | `checkLayoutClasses` は postcss + postcss-selector-parser の構文木で判定する |
| [0042](./0042-design-catalog-as-separate-build-entry.md) | デザインカタログはスライド本体と別のビルドエントリに置く |
| [0043](./0043-catalog-reads-generated-theme-css.md) | カタログは値を `design/theme.css` から読み、見本は `var(--dh-*)` を当てて描く |
| [0045](./0045-stay-on-eslint-not-biome.md) | lint 実行系は ESLint に留め、Biome へ移さない |

### 契約の構造

| # | 決定 |
|---|---|
| [0009](./0009-five-layer-contract.md) | 契約は参考元のデザインシステムの 5 層をフル写像する |
| [0010](./0010-three-layouts.md) | レイアウト variant は 3 種から始める |
| [0016](./0016-deck-contract-markdown.md) | deck 契約は Markdown + frontmatter で書く |
| [0017](./0017-key-message-required-body-optional.md) | deck 契約は keyMessage を必須、body を任意とする |
| [0029](./0029-position-in-url-and-explicit-fragment-index.md) | 現在位置は URL の `#/<スライド>/<段階>` で表し、Fragment の段階は明示する |
| [0030](./0030-slide-class-derived-from-layout.md) | Slide のクラス名は `slide slide--<layout>` として layout から導く |
| [0031](./0031-navigation-keys-and-no-history.md) | ページ送りは → ← Space とクリックで行い、履歴を積まない |
| [0035](./0035-layout-component-contract-shape.md) | layout / component 契約は役割の選択基準と slots / allowedIn の対応で書く |

### 検査

| # | 決定 |
|---|---|
| [0011](./0011-lint-and-measure.md) | 検査は lint（静的）と measure（実測）の 2 系統で行う |
| [0028](./0028-single-check-entry-point.md) | 検査の実行口を `pnpm check` に一本化する |
| [0033](./0033-derived-values-are-generated-and-checked.md) | トークンから導かれる値は生成し、`pnpm check` で再計算と突き合わせる |
| [0034](./0034-contrast-metric-wcag21-srgb.md) | コントラストの指標は WCAG 2.1 とし、sRGB 色域に丸めた値で測る |
| [0037](./0037-eslint-plugin-slide-rule-scope.md) | eslint-plugin-slide の5ルールは、まだ無い実装を前提にしない範囲に絞る |
| [0038](./0038-defer-measure-in-check.md) | `pnpm measure` は、App が設計契約を消費するまで `pnpm check` へ組み込まない |
| [0044](./0044-bypass-fixtures-required.md) | 検査ルールには bypass フィクスチャを伴わせ、守備範囲を契約で宣言する |
| [0046](./0046-prose-checked-for-canonical-duplication.md) | 正本の複製は散文まで機械検査の対象にする |

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
| [0039](./0039-experiment-starter-checked-against-root-scaffold.md) | experiments の starter はコミットして持ち、ルート足場との一致を検査する |
| [0040](./0040-audit-secret-pattern-selection.md) | audit の API キー・token 検査は、主要ベンダーの既知形式 + 汎用の変数代入パターンに限る |

### メタ

| # | 決定 |
|---|---|
| [0024](./0024-decision-records-not-adr.md) | 決定記録は `docs/decisions/` に置き、「DR」と呼ぶ |

## 新しい決定を追加するとき

1. 連番で `NNNN-slug.md` を作る
2. 「文脈 / 決定 / 理由 / 検討した他の選択肢と却下理由 / 帰結」を書く
3. 値を含む決定なら `**正本**:` 行を置き、値そのものは書かない。正本に取れるのは、運用上どこかが持たなければならない値に限る（設定ファイル、契約データ、Skill の手順値など。この3つに限らない）。DR が決めた規則をそのまま実装したコードは正本ではない——それを正本にすると、コードを書き換えた時点で DR ではなくコードが正しいことになり、実装が DR に従っているかを検査する足場が消える。実装の在り処を示したいときは `**実装**:` 行を使う
4. この索引に追記する。節の中は DR 番号の昇順に置く

既存の決定を覆す場合は、新しい DR を立てて旧 DR の状態を「置き換え済み」に変える。旧 DR は削除しない。
