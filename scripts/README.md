# scripts/

契約を生成・検証する Node スクリプトを置く。

| スクリプト | 役割 |
| --- | --- |
| `generate-theme.mjs` | `design/tokens.json` から `design/theme.css` の `--dh-*` を生成する。`--check` で乖離を検出する |
| `check-canonical-duplication.mjs` | 正本の値・一覧・対応表が、正本を参照できない文書（README / DR / Skill / 実験の記録 / カタログのコード）へ書き写されていないかを検査する（DR-0046）。走査する場所は `SCAN_ROOTS`、例外は `canonical-duplication-allowlist.json` に `reason` と `count` つきで登録する |
| `validate-design.mjs` | 契約自体を検証する（スキーマ、色域、コントラスト、キャンバス寸法とランタイムの一致、deck 契約の構文とスキーマ） |
| `measure-slides.mjs` | `dist/` を Playwright で開き、no-overflow / min-font-size / contrast を実測する（DR-0011）。`pnpm build` の後に `pnpm measure` で実行し、`measurements.json` を出力する |
| `resolve-design-contract.mjs` | manifest（deck/layout/component の一覧）から、正本の中で本当に必要な契約ファイルだけを解決する（DR-0013） |
| `prepare-workspace.mjs` | 実験の隔離ワークスペースを用意する。`create` は `experiments/<name>/starter/` をコピーし、条件が設計契約を含むときは資源も追加でコピーする。`check-starter` は starter のランタイム機構がリポジトリ直下と一致しているかを検査する（DR-0020 / DR-0021 / DR-0039） |
| `evaluate-run.mjs` | 生成結果を Run として取り込み（`save`）、保存済み Run を lint / measure で採点する（`score`）。AI は起動しない（DR-0020） |
| `compare-runs.mjs` | 複数の Run の採点結果（`scoring.json`）を比較表にする（DR-0020） |
| `sanitize-run-artifacts.mjs` | 保存 Run から端末の絶対パスと OS ユーザー名を機械的に置換する（DR-0023） |
| `audit-public-data.mjs` | 公開データに既知の漏洩パターン（絶対パス・API キー/token らしき文字列）が残っていないか検査する。公開の承認ではない（DR-0023、`docs/PUBLICATION_POLICY.md`） |
| `measure-bypass.test.mjs` | measure ルールの bypass フィクスチャを実行する（DR-0044）。ブラウザは要らない |
| `lib/` | 色の変換とコントラストの算出（`color.mjs`）、deck.md を JSON へ正規化するパーサ（`deck.mjs`、DR-0016）、ディレクトリ配下のファイル列挙（`fs-walk.mjs`）、bypass フィクスチャの置き場所と読み込み（`bypass-fixtures.mjs`、DR-0044）、measure ルールの bypass フィクスチャ本体（`measure-bypass/`） |

**スクリプトは AI を起動しない**（[DR-0020](../docs/decisions/0020-scripts-do-not-invoke-ai.md)）。

ここに置いたコードも `pnpm check` の対象になる。

| 段 | 対象を決めている場所 |
| --- | --- |
| typecheck | `tsconfig.node.json` の `include`（`.mjs` を `checkJs` で見る） |
| lint | `eslint.config.js` の `scripts` 向けブロックの `files` |
| test | `vite.config.ts` の `test.include` |

パターンの実体はこの表に写さない。上の3ファイルが正本である。

検査する側のコードが検査の対象から外れると、壊れていても緑を返す。
根拠は [DR-0027](../docs/decisions/0027-build-scaffold-workspace-and-test-stack.md) / [DR-0028](../docs/decisions/0028-single-check-entry-point.md)。
