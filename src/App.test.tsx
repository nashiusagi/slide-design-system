import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { App } from './App'

beforeEach(() => {
  window.history.replaceState(null, '', '/')
})

describe('App', () => {
  it('1 枚目を表示する', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: 'slide-design-system' })).toBeInTheDocument()
  })

  it('仮スライドをページ送りできる', () => {
    render(<App />)

    fireEvent.keyDown(window, { key: 'ArrowRight' })

    expect(screen.getByRole('heading', { name: 'Phase 1 のランタイム' })).toBeInTheDocument()
    expect(window.location.hash).toBe('#/2')
  })
})
