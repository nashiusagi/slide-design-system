import { describe, expect, it } from 'vitest'

import { COMPONENTS, type ComponentContract } from '../components'
import { LAYOUTS, type LayoutContract } from '../layouts'

/*
 * 契約の文言がカタログのソースへ書き写されていないことを見る（DR-0042 決定2）。
 *
 * ページ単位のテストファイルではなく、ここ1箇所に置く。ページごとに同じテストを書く形だと、
 * ページを足した人が書き忘れた時点で守備範囲の外へ出る。対象のファイルは glob で取るので、
 * ページを足しても書き足す必要は無い。ただし**契約の種類**を足すときは、下の CONTRACT_PROSE
 * へ1行足す必要がある（DR-0049 の帰結）。
 *
 * これは人が守る規約の補助でしかない。機械検査（scripts/check-canonical-duplication.mjs /
 * DR-0046）が src/docs について見るのは値と名前の一覧で、契約の文章は対象に入っていない。
 */

/*
 * 対象は src/docs 配下の実装すべて。ページのファイルだけに絞らない。
 *
 * 描画を切り出す先はページのファイルとは限らない。`pages/` の外（DocsApp.tsx）にも、
 * `.tsx` ではないファイル（読み込み口やヘルパの .ts）にも置ける。どれか一つを外すと、
 * 置き場所を変えるだけで検査の外へ出られる。
 */
const SOURCES = Object.entries(
  import.meta.glob<string>('../**/*.{ts,tsx}', { eager: true, query: '?raw', import: 'default' }),
).filter(([path]) => !path.includes('.test.'))

/** 契約と、それが持つ文章。 */
type ContractProse = {
  label: string
  contract: LayoutContract | ComponentContract
  texts: string[]
}

/**
 * 契約の `$comment`。設計意図の説明なので、カタログの解説文へ最も写されやすい。
 *
 * 型（`LayoutContract` / `ComponentContract`）は `$comment` を持たない。表示に使わない項目を
 * 型へ入れると、ページ側が読めるようになってしまう。ここでは読み込んだ実体から取る。
 */
function commentOf(contract: object): string | null {
  const comment = (contract as { $comment?: unknown }).$comment

  return typeof comment === 'string' ? comment : null
}

/** 契約が持つ文章。ここに挙がったものがソースに現れたら、それが複製である。 */
const CONTRACT_PROSE: ContractProse[] = [
  ...LAYOUTS.map((layout) => ({
    label: `design/layouts/${layout.name}.json`,
    contract: layout,
    texts: [
      layout.role,
      ...layout.whenToUse,
      ...layout.whenNotToUse,
      ...layout.classes,
      ...(commentOf(layout) === null ? [] : [commentOf(layout) as string]),
    ],
  })),
  ...COMPONENTS.map((component) => ({
    label: `design/components/${component.name}.json`,
    contract: component,
    texts: [
      component.role,
      ...component.usage,
      ...Object.values(component.props).map((prop) => prop.description),
      ...(commentOf(component) === null ? [] : [commentOf(component) as string]),
    ],
  })),
]

/**
 * ソースから、静的に決まる文字列を取り出して1本に繋げる。
 *
 * ソースをそのまま見て部分一致を取ると、文言を分断する書き方で素通りする。実際に素通りした形を
 * 並べると、行の折り返し・`'A' + 'B'` の連結・テンプレートリテラルへ `${''}` を挟む、のどれも
 * 画面に出る文字列を1文字も変えない。落とす文字を足していく形（空白、引用符、`+`、`$` `{` `}`
 * …）では、`${0}` や `${ }` のような変種をいくらでも作れる——いたちごっこになる。
 *
 * そこで向きを変える。**式を評価せず、文字列リテラルとテンプレートリテラルのリテラル部分だけを
 * 取り出し、間に何も挟まずに繋げる。** 分断に使われる `+` や `${...}` は、繋げた時点で消える。
 * 行をまたぐ折り返しは、リテラルの中の改行と前後の空白を落とせば繋がる。
 *
 * **ただしこれだけでは足りない。** JSX の子要素として書いたテキスト（`<p>あいう</p>`）は
 * 引用符を持たないので、ここには現れない。しかもページのリード文がまさにその形で、契約文言を
 * 貼るとしたら最も起こりやすい場所である。空白を落とした生のソースと、この関数の結果の
 * **両方**を見る必要がある（`describe` の中で両方に対して突き合わせている）。
 *
 * 塞げない形は残る。文言を別々の変数へ分けて持ち、描画時に組み立てる書き方は一致しない。
 * 塞いでいるのは「1箇所へ貼って整形した」形までである。
 */
