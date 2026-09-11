import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'

import slidePlugin from './packages/eslint-plugin-slide/src/index.mjs'

/**
 * 契約に基づく検査（no-raw-color / no-raw-scale / layout-approved /
 * component-approved / deck-conformance）は packages/eslint-plugin-slide が持つ
 * （DR-0011）。ルールIDと design/rules.json の対応は pnpm design:check が検査する。
 */
export default tseslint.config(
  {
    ignores: ['dist/**', 'coverage/**', 'packages/*/dist/**'],
  },
  {
    // スライドのソース。AI が生成したものを検査する対象なので、
    // 生成物に混ざった抑止コメントで契約検査を無効化されないようにする。
    files: ['src/**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    plugins: { slide: slidePlugin },
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    linterOptions: {
      noInlineConfig: true,
      reportUnusedDisableDirectives: 'error',
    },
    rules: {
      'slide/no-raw-color': 'error',
      'slide/no-raw-scale': 'error',
      'slide/layout-approved': 'error',
      'slide/component-approved': 'error',
    },
  },
  {
    // App.tsx は design/decks/harness-intro.md に対応する（DR-0037）。deck-conformance は
    // 対象ファイルとルールオプションで deck を明示するため、ここでだけ有効にする。
    files: ['src/App.tsx'],
    plugins: { slide: slidePlugin },
    rules: {
      'slide/deck-conformance': ['error', { deck: 'design/decks/harness-intro.md' }],
    },
  },
  {
    // デザインカタログ（src/docs/）とスライド本体（src/App.tsx / src/runtime/）は
    // 別のビルドエントリで、互いを参照しないと決めている（DR-0042）。参照が生えると
    // カタログのコードがスライドのバンドルへ入り、measure が実測する対象が本番と
    // 同一の物でなくなる（DR-0011 / DR-0022）。ビルドは通ってしまうのでここで弾く。
    // no-restricted-imports は静的 import しか見ないので、動的 import（ImportExpression）は
    // no-restricted-syntax で別に塞ぐ。拡張子付きの指定（'../App.js'）も glob が拾わないため
    // パターンへ明示する。どちらも実際に素通りすることを確かめて足した。
    files: ['src/docs/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/App', '**/App.*', '**/runtime', '**/runtime.*', '**/runtime/*'],
              message: 'カタログはスライド本体（src/App.tsx / src/runtime/）を参照しない（DR-0042）。',
            },
          ],
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ImportExpression[source.value=/(^|\\/)(App|runtime)(\\.|\\/|$)/]',
          message: 'カタログはスライド本体（src/App.tsx / src/runtime/）を動的 import でも参照しない（DR-0042）。',
        },
      ],
    },
  },
  {
    // 逆向き。スライド本体からカタログを参照しない（DR-0042）。
    files: ['src/App.tsx', 'src/main.tsx', 'src/runtime/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/docs', '**/docs.*', '**/docs/*'],
              message: 'スライド本体はカタログ（src/docs/）を参照しない（DR-0042）。',
            },
          ],
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ImportExpression[source.value=/(^|\\/)docs(\\.|\\/|$)/]',
          message: 'スライド本体はカタログ（src/docs/）を動的 import でも参照しない（DR-0042）。',
        },
      ],
    },
  },
  {
    // 開発用パッケージ（契約検査プラグインなど）。ここは Node で動く。
    // src と違い noInlineConfig は掛けない。src は無人の生成ループで書かれる検査対象だが、
    // packages は PR レビューを経て変更されるコードなので、局所的な抑止を認める。
    // ただし効かなくなった抑止コメントは残さない（DR-0011）。
    files: ['packages/**/*.{ts,tsx,mjs}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.node,
    },
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
    },
  },
  {
    // 契約を生成・検証するスクリプト（DR-0028 の check に載る）。Node で動く。
    // ここも検査対象に入れておかないと、検査する側のコードだけが素通りする（DR-0027）。
    files: ['scripts/**/*.mjs'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.node,
    },
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
    },
  },
  {
    // ビルド・lint の設定ファイル。
    files: ['*.{js,ts}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.node,
    },
  },
)
