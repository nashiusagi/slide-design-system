# scripts/

契約を生成・検証する Node スクリプトを置く。

| スクリプト | 役割 |
| --- | --- |
| `generate-theme.mjs` | `design/tokens.json` から `design/theme.css` の `--dh-*` を生成する。`--check` で乖離を検出する |
| `validate-design.mjs` | 契約自体を検証する（スキーマ、色域、コントラスト、キャンバス寸法とランタイムの一致） |
| `lib/` | 上の 2 つが共有する純粋な計算。色の変換とコントラストの算出 |

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
