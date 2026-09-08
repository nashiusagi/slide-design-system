/**
 * deck.md（frontmatter + `---` 区切りスライド、DR-0016）を JSON へ正規化する。
 *
 * ここが担うのは構文の正規化だけである。`keyMessage` が必須かどうかのような
 * 契約としての妥当性は design/schemas/deck.schema.json 側の Ajv 検証に委ねる
 * （DR-0017）。パーサが妥当性まで判定すると、判定基準がスキーマとパーサの
 * 2箇所に分かれ、どちらか一方だけ直したときに食い違ったまま残る。
 *
 * frontmatter の YAML パースは js-yaml で行う（DR-0036）。
 */
import { load } from 'js-yaml'

/**
 * @typedef {{ layout?: unknown, keyMessage?: unknown, body?: string }} DeckSlide
 * @typedef {{ title?: unknown, slides: DeckSlide[] }} DeckDocument
 */

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/
const BLANK_LINE = /\r?\n\r?\n/

/**
 * YAML マッピングとして読む。js-yaml は空文字列を「空のドキュメント」として
 * 例外を投げるが、ここでは「見出しが1つも書かれていない」という正当な入力
 * として扱いたいので、その場合だけ空オブジェクトへ読み替える。
 *
 * @param {string} text
 * @returns {Record<string, unknown>}
 */
function loadMapping(text) {
  if (text.trim().length === 0) {
    return {}
  }

  return /** @type {Record<string, unknown>} */ (load(text))
}

/**
 * @param {string} source design/decks/*.md の中身
 * @returns {DeckDocument}
 */
export function parseDeck(source) {
  const frontmatterMatch = FRONTMATTER.exec(source)

  if (frontmatterMatch === null) {
    throw new Error('先頭に frontmatter（--- で囲んだブロック）が無い')
  }

  const meta = loadMapping(frontmatterMatch[1])
  const rest = source.slice(frontmatterMatch[0].length)

  return {
    title: meta.title,
    slides: splitSlides(rest).map(parseSlide),
  }
}

/**
 * frontmatter を除いた残りを、スライドごとの生テキストへ分ける。
 *
 * 正規表現で `\n---\n` をまとめて1回の区切りとして拾うと、`---` の行が2つ
 * 連続したとき（空スライドの書き間違い）に片方の区切りがもう片方の `\n` を
 * 使い切ってしまい、後続スライドの見出しごと本文側へ取り込まれてしまう。
 * 1行ずつ見て `---` だけの行を区切りとして扱えば、この食い合いが起きない。
 *
 * 空チャンク（連続した `---` など）もそのまま残す。ここで捨てると、書き間違いで
 * できた空スライドが黙って消え、スキーマ検証まで届かずに素通りしてしまう。
 *
 * @param {string} rest
 * @returns {string[]}
 */
function splitSlides(rest) {
  const lines = rest.split(/\r?\n/)
  /** @type {string[]} */
  const slides = []
  /** @type {string[]} */
  let current = []

  for (const line of lines) {
    if (line.trim() !== '---') {
      current.push(line)
      continue
    }

    slides.push(current.join('\n').trim())
    current = []
  }

  slides.push(current.join('\n').trim())

  return slides
}

/**
 * 1スライド分のテキストを見出しブロック（layout / keyMessage）と本文へ分ける。
 * 最初の空行より前を見出し、以降を本文として扱う。
 *
 * @param {string} chunk
 * @returns {DeckSlide}
 */
function parseSlide(chunk) {
  const blankLine = BLANK_LINE.exec(chunk)
  const headerText = blankLine === null ? chunk : chunk.slice(0, blankLine.index)
  const bodyText = blankLine === null ? '' : chunk.slice(blankLine.index).trim()

  const header = loadMapping(headerText)

  return {
    layout: header.layout,
    keyMessage: header.keyMessage,
    ...(bodyText.length > 0 ? { body: bodyText } : {}),
  }
}
