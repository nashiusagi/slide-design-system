# packages/

pnpm workspace のパッケージを置く。最初に入るのは契約検査の ESLint プラグイン
（`eslint-plugin-slide`、[DR-0011](../docs/decisions/0011-lint-and-measure.md)）。

ここに置いたコードは、追加の設定なしで `pnpm check` の対象になる。

| 段 | 対象を決めている場所 |
| --- | --- |
| typecheck | `tsconfig.node.json` の `include` |
| lint | `eslint.config.js` の `packages` 向けブロックの `files` |
| test | `vite.config.ts` の `test.include` |

パターンの実体はこの表に写さない。上の3ファイルが正本である。

**パッケージ側に独自の tsconfig や vitest 設定を置くなら、上の3ファイルの指定と二重にならないか確かめること。**
検査プラグインのテストが `pnpm check` の外に落ちると、ルールが何も検出しなくても緑になる。
根拠は [DR-0028](../docs/decisions/0028-single-check-entry-point.md)。
