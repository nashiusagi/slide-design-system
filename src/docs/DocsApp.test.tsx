import { act, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { DocsApp } from './DocsApp'
import { formatDocsHash } from './hash'
import { DOCS_PAGES } from './pages'

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

  it('aria-current="page" は表示中のページのリンクにしか付かない', () => {
    window.history.replaceState(null, '', formatDocsHash(second.id))

    render(<DocsApp />)

    const current = screen.getAllByRole('link').filter((link) => link.getAttribute('aria-current') === 'page')

    expect(screen.getAllByRole('link').length).toBeGreaterThan(1)
    expect(current).toHaveLength(1)
    expect(current[0]).toHaveAttribute('href', formatDocsHash(second.id))
  })
})
