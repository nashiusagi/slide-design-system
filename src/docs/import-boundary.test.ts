import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'

/*
 * カタログに掛かる import の制限（`eslint.config.js` の `catalogImportRules`）が、実際に効いて
 * いることを固定する。
 *
 * 設定そのものを読んで突き合わせない。それでは「書いたとおりに書けている」ことしか見えず、
 * セレクタが対象のノードを取り違えていても通る。実際、この検査を置く前の2周で、静的 import
 * だけを見るセレクタ・再エクスポートを見ないセレクタが2度素通りした。ここでは ESLint を
 * 実際に走らせ、**弾かれるべき書き方が弾かれること**と、**通ってよい書き方が通ること**の
 * 両方を見る。
 *
 * CSS 側の読み込み宣言について `src/docs/docs.css.test.ts` が果たしているのと同じ役目
 * （DR-0042 / DR-0047 の帰結）を、TS 側に置く。境界の正本は `scripts/cross-entry-boundary.json`
 * と `eslint.config.js` のままで、ここが持つのは効き目の確認だけ。
 */

/** 実在しないパスで構わない。ESLint はファイルパスから設定を選ぶだけで、中身は渡した文字列を使う。 */
const CATALOG_FILE = 'src/docs/import-boundary-probe.ts'

/** カタログの外。同じコードがここでは通ることを見て、制限が場所に紐づいていることを確かめる。 */
const OUTSIDE_FILE = 'packages/eslint-plugin-slide/src/import-boundary-probe.mjs'

const eslint = new ESLint()

/** そのコードをその場所へ書いたときに出るメッセージ。 */
async function lint(code: string, filePath: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath })

  return result.messages.map((message) => `${message.ruleId}: ${message.message}`)
}

describe('カタログの import の制限', () => {
  /*
   * scripts/ のコードを読む書き方。DR-0051 が却下した判定根拠（検査スクリプトの実装一覧を
   * カタログが直接読む形）は、どの書き方でも戻せてはいけない。
   *
   * 再エクスポートを含めるのは、src/docs/ の中へ1枚挟めば以降は普通の import になるからだ。
   */
  it.each([
    ['静的 import', "import { x } from '../../scripts/lib/measure-rules.mjs'\nexport const y = x"],
    ['動的 import', "export const y = () => import('../../scripts/lib/measure-rules.mjs')"],
    ['名前付き再エクスポート', "export { x } from '../../scripts/lib/measure-rules.mjs'"],
    ['全体の再エクスポート', "export * from '../../scripts/lib/measure-rules.mjs'"],
  ])('%s で scripts/ のコードを読むと落ちる', async (_name, code) => {
    const messages = await lint(code, CATALOG_FILE)

    expect(messages.join('\n')).toContain('DR-0051')
  })

  /*
   * データは読んでよい（DR-0051 決定1）。ここが落ちるようになると、実装状況の判定そのものが
   * 書けなくなる——制限が目的を越えて広がったことに気づける。
   */
  it('scripts/ の JSON は読める', async () => {
    const messages = await lint(
      "import data from '../../scripts/unimplemented-rules.json'\nexport const ids = data.unimplementedRuleIds",
      CATALOG_FILE,
    )

    expect(messages).toEqual([])
  })

  /*
   * 制限はカタログに掛かっている。場所によらず効く形にすると、Node 側のスクリプトやプラグイン
   * が互いを読むことまで塞いでしまう。
   */
  it('カタログの外では、同じ読み込みが通る', async () => {
    const messages = await lint("import { x } from './lib/measure-rules.mjs'\nexport const y = x", OUTSIDE_FILE)

    expect(messages.join('\n')).not.toContain('DR-0051')
  })

  /*
   * スライド本体との境界（DR-0042）も同じ設定が持っている。scripts/ の制限を足すときに
   * 元の禁止を落としていないことを、ここで一緒に見る。
   */
  it('スライド本体への参照は、静的でも動的でも落ちる', async () => {
    const staticImport = await lint("import { Deck } from '../runtime/Deck'\nexport const d = Deck", CATALOG_FILE)
    const dynamicImport = await lint("export const d = () => import('../runtime/Deck')", CATALOG_FILE)

    expect(staticImport.join('\n')).toContain('DR-0042')
    expect(dynamicImport.join('\n')).toContain('DR-0042')
  })
})
