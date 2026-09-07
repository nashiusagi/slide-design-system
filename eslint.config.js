import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'

/**
 * この時点では標準ルールのみを入れる。
 * 契約に基づく検査（no-raw-color / layout-approved など）は
 * packages/eslint-plugin-slide として後続の Issue で足す（DR-0011）。
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
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    linterOptions: {
      noInlineConfig: true,
      reportUnusedDisableDirectives: 'error',
    },
  },
  {
    // 開発用パッケージ（契約検査プラグインなど）。ここは Node で動く。
    // src と違い noInlineConfig は掛けない。src は無人の生成ループで書かれる検査対象だが、
    // packages は PR レビューを経て変更されるコードなので、局所的な抑止を認める。
    // ただし効かなくなった抑止コメントは残さない（DR-0011）。
    files: ['packages/**/*.{ts,tsx}'],
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
