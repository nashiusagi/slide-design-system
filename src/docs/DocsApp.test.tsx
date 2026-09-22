import { act, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { DocsApp } from './DocsApp'
import { formatDocsHash } from './hash'
import { RULES_PAGE_ID } from './page-ids'
import { DOCS_PAGES } from './pages'
import { RULES, ruleSectionId } from './rules'

beforeEach(() => {
  window.history.replaceState(null, '', '/')
})

describe('DocsApp', () => {
  it('hash が無いときは先頭のページを表示する', () => {
    render(<DocsApp />)

    expect(screen.getByRole('heading', { level: 1, name: DOCS_PAGES[0].title })).toBeInTheDocument()
  })

  it('未知のページ ID の hash でも、本文を空にせず先頭のページへ落とす', () => {
    window.history.replaceState(null, '', '#/unknown-page')

    render(<DocsApp />)

    expect(screen.getByRole('heading', { level: 1, name: DOCS_PAGES[0].title })).toBeInTheDocument()
  })

  it('表示中のページの nav リンクに aria-current="page" が付く', () => {
    window.history.replaceState(null, '', '#/foundations')

    render(<DocsApp />)

    const current = screen.getAllByRole('link').filter((link) => link.getAttribute('aria-current') === 'page')

    expect(current).toHaveLength(1)
    expect(current[0]).toHaveAttribute('href', '#/foundations')
  })

  /*
   * hash → ページ解決 → 本文の描画までを1本通す。#38 の完了条件（`#/rules` でルールを
   * 確認できる）は、ページを `DOCS_PAGES` へ登録して初めて満たされるが、ページ側のテストは
   * `<Rules />` を直接描くので登録を見ていない。登録の行を落としても、この検査が無ければ
   * すべて緑のまま `#/rules` が先頭ページへ落ちる。
   *
   * 対象のページを名指しするのは、完了条件がそのページについて書かれているからだ。ルールの
   * 節 ID が描かれることまで見るのは、ページ名の一致だけだと本文が空でも通るため。
   */
  it('#/rules の hash で、検査ルールのページが解決されて各ルールの節が描かれる', () => {
    window.history.replaceState(null, '', formatDocsHash(RULES_PAGE_ID))

    const { container } = render(<DocsApp />)

    expect(RULES.length).toBeGreaterThan(0)
    expect(container.querySelectorAll('.doc-rule')).toHaveLength(RULES.length)

    for (const rule of RULES) {
      expect(container.querySelector(`#${CSS.escape(ruleSectionId(rule.id))}`), `${rule.id} の節が無い`).not.toBeNull()
    }
  })

  it('hashchange を購読し、アンマウントで解除する', () => {
    const addEventListener = vi.spyOn(window, 'addEventListener')
    const removeEventListener = vi.spyOn(window, 'removeEventListener')

    const { unmount } = render(<DocsApp />)

    const registered = addEventListener.mock.calls.find(([type]) => type === 'hashchange')
    expect(registered).toBeDefined()

    unmount()

    expect(removeEventListener).toHaveBeenCalledWith('hashchange', registered?.[1])

    addEventListener.mockRestore()
    removeEventListener.mockRestore()
  })

  /*
   * ここから下は、2枚目のページ（#35 の `layouts`）が入って初めて固定できるようになった
   * 3件。先頭以外のページを返す分岐は、2枚目ができるまで一度も通らなかった。
   *
   * 対象を id で名指しせず `DOCS_PAGES` の2件目から引くのは、ページ一覧のどちらが先頭かを
   * このテストが決めてしまわないため。並びが変わっても「先頭以外へ到達できる」ことだけが
   * 残る。
   */
  const second = DOCS_PAGES[1]

  it('先頭以外のページの hash が、そのページを表示する', () => {
    expect(second).toBeDefined()

    window.history.replaceState(null, '', formatDocsHash(second.id))

    render(<DocsApp />)

    expect(screen.getByRole('heading', { level: 1, name: second.title })).toBeInTheDocument()
  })

  it('hashchange で、表示されるページが切り替わる', () => {
    render(<DocsApp />)

    expect(screen.getByRole('heading', { level: 1, name: DOCS_PAGES[0].title })).toBeInTheDocument()

    act(() => {
      window.history.replaceState(null, '', formatDocsHash(second.id))
      window.dispatchEvent(new HashChangeEvent('hashchange'))
    })

    expect(screen.getByRole('heading', { level: 1, name: second.title })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 1, name: DOCS_PAGES[0].title })).not.toBeInTheDocument()
  })

  /*
   * 節つきの hash（DR-0048）。部品ページの allowedIn から張るリンクがこの形で、外れると
   * リンクは付いたまま先頭ページへ落ちる。
   */
  it('節つきの hash でも、そのページが表示される', () => {
    window.history.replaceState(null, '', formatDocsHash(second.id, 'any-section'))

    render(<DocsApp />)

    expect(screen.getByRole('heading', { level: 1, name: second.title })).toBeInTheDocument()
  })

  it('hash が指す節が在れば、そこへスクロールする', () => {
    const target = document.createElement('div')
    target.id = 'scroll-target'
    const scrollIntoView = vi.fn()
    target.scrollIntoView = scrollIntoView
    document.body.appendChild(target)

    try {
      window.history.replaceState(null, '', formatDocsHash(second.id, 'scroll-target'))

      render(<DocsApp />)

      expect(scrollIntoView).toHaveBeenCalled()
    } finally {
      target.remove()
    }
  })

  /*
   * 契約を消すと、その節を指す古いリンクは行き先を失う。落とさずページを出す——空白の画面より
   * ページが出た方がよい（DR-0048）。
   */
  it('hash が指す節が無くても落ちず、ページを表示する', () => {
    window.history.replaceState(null, '', formatDocsHash(second.id, 'missing-section'))

    render(<DocsApp />)

    expect(screen.getByRole('heading', { level: 1, name: second.title })).toBeInTheDocument()
  })

  it('aria-current="page" は表示中のページのリンクにしか付かない', () => {
    window.history.replaceState(null, '', formatDocsHash(second.id))

    render(<DocsApp />)

    const current = screen.getAllByRole('link').filter((link) => link.getAttribute('aria-current') === 'page')

    expect(screen.getAllByRole('link').length).toBeGreaterThan(1)
    expect(current).toHaveLength(1)
    expect(current[0]).toHaveAttribute('href', formatDocsHash(second.id))
  })
})
