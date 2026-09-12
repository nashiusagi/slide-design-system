/**
 * `no-raw-scale` の bypass フィクスチャ（DR-0044）。
 *
 * 境界（boundary）の事例は design/rules.json の noRawScale.allowedLiterals の
 * 内側・外側を1つずつ持つ。許容リストの内外を示すには具体的な値が要るので、
 * ここには値を書く（measure 側のフィクスチャが閾値を context から受け取るのとは
 * 違う）。allowedLiterals を変えたときは、この対も見直すこと。
 */

/** @type {import('../../../../scripts/lib/bypass-fixtures.mjs').BypassFixture} */
export default {
  cases: [
    {
      axis: 'alternate-notation',
      name: 'computed な文字列キー',
      code: 'const el = <div style={{ ["padding"]: "16px" }} />',
      expect: 'violation',
      messageId: 'rawScale',
    },
    {
      axis: 'alternate-notation',
      name: '置換の無いテンプレートリテラル',
      code: 'const el = <div style={{ padding: `16px` }} />',
      expect: 'violation',
      messageId: 'rawScale',
    },
    {
      axis: 'alternate-notation',
      name: '単位を変えただけの同値（DR-0011: 単位ではなくリテラルかどうかで判定する）',
      code: 'const el = <div style={{ padding: "1rem" }} />',
      expect: 'violation',
      messageId: 'rawScale',
    },
    {
      axis: 'value-composition',
      name: 'var() のフォールバック。変数が未定義のとき実際に描かれるのはこの長さ',
      code: 'const el = <div style={{ padding: "var(--dh-space-md, 16px)" }} />',
      expect: 'violation',
      messageId: 'rawScale',
    },
    {
      axis: 'value-composition',
      name: 'ショートハンドの複合値。文字列全体を1つの値として見ると素通りする',
      code: 'const el = <div style={{ margin: "8px 16px" }} />',
      expect: 'violation',
      messageIds: ['rawScale', 'rawScale'],
    },
    {
      axis: 'alternate-notation',
      name: '大文字の単位。CSS の単位は大小を区別しないので、これも長さとして描画される',
      code: 'const el = <div style={{ padding: "16PX" }} />',
      expect: 'violation',
      messageId: 'rawScale',
    },
    {
      axis: 'alternate-notation',
      name: '許容リストにある値を大文字の単位で書いた形。同じ値なので通る側も揃える',
      code: 'const el = <div style={{ borderWidth: "1PX" }} />',
      expect: 'ok',
    },
    {
      axis: 'boundary',
      name: '許容リストにある 1px は通る（ヘアライン境界線）',
      code: 'const el = <div style={{ borderWidth: "1px" }} />',
      expect: 'ok',
    },
    {
      axis: 'boundary',
      name: '許容リストに無い 2px は落ちる。1px が通るのは値が小さいからではなく、列挙されているから',
      code: 'const el = <div style={{ borderWidth: "2px" }} />',
      expect: 'violation',
      messageId: 'rawScale',
    },
    {
      axis: 'enumeration-tail',
      name: '単位の一覧の末尾側（vmax）。px だけ塞いでも足りない',
      code: 'const el = <div style={{ width: "50vmax" }} />',
      expect: 'violation',
      messageId: 'rawScale',
    },
    {
      axis: 'enumeration-tail',
      name: '同じく ch',
      code: 'const el = <div style={{ maxWidth: "60ch" }} />',
      expect: 'violation',
      messageId: 'rawScale',
    },
    {
      exclusion: 'unitless-property',
      name: '値が長さでないプロパティは見ない',
      code: 'const el = <div style={{ zoom: 2 }} />',
      expect: 'ok',
    },
    {
      exclusion: 'calc-composition',
      name: 'calc() の中はまだ見ない。許すか禁じるかを決めていない領域',
      code: 'const el = <div style={{ width: "calc(100% - 8px)" }} />',
      expect: 'ok',
    },
    {
      exclusion: 'keyword-value',
      name: "長さに見えないキーワード値。'center' を生の長さとして報告しない",
      code: 'const el = <div style={{ alignItems: "center" }} />',
      expect: 'ok',
    },
    {
      exclusion: 'attribute-value',
      name: 'style 以外の属性に書いた長さ。どの属性が長さを運ぶかは component 契約の範囲',
      code: 'const el = <SlideBody width="320px" />',
      expect: 'ok',
    },
    {
      exclusion: 'non-jsx-source',
      name: 'style オブジェクトの外にある CSS 文字列。lint が見るのは style オブジェクトの中だけ',
      code: 'const sheet = ".slide-body { padding: 24px; }"',
      expect: 'ok',
    },
    {
      exclusion: 'non-static-value',
      name: '変数を経由した値は見ない',
      code: 'const el = <div style={{ padding: spaceMd }} />',
      expect: 'ok',
    },
  ],
}
