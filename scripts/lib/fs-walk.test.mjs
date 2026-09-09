import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { collectFiles } from './fs-walk.mjs'

/** @type {string[]} */
const tempDirs = []

function makeTempDir() {
  const dir = mkdtempSync(join(tmpdir(), 'fs-walk-test-'))
  tempDirs.push(dir)
  return dir
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(/** @type {string} */ (tempDirs.pop()), { recursive: true, force: true })
  }
})

describe('collectFiles', () => {
  it('ネストしたファイルを相対パスで列挙する', () => {
    const dir = makeTempDir()
    mkdirSync(join(dir, 'runtime'))
    writeFileSync(join(dir, 'App.tsx'), 'x')
    writeFileSync(join(dir, 'runtime/Deck.tsx'), 'x')

    expect(collectFiles(dir).sort()).toEqual(['App.tsx', 'runtime/Deck.tsx'])
  })

  it('空のディレクトリは空配列を返す', () => {
    const dir = makeTempDir()
    expect(collectFiles(dir)).toEqual([])
  })
})
