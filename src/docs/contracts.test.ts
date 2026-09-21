import { describe, expect, it } from 'vitest'

import { contractsFrom } from './contracts'

describe('contractsFrom', () => {
  /*
   * 0件で落とすガードそのものを踏む。ガードが壊れても、契約を実際に読む側のテストは実在する
   * 契約を読んで通り続けるので、ここが唯一の検出経路になる（DR-0047 決定4 / DR-0049）。
   */
  it('読み込みが0件なら例外を投げる', () => {
    expect(() => contractsFrom({}, 'design/layouts/', 'src/docs/layouts.ts')).toThrow(
      /design\/layouts\/ の契約を読み込めなかった/,
    )
  })

  /*
   * 例外は、どのディレクトリのどの読み込み口が空だったかを言う。契約の種類が増えたときに、
   * メッセージだけでは場所が分からない状態にしない。
   */
  it('例外は、契約ディレクトリと読み込み口のパスを示す', () => {
    expect(() => contractsFrom({}, 'design/components/', 'src/docs/components.ts')).toThrow(
      /src\/docs\/components\.ts/,
    )
  })

  it('モジュールのパス順に並べ替える', () => {
    const sorted = contractsFrom(
      {
        '../../design/layouts/zulu.json': { name: 'zulu' },
        '../../design/layouts/alfa.json': { name: 'alfa' },
      },
      'design/layouts/',
      'src/docs/layouts.ts',
    )

    expect(sorted.map((contract) => contract.name)).toEqual(['alfa', 'zulu'])
  })
})
