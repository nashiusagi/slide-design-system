import { describe, expect, it } from 'vitest'

import { COMPONENTS } from '../components'
import { LAYOUTS } from '../layouts'

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

/**
 * 契約と、それが持つ文章。
 *
 * `contract` の型を契約ごとの型の union にしない。ルールの正本（`design/rules.json`）は
 * 1ファイルに全ルールが入る形で、そこから取るのは**ファイル全体**（`$comment` を持つのは
 * ファイルのほう）だ。契約の種類が増えるたびに union を広げる形にすると、型を広げなかった
 * 人がここへ足すのをやめる方へ働く。ここで要るのは `$comment` を読めることだけなので、
 * `object` で受けて `commentOf` が形を確かめる。
 */
type ContractProse = {
  label: string
  contract: object
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

/**
 * 検査ルールの正本。`$comment` を読むためにファイル全体を取る。
 *
 * `src/docs/rules.ts` が読んでいるのと同じファイルだが、そちらは表示する項目だけを型として
 * 公開している（`RuleContract`）。ここで要るのは型に無い `$comment` なので、別に読む。
 */
const RULES_CONTRACT = Object.values(
  import.meta.glob<object>('/design/rules.json', { eager: true, import: 'default' }),
)[0]

/**
 * 契約の中にある文章を、入れ子ごと集める。
 *
 * `design/rules.json` は1ファイルの中に、ルールの `description`、除外の `description`、
 * 閾値ブロックごとの `$comment` を持つ。名指しで拾う形にすると、閾値ブロックが増えたときに
 * 拾い漏れる——しかも**画面に出ない文章ほど、解説としてカタログへ写す動機が強い**。キーの
 * 名前で再帰的に集めることで、契約の構造が増えても列挙を足さずに済む。
 *
 * レイアウト・部品の契約はこの関数を通さない。あちらは表示する項目が型として決まっており、
 * どの項目が文章かを1件ずつ書いたほうが、拾っている範囲が読んで分かる。
 */
function proseIn(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap(proseIn)
  }

  if (typeof value !== 'object' || value === null) {
    return []
  }

  return Object.entries(value).flatMap(([key, nested]) =>
    typeof nested === 'string' ? (key === 'description' || key === '$comment' ? [nested] : []) : proseIn(nested),
  )
}

/** 契約が持つ文章。ここに挙がったものがソースに現れたら、それが複製である。 */
const CONTRACT_PROSE: ContractProse[] = [
  {
    label: 'design/rules.json',
    contract: RULES_CONTRACT,
    texts: proseIn(RULES_CONTRACT),
  },
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

/**
 * JSX の式コンテナ（`{...}`）を落とす。
 *
 * JSX の地の文は、途中へ `{''}` や `{変数}` を1つ挟むだけで分断できる。画面に出る文字は
 * 変わらないのに、生のソースの上では連続しなくなる。`staticStrings` はそもそも引用符の
 * 無い地の文を見ないので、こちらも素通りする——`${''}` をテンプレートリテラルで塞いだ形の、
 * JSX 版にあたる。
 *
 * 落とすのは**改行を含まない** `{...}` だけ。内側から順に、変わらなくなるまで繰り返す。
 *
 * 改行で区切るのは、関数の本体を落とさないためだ。制限なしに内側から落とすと、`{''}` を
 * 消した次の周で関数の本体が最も内側になり、中の JSX ごと消える——地の文が消えれば、
 * 複製はそこに無いことになってしまう。地の文を割るために挟む式は1行に収まる。
 *
 * 1行のオブジェクトや短い関数本体も一緒に落ちる。落ちた結果として無関係な文が繋がることは
 * あるが、契約の文章は長い日本語の文なので、偶然その並びになる余地は無い。
 *
 * 改行を挟んだ式（`{\n''\n}`）で割る形は残る。塞いでいるのは、整形しても1行に収まる
 * 書き方までである。
 */
function withoutJsxExpressions(source: string): string {
  let text = source

  for (let pass = 0; pass < 10; pass += 1) {
    const next = text.replace(/\{[^{}\n]*\}/g, '')

    if (next === text) {
      break
    }

    text = next
  }

  return text
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
       * 3つの見方で突き合わせる。どれか1つでは、他の形が素通りする。
       *
       * - 素のソース: JSX のテキストのように引用符を持たない複製。オブジェクトの中の
       *   文字列のように、式を落とすと一緒に消えてしまうものもここで捕まえる
       * - 式を落としたソース: JSX の地の文を `{''}` や `{変数}` で分断した複製
       * - 静的に決まる文字列: 文字列リテラルを `+` や `${...}` で分断した複製
       */
      const views = [
        { name: '素のソース', text: packed(source) },
        { name: '式を落としたソース', text: packed(withoutJsxExpressions(source)) },
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
   *
   * 期待値に `commentOf` を使わない。集める側と期待値の側が同じ関数を呼ぶと、その関数が
   * 「全契約について非 null だが中身が違う値」を返すようになっても、両側が同じ壊れ方を
   * するので通ってしまう。ここでは契約の実体から直に読む。
   */
  it('各契約の $comment が、その契約の突き合わせ対象に入っている', () => {
    for (const { label, contract, texts } of CONTRACT_PROSE) {
      const comment = (contract as { $comment?: unknown }).$comment

      expect(typeof comment, `${label} が $comment を持たない`).toBe('string')
      expect(texts, `${label} の $comment が対象に入っていない`).toContain(comment)
    }
  })

  /*
   * 集め方そのものを固定する。ここが壊れると、`design/rules.json` の突き合わせは
   * 「文章が1つも無い」という理由で通ってしまう。入れ子の配列・オブジェクトの底にある
   * `description` と `$comment` まで届くこと、それ以外のキーの文字列は拾わないことを見る。
   */
  it('契約の入れ子から、description と $comment だけを集める', () => {
    expect(
      proseIn({ $comment: 'あ', name: 'ignored', rules: [{ description: 'い', items: [{ $comment: 'う' }] }] }),
    ).toEqual(['あ', 'い', 'う'])
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

  /*
   * 式を落とす側も固定する。ここが壊れると、JSX の地の文を分断した複製が素通りする。
   */
  it('JSX の式コンテナを落として、地の文を1本に繋げる', () => {
    expect(packed(withoutJsxExpressions("<p>あい{''}うえ</p>"))).toBe('<p>あいうえ</p>')
    expect(packed(withoutJsxExpressions('<p>あい{x}うえ</p>'))).toBe('<p>あいうえ</p>')
    expect(packed(withoutJsxExpressions('<p>あい{f({ y: 1 })}うえ</p>'))).toBe('<p>あいうえ</p>')
  })
})
