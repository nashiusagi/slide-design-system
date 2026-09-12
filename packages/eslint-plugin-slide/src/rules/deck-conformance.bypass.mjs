/**
 * `deck-conformance` の bypass フィクスチャ（DR-0044）。
 *
 * このルールは deck 契約のファイルを読むため、事例の実行には実ファイルが要る。
 * `setup` が一時ディレクトリへ deck を書き、その絶対パスを各事例の `options` へ
 * 渡す。deck の中身をここに置くのは、実データ（design/decks/）の複製ではなく、
 * 枚数と layout の並びを事例側で決めるため。
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const DECK_SOURCE = `---
title: "bypass フィクスチャ用"
---

layout: title
keyMessage: "見出し"

---

layout: bullets
keyMessage: "本文"
`

/** @type {import('../../../../scripts/lib/bypass-fixtures.mjs').BypassFixture} */
export default {
  setup() {
    const dir = mkdtempSync(join(tmpdir(), 'deck-conformance-bypass-'))
    const deckPath = join(dir, 'sample.md')
    writeFileSync(deckPath, DECK_SOURCE)

    return { dir, deckPath }
  },

  teardown(/** @type {{ dir: string }} */ { dir }) {
    rmSync(dir, { recursive: true, force: true })
  },

  cases: [
    {
      axis: 'alternate-notation',
      name: '波括弧で包んだ layout。layout-approved と同じ値の読み方をする',
      code: '<Deck><Slide layout={"title"}>x</Slide><Slide layout={"statement"}>x</Slide></Deck>',
      expect: 'violation',
      messageId: 'layoutMismatch',
      options: (/** @type {{ deckPath: string }} */ { deckPath }) => [{ deck: deckPath }],
    },
    {
      axis: 'alternate-notation',
      name: '包み方を変えた一致は違反にしない。unresolvedLayout へ落とすと一致が見えなくなる',
      code: '<Deck><Slide layout={`title`}>x</Slide><Slide layout={"bullets"}>x</Slide></Deck>',
      expect: 'ok',
      options: (/** @type {{ deckPath: string }} */ { deckPath }) => [{ deck: deckPath }],
    },
    {
      axis: 'boundary',
      name: '契約ちょうどの枚数は通る',
      code: '<Deck><Slide layout="title">x</Slide><Slide layout="bullets">x</Slide></Deck>',
      expect: 'ok',
      options: (/** @type {{ deckPath: string }} */ { deckPath }) => [{ deck: deckPath }],
    },
    {
      axis: 'boundary',
      name: '1枚多い。多い側は末尾の余りとして見逃されやすい',
      code: '<Deck><Slide layout="title">x</Slide><Slide layout="bullets">x</Slide><Slide layout="statement">x</Slide></Deck>',
      expect: 'violation',
      messageId: 'countMismatch',
      options: (/** @type {{ deckPath: string }} */ { deckPath }) => [{ deck: deckPath }],
    },
    {
      axis: 'boundary',
      name: '1枚少ない',
      code: '<Deck><Slide layout="title">x</Slide></Deck>',
      expect: 'violation',
      messageId: 'countMismatch',
      options: (/** @type {{ deckPath: string }} */ { deckPath }) => [{ deck: deckPath }],
    },
    {
      exclusion: 'body-fidelity',
      name: 'body の素材照合は持たない。枚数と layout が合っていれば本文は見ない',
      code: '<Deck><Slide layout="title">契約と違う本文</Slide><Slide layout="bullets">{変数}</Slide></Deck>',
      expect: 'ok',
      options: (/** @type {{ deckPath: string }} */ { deckPath }) => [{ deck: deckPath }],
    },
    {
      exclusion: 'no-deck-option',
      name: 'deck オプションが無いファイルは対象外',
      code: '<Slide layout="title">x</Slide>',
      expect: 'ok',
      options: () => [],
    },
  ],
}
