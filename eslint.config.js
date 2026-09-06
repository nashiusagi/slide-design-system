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
    files: ['packages/**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.node,
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
