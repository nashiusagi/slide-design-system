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

ルールを1つ足すときは、実装とテストのほかに **bypass フィクスチャ**（`src/rules/<ルールID>.bypass.mjs`）が要る。
`design/rules.json` で宣言した軸と除外を事例で埋めていないと `pnpm design:check` が落ちる。
事例は `src/rules/bypass.test.mjs` が `design/rules.json` を端から回して実行するので、テスト側への登録は要らない。
ルールの説明（`meta.docs.description`）も `design/rules.json` から引く。根拠は [DR-0044](../docs/decisions/0044-bypass-fixtures-required.md)。

**パッケージ側に独自の tsconfig や vitest 設定を置くなら、上の3ファイルの指定と二重にならないか確かめること。**
検査プラグインのテストが `pnpm check` の外に落ちると、ルールが何も検出しなくても緑になる。
根拠は [DR-0028](../docs/decisions/0028-single-check-entry-point.md)。
