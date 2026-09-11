import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'

import slidePlugin from './packages/eslint-plugin-slide/src/index.mjs'

/**
 * カタログ（src/docs/）とスライド本体（src/App.tsx / src/runtime/）は別のビルドエントリで、
 * 互いを参照しないと決めている（DR-0042）。禁止する相手の名前はここにだけ書き、静的 import 用の
 * glob と動的 import 用の正規表現の両方をここから組み立てる。2系統へ別々に書くと、対象が増えた
 * ときに片方だけ更新され、同じ抜け道が再発する。
 *
 * @param {string[]} names 禁止する相手のモジュール名（パスの最終セグメント）
 * @param {string} message 違反時に出す説明
 * @returns {import('eslint').Linter.RulesRecord}
 */
function forbidCrossEntryImports(names, message) {
  return {
    // 静的 import。拡張子付き（'../App.js'）は `**/App` に一致しないので別に挙げる。
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: names.flatMap((name) => [`**/${name}`, `**/${name}.*`, `**/${name}/*`]),
            message,
          },
        ],
      },
    ],
    // 動的 import。no-restricted-imports は ImportExpression を見ないので、ここで塞ぐ。
    // 引数がリテラルでないと値を静的に読めず素通りするため、リテラル以外の import() 自体を禁じる。
    'no-restricted-syntax': [
      'error',
      {
        selector: `ImportExpression[source.value=/(^|\\/)(${names.join('|')})(\\.|\\/|$)/]`,
        message,
      },
      {
        selector: "ImportExpression:not([source.type='Literal'])",
        message:
          'import() の引数はリテラルで書く。組み立てたパスは lint が読めず、ビルドエントリの境界検査を素通りする（DR-0042）。',
      },
    ],
  }
}

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
    // 参照が生えるとカタログのコードがスライドのバンドルへ入り、measure が実測する対象が
    // 本番と同一の物でなくなる（DR-0011 / DR-0022）。ビルドは通ってしまうのでここで弾く。
    // 禁止の組み立ては forbidCrossEntryImports が持つ（DR-0042）。
    files: ['src/docs/**/*.{ts,tsx}'],
    rules: forbidCrossEntryImports(
      ['App', 'runtime'],
      'カタログはスライド本体（src/App.tsx / src/runtime/）を参照しない（DR-0042）。',
    ),
  },
  {
    // 逆向き。スライド本体からカタログを参照しない（DR-0042）。
    // src/docs/ 以外の src 配下すべて。ファイルを列挙すると、後から src 直下へ足した
    // ファイルが検査から漏れる。
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/docs/**'],
    rules: forbidCrossEntryImports(['docs'], 'スライド本体はカタログ（src/docs/）を参照しない（DR-0042）。'),
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
