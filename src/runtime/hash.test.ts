import { describe, expect, it } from 'vitest'

import { formatHash, parseHash } from './hash'

describe('parseHash', () => {
  it('スライド番号だけの hash を段階 0 として読む', () => {
    expect(parseHash('#/7')).toEqual({ slideIndex: 6, step: 0 })
  })

  it('段階つきの hash を読む', () => {
    expect(parseHash('#/3/2')).toEqual({ slideIndex: 2, step: 2 })
  })

  it('段階 0 を明示した hash も読む', () => {
    expect(parseHash('#/3/0')).toEqual({ slideIndex: 2, step: 0 })
  })

  it.each(['', '#', '#/', '#/0', '#/a', '#/1/', '#/1/2/3', '#/-1', '#/1.5', '/1'])(
    '書式に合わない %o は null を返す',
    (hash) => {
      expect(parseHash(hash)).toBeNull()
    },
  )
})

describe('formatHash', () => {
  it('段階 0 は省略する', () => {
    expect(formatHash({ slideIndex: 6, step: 0 })).toBe('#/7')
  })

  it('段階が 1 以上なら書く', () => {
    expect(formatHash({ slideIndex: 2, step: 2 })).toBe('#/3/2')
  })

  it('parseHash と往復しても位置が変わらない', () => {
    const position = { slideIndex: 4, step: 3 }

    expect(parseHash(formatHash(position))).toEqual(position)
  })
})