export function staticStrings(source: string): string {
  const literals = [...source.matchAll(/'([^'\\]*(?:\\.[^'\\]*)*)'|"([^"\\]*(?:\\.[^"\\]*)*)"|`([^`\\]*(?:\\.[^`\\]*)*)`/g)]

  return literals
    .map(([, single, double, template]) => {
      if (template !== undefined) {
        // テンプレートの中の式は、評価せず落とす。残るのはリテラル部分だけになる。
        // 入れ子の `}` を含む式（`${ {a: 1} }`）はここで潰しきれず、残りかすが文字列を
        // 分断する。塞げていない形として残っている。
        return template.replace(/\$\{[^{}]*\}/g, '')
      }

      return single ?? double ?? ''
    })
    .join('')
    .replace(/\s+/g, '')
}

/** 契約の文言も同じ形へ揃える。JSON の中の空白・改行は、貼ったときに整形で変わる。 */
function packed(text: string): string {
  return text.replace(/\s+/g, '')
}

describe('カタログの実装', () => {
  it('契約の文言をソースへ書き写していない', () => {
    /*
     * 読み込みが空・0件だと、以下の「含まれない」はすべて素通りする（DR-0043 決定1 と同じ形）。
     * 対象が在り、中身が読めていることを先に確かめる。
     */
    expect(SOURCES.length).toBeGreaterThan(0)
    expect(CONTRACT_PROSE.length).toBeGreaterThan(0)

    for (const [path, source] of SOURCES) {
      expect(source.length, `${path} の中身が空`).toBeGreaterThan(0)

      /*
       * 2つの見方で突き合わせる。生のソース（空白を落としたもの）は JSX のテキストのように
       * 引用符を持たない複製を捕まえ、静的に決まる文字列は分断された複製を捕まえる。
       * 片方だけでは、もう片方の形が素通りする。
       */
      const views = [
        { name: '素のソース', text: packed(source) },
        { name: '静的に決まる文字列', text: staticStrings(source) },
      ]

      for (const { label, texts } of CONTRACT_PROSE) {
        expect(texts.length, `${label} から文章を1つも集めていない`).toBeGreaterThan(0)

        for (const text of texts) {
          for (const view of views) {
            expect(view.text, `${path} の${view.name}に ${label} の文言が書かれている`).not.toContain(
              packed(text),
            )
          }
        }
      }
    }
  })

  /*
   * 契約の `$comment` が、その契約のエントリの texts に実際に入っていること。
   *
   * 名前の一致で見ない。`statement` はレイアウト名と部品名の両方に在るので、名前では
   * どちらの契約を見ているか区別できない。生成元の契約とエントリを1対1で突き合わせる。
   */
  it('各契約の $comment が、その契約の突き合わせ対象に入っている', () => {
    const withComment = CONTRACT_PROSE.filter(({ contract }) => commentOf(contract) !== null)

    expect(withComment.length).toBe(CONTRACT_PROSE.length)

    for (const { label, contract, texts } of withComment) {
      expect(texts, `${label} の $comment が対象に入っていない`).toContain(commentOf(contract))
    }
  })

  /*
   * 取り出し方そのものを固定する。ここが壊れると、上の検査は「文字列が1つも無い」という理由で
   * 通ってしまう。分断に使われた3つの形が、どれも繋がった1本になることを見る。
   *
   * 生のソース側の見方は、`packed` が空白を落とすだけなので、ここでは固定しない。
   */
  it('静的に決まる文字列を、分断の書き方によらず1本に繋げる', () => {
    expect(staticStrings("const a = 'あいう'")).toBe('あいう')
    expect(staticStrings("const a = 'あい' + 'うえ'")).toBe('あいうえ')
    expect(staticStrings('const a = `あい${\'\'}うえ`')).toBe('あいうえ')
    expect(staticStrings("const a = `あい${x}うえ`")).toBe('あいうえ')
    expect(staticStrings("const a = 'あい\n  うえ'")).toBe('あいうえ')
    expect(staticStrings('const a = 1')).toBe('')
  })
})
