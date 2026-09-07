import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { App } from './App'

describe('App', () => {
  it('見出しを描画する', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: 'slide-design-system' })).toBeInTheDocument()
  })
})
