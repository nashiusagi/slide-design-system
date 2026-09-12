/**
 * `no-raw-color` の bypass フィクスチャ（DR-0044）。
 *
 * 軸と除外の一覧は design/rules.json が持つ。ここはその各項目に対応する事例だけを
 * 置く。軸を足したのに事例を書かなければ pnpm design:check が落ちる。
 */

/** @type {import('../../../../scripts/lib/bypass-fixtures.mjs').BypassFixture} */
export default {
  cases: [
    {
      axis: 'alternate-notation',
      name: 'computed な文字列キー。角括弧で包んでもプロパティ名は静的に読める',
      code: 'const el = <div style={{ ["color"]: "#ff0000" }} />',
      expect: 'violation',
      messageId: 'rawColor',
    },
    {
      axis: 'alternate-notation',
      name: '置換の無いテンプレートリテラル。引用符の種類を変えても値は同じ',
      code: 'const el = <div style={{ color: `#ff0000` }} />',
      expect: 'violation',
      messageId: 'rawColor',
    },
    {
      axis: 'alternate-notation',
      name: '大文字の hex。色の表記は大小を区別しない',
      code: 'const el = <div style={{ color: "#FF0000" }} />',
      expect: 'violation',
      messageId: 'rawColor',
    },
    {
      axis: 'alternate-notation',
      name: '大文字の VAR(。CSS の関数名は大小を区別しないので、これも変数参照として描画される',
      code: 'const el = <div style={{ color: "VAR(--my-red)" }} />',
      expect: 'violation',
      messageId: 'nonTokenVariable',
    },
    {
      axis: 'alternate-notation',
      name: '大文字の VAR( のフォールバック。関数名の大小で中身の検査を飛ばせない',
      code: 'const el = <div style={{ color: "Var(--dh-color-text, #ff0000)" }} />',
      expect: 'violation',
      messageId: 'rawColor',
    },
    {
      axis: 'value-composition',
      name: 'var() のフォールバック。変数が未定義のとき実際に描かれるのはこの値',
      code: 'const el = <div style={{ color: "var(--dh-color-text, #ff0000)" }} />',
      expect: 'violation',
      messageId: 'rawColor',
    },
    {
      axis: 'value-composition',
      name: '入れ子の var() のフォールバック。包む段数を増やしても中身は描かれる',
      code: 'const el = <div style={{ color: "var(--dh-color-text, var(--dh-color-accent, #ff0000))" }} />',
      expect: 'violation',
      messageId: 'rawColor',
    },
    {
      axis: 'value-composition',
      name: '--dh-* ではないカスタムプロパティ。契約の外の変数は色の出どころにならない',
      code: 'const el = <div style={{ color: "var(--my-red)" }} />',
      expect: 'violation',
      messageId: 'nonTokenVariable',
    },
    {
      axis: 'enumeration-tail',
      name: '色を運ぶプロパティの一覧の末尾側（stopColor）。先頭の color だけ塞いでも足りない',
      code: 'const el = <stop style={{ stopColor: "#ff0000" }} />',
      expect: 'violation',
      messageId: 'rawColor',
    },
    {
      axis: 'enumeration-tail',
      name: '同じく accentColor。一覧に載っている以上、どの要素でも同じ結果になる',
      code: 'const el = <input style={{ accentColor: "rgb(255, 0, 0)" }} />',
      expect: 'violation',
      messageId: 'rawColor',
    },
    {
      exclusion: 'keyword-color',
      name: 'キーワード色は見ない。これは見落としではなく、契約が決めた除外',
      code: 'const el = <div style={{ color: "red" }} />',
      expect: 'ok',
    },
    {
      exclusion: 'shorthand-property',
      name: 'ショートハンドは見ない。色でない部分を色として誤検出しないため',
      code: 'const el = <div style={{ background: "#ff0000" }} />',
      expect: 'ok',
    },
    {
      exclusion: 'attribute-value',
      name: 'style 以外の属性に書いた色。どの属性が色を運ぶかは component 契約の範囲',
      code: 'const el = <SlideTitle color="#ff0000" />',
      expect: 'ok',
    },
    {
      exclusion: 'non-jsx-source',
      name: 'style オブジェクトの外にある CSS 文字列。lint が見るのは style オブジェクトの中だけ',
      code: 'const sheet = ".slide-title { color: #ff0000; }"',
      expect: 'ok',
    },
    {
      exclusion: 'non-static-value',
      name: '変数を経由した値は見ない',
      code: 'const el = <div style={{ color: dynamicColor }} />',
      expect: 'ok',
    },
  ],
}
