import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { DocsApp } from './DocsApp'
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

  it('表示中のページの nav リンクにだけ aria-current="page" が付く', () => {
    window.history.replaceState(null, '', '#/foundations')

    render(<DocsApp />)

    const current = screen.getAllByRole('link').filter((link) => link.getAttribute('aria-current') === 'page')

    expect(current).toHaveLength(1)
    expect(current[0]).toHaveAttribute('href', '#/foundations')
  })

  /*
   * ページが1枚しかない間は、hash を変えても表示先が先頭ページのまま変わらないため、
   * 「hashchange で表示が切り替わる」ことを描画結果では確かめられない。購読そのものを
   * 固定しておき、useEffect を落とす回帰を検出できるようにする。2枚目のページが入った
   * ら（#34）、描画結果で切り替わりを確かめるテストへ置き換える。
   */
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

  it('hashchange の後も現在の hash が指すページを表示し続ける', () => {
    render(<DocsApp />)

    window.history.replaceState(null, '', '#/foundations')
    fireEvent(window, new HashChangeEvent('hashchange'))

    expect(screen.getByRole('heading', { level: 1, name: DOCS_PAGES[0].title })).toBeInTheDocument()
  })
})
