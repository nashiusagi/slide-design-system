import { createRequire } from 'node:module'

import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'

import slidePlugin from './packages/eslint-plugin-slide/src/index.mjs'

/**
 * カタログ（src/docs/）に掛ける import の制限。
 *
 * スライド本体との相互参照の禁止（DR-0042）に加えて、`scripts/` から読んでよいのはデータ
 * （JSON）だけ、という制限を重ねる。カタログは実装状況を `scripts/unimplemented-rules.json`
 * から引く（DR-0051）が、同じ向きで検査スクリプトの**コード**まで読めると、DR-0051 が却下
 * した判定根拠（`scripts/lib/measure-rules.mjs` の実装一覧を直接読む形）が、lint も検査も
 * 通る状態で戻せる。JSON かどうかは拡張子で見る——`no-restricted-imports` の glob には
 * 「これ以外を禁じる」を書けないので、構文側（`no-restricted-syntax`）で否定する。静的 import と
 * 動的 import は AST のノードが別なので、両方へ同じ条件を掛ける。
 *
 * @returns {import('eslint').Linter.RulesRecord}
 */
function catalogImportRules() {
  return forbidCrossEntryImports(
    boundary.forbiddenFromCatalog,
    'カタログはスライド本体（src/App.tsx / src/runtime/）を参照しない（DR-0042）。',
    // `source` を持つノードをすべて見る。静的 import・動的 import・再エクスポートは別の
    // ノードで、どれか1つでも落とすとその書き方で同じ経路が戻る。再エクスポートは
    // `export * from 'scripts/...'` を src/docs/ の中へ1枚挟むだけで、以降は普通の import と
    // して読めるようになるため、抜け道として静的 import と等価である。
    ['ImportDeclaration', 'ImportExpression', 'ExportNamedDeclaration', 'ExportAllDeclaration'].map((node) => ({
      selector: `${node}[source.value=/scripts\\//]:not([source.value=/\\.json$/])`,
      message:
        'カタログが scripts/ から読んでよいのはデータ（JSON）だけ（DR-0051）。検査スクリプトのコードを読むと、実装状況の判定根拠が増える。',
    })),
  )
}

/**
 * ビルドエントリの境界の正本。JSON の import は、この設定ファイルを型検査する tsc
 * （tsconfig.node.json）が受け付けないため、require で読む。
 *
 * @type {{ forbiddenFromCatalog: string[], forbiddenFromSlides: string[] }}
 */
const boundary = createRequire(import.meta.url)('./scripts/cross-entry-boundary.json')

/**
 * カタログ（src/docs/）とスライド本体（src/App.tsx / src/runtime/）は別のビルドエントリで、
 * 互いを参照しないと決めている（DR-0042）。禁止する相手の名前の正本は
 * scripts/cross-entry-boundary.json で、ここでは静的 import 用の glob と動的 import 用の
 * 正規表現の両方をその一覧から組み立てる。2系統へ別々に書くと、対象が増えたときに片方だけ
 * 更新され、同じ抜け道が再発する。CSS 側の読み込み宣言は ESLint が見ないので、そちらは
 * src/docs/docs.css.test.ts が同じ一覧から検査する（DR-0047 の帰結）。
 *
 * @param {string[]} names 禁止する相手のモジュール名（パスの最終セグメント）
 * @param {string} message 違反時に出す説明
 * @param {{ selector: string, message: string }[]} [extraSyntax] 同じ対象へ重ねる構文の禁止
 * @returns {import('eslint').Linter.RulesRecord}
 */
function forbidCrossEntryImports(names, message, extraSyntax = []) {
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
      ...extraSyntax,
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
    // 部品の正規の実装（DR-0050）。ここは契約名を定義する側なので、再定義（シャドーイング）
    // の検査だけを外す。外さないと、import して使うべき相手をどこにも作れない。allowedIn の
    // 判定は外さない。
    //
    // 正規の実装がどこに在るかを知っているのはこの設定だけで、ルールはそれを値として受け取る
    // （DR-0050）。ルールは「このディレクトリの直下の <契約名>.<拡張子>」という形に
    // ちょうど一致したファイルだけを、その契約名の定義者として扱う。
    files: ['src/components/*.{ts,tsx}'],
    plugins: { slide: slidePlugin },
    rules: {
      'slide/component-approved': ['error', { implementsContractsIn: 'src/components' }],
    },
  },
  {
    // 参照が生えるとカタログのコードがスライドのバンドルへ入り、measure が実測する対象が
    // 本番と同一の物でなくなる（DR-0011 / DR-0022）。ビルドは通ってしまうのでここで弾く。
    // 禁止の組み立ては forbidCrossEntryImports が持つ（DR-0042）。
    files: ['src/docs/**/*.{ts,tsx}'],
    rules: catalogImportRules(),
  },
  {
    // 逆向き。スライド本体からカタログを参照しない（DR-0042）。
    // src/docs/ 以外の src 配下すべて。ファイルを列挙すると、後から src 直下へ足した
    // ファイルが検査から漏れる。
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/docs/**'],
    rules: forbidCrossEntryImports(
      boundary.forbiddenFromSlides,
      'スライド本体はカタログ（src/docs/）を参照しない（DR-0042）。',
    ),
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
