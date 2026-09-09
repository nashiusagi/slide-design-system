import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { USER_PLACEHOLDER, WORKSPACE_PLACEHOLDER, sanitizeDirectory, sanitizeText } from './sanitize-run-artifacts.mjs'

/** @type {string[]} */
const tempDirs = []

function makeTempDir() {
  const dir = mkdtempSync(join(tmpdir(), 'sanitize-test-'))
  tempDirs.push(dir)
  return dir
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(/** @type {string} */ (tempDirs.pop()), { recursive: true, force: true })
  }
})

describe('sanitizeText', () => {
  it('ホームディレクトリの出現をすべて置換する', () => {
    const content = 'error at /home/ryogo/project/src/App.tsx:12 and /home/ryogo/project/dist/index.html'
    const result = sanitizeText(content, { homeDir: '/home/ryogo', username: '' })

    expect(result).toBe(`error at ${WORKSPACE_PLACEHOLDER}/project/src/App.tsx:12 and ${WORKSPACE_PLACEHOLDER}/project/dist/index.html`)
  })

  it('ユーザー名を単語境界つきで置換する', () => {
    const content = 'user ryogo built this'
    const result = sanitizeText(content, { homeDir: '', username: 'ryogo' })

    expect(result).toBe(`user ${USER_PLACEHOLDER} built this`)
  })

  it('ユーザー名が別の単語の一部のときは置換しない', () => {
    const content = 'ryogolang is unrelated'
    const result = sanitizeText(content, { homeDir: '', username: 'ryogo' })

    expect(result).toBe('ryogolang is unrelated')
  })

  it('identifiers が空文字列のときは何もしない', () => {
    const content = 'nothing to change here'
    expect(sanitizeText(content, { homeDir: '', username: '' })).toBe(content)
  })

  it('ホームディレクトリとユーザー名の両方が含まれるときは両方を置換する', () => {
    const content = '/home/ryogo/workspace のログ: ryogo がビルドした'
    const result = sanitizeText(content, { homeDir: '/home/ryogo', username: 'ryogo' })

    expect(result).toBe(`${WORKSPACE_PLACEHOLDER}/workspace のログ: ${USER_PLACEHOLDER} がビルドした`)
  })
})

describe('sanitizeDirectory', () => {
  it('内容が変わったファイルだけを書き換え、書き換えたファイル一覧を返す', () => {
    const dir = makeTempDir()
    mkdirSync(join(dir, 'nested'))
    writeFileSync(join(dir, 'measurements.json'), JSON.stringify({ dist: '/home/ryogo/tmp/dist' }))
    writeFileSync(join(dir, 'nested/App.tsx'), 'export const x = 1\n')

    const changed = sanitizeDirectory(dir, { homeDir: '/home/ryogo', username: 'ryogo' })

    expect(changed.sort()).toEqual(['measurements.json'])
    expect(readFileSync(join(dir, 'measurements.json'), 'utf8')).toContain(WORKSPACE_PLACEHOLDER)
    expect(readFileSync(join(dir, 'nested/App.tsx'), 'utf8')).toBe('export const x = 1\n')
  })

  it('バイナリ扱いの拡張子には書き込まない', () => {
    const dir = makeTempDir()
    const original = 'not really a png but contains /home/ryogo/secret'
    writeFileSync(join(dir, 'screenshot.png'), original)

    const changed = sanitizeDirectory(dir, { homeDir: '/home/ryogo', username: 'ryogo' })

    expect(changed).toEqual([])
    expect(readFileSync(join(dir, 'screenshot.png'), 'utf8')).toBe(original)
  })

  it('既定の identifiers（現在の OS の homedir/username）でも動く', () => {
    const dir = makeTempDir()
    writeFileSync(join(dir, 'note.txt'), 'no secrets here')

    expect(() => sanitizeDirectory(dir)).not.toThrow()
    expect(existsSync(join(dir, 'note.txt'))).toBe(true)
  })
})
