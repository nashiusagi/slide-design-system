import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { CANVAS_HEIGHT, CANVAS_WIDTH } from './canvas'
import { Deck } from './Deck'
import { Fragment } from './Fragment'
import { Slide } from './Slide'

function ThreeSlides() {
  return (
    <Deck>
      <Slide layout="title" notes="発表者向けの覚書">
        <h1>1枚目</h1>
      </Slide>
      <Slide layout="bullets">
        <h2>2枚目</h2>
        <ul>
          <Fragment index={1}>
            <li>一つ目</li>
          </Fragment>
          <Fragment index={2}>
            <li>二つ目</li>
          </Fragment>
        </ul>
      </Slide>
      <Slide layout="statement">
        <p>3枚目</p>
      </Slide>
    </Deck>
  )
}

function pressNext() {
  fireEvent.keyDown(window, { key: 'ArrowRight' })
}

function pressPrevious() {
  fireEvent.keyDown(window, { key: 'ArrowLeft' })
}

beforeEach(() => {
  window.history.replaceState(null, '', '/')
})

describe('Deck', () => {
  it('最初は 1 枚目を表示する', () => {
    render(<ThreeSlides />)

    expect(screen.getByRole('heading', { name: '1枚目' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '2枚目' })).not.toBeInTheDocument()
  })

  it('→ で次のスライドへ進む', () => {
    render(<ThreeSlides />)

    pressNext()

    expect(screen.getByRole('heading', { name: '2枚目' })).toBeInTheDocument()
  })

  it('Space でも次へ進む', () => {
    render(<ThreeSlides />)

    fireEvent.keyDown(window, { key: ' ' })

    expect(screen.getByRole('heading', { name: '2枚目' })).toBeInTheDocument()
  })

  it('クリックでも次へ進む', () => {
    const { container } = render(<ThreeSlides />)

    fireEvent.click(container.querySelector('.slide-deck')!)

    expect(screen.getByRole('heading', { name: '2枚目' })).toBeInTheDocument()
  })

  it('← で前のスライドへ戻る', () => {
    render(<ThreeSlides />)

    pressNext()
    pressPrevious()

    expect(screen.getByRole('heading', { name: '1枚目' })).toBeInTheDocument()
  })

  it('修飾キーを伴う入力では動かない', () => {
    render(<ThreeSlides />)

    fireEvent.keyDown(window, { key: 'ArrowRight', metaKey: true })

    expect(screen.getByRole('heading', { name: '1枚目' })).toBeInTheDocument()
  })

  it('端では止まる', () => {
    render(<ThreeSlides />)

    pressPrevious()
    expect(screen.getByRole('heading', { name: '1枚目' })).toBeInTheDocument()

    for (let i = 0; i < 10; i += 1) {
      pressNext()
    }

    expect(screen.getByText('3枚目')).toBeInTheDocument()
    expect(window.location.hash).toBe('#/3')
  })

  it('Fragment を 1 段階ずつ出してから次のスライドへ移る', () => {
    render(<ThreeSlides />)

    pressNext()
    expect(screen.queryByText('一つ目')).not.toBeInTheDocument()

    pressNext()
    expect(screen.getByText('一つ目')).toBeInTheDocument()
    expect(screen.queryByText('二つ目')).not.toBeInTheDocument()
    expect(window.location.hash).toBe('#/2/1')

    pressNext()
    expect(screen.getByText('二つ目')).toBeInTheDocument()

    pressNext()
    expect(screen.getByText('3枚目')).toBeInTheDocument()
  })

  it('← は段階を 1 つ戻してからスライドを戻す', () => {
    render(<ThreeSlides />)

    pressNext()
    pressNext()
    pressNext()
    expect(window.location.hash).toBe('#/2/2')

    pressPrevious()
    expect(screen.queryByText('二つ目')).not.toBeInTheDocument()
    expect(window.location.hash).toBe('#/2/1')

    pressPrevious()
    pressPrevious()
    expect(screen.getByRole('heading', { name: '1枚目' })).toBeInTheDocument()
  })

  it('前のスライドへ戻ったとき、そのスライドの段階数を超えて進めない', () => {
    render(<ThreeSlides />)

    // 2 枚目で段階を最後まで出してから 1 枚目へ戻る。
    pressNext()
    pressNext()
    pressNext()
    pressPrevious()
    pressPrevious()
    pressPrevious()

    expect(screen.getByRole('heading', { name: '1枚目' })).toBeInTheDocument()

    // 1 枚目は Fragment を持たないので、次の 1 回で 2 枚目へ移る。
    pressNext()

    expect(screen.getByRole('heading', { name: '2枚目' })).toBeInTheDocument()
    expect(window.location.hash).toBe('#/2')
  })

  it('位置を URL へ書き、履歴は積まない', () => {
    render(<ThreeSlides />)

    const before = window.history.length

    pressNext()

    expect(window.location.hash).toBe('#/2')
    expect(window.history.length).toBe(before)
  })

  it('hash が指すスライドから始まる（リロード後の復帰）', () => {
    window.history.replaceState(null, '', '#/3')

    render(<ThreeSlides />)

    expect(screen.getByText('3枚目')).toBeInTheDocument()
  })

  it('hash が指す段階から始まる', () => {
    window.history.replaceState(null, '', '#/2/2')

    render(<ThreeSlides />)

    expect(screen.getByText('一つ目')).toBeInTheDocument()
    expect(screen.getByText('二つ目')).toBeInTheDocument()
  })

  it('範囲外の hash は端へ丸める', () => {
    window.history.replaceState(null, '', '#/99')

    render(<ThreeSlides />)

    expect(screen.getByText('3枚目')).toBeInTheDocument()
    expect(window.location.hash).toBe('#/3')
  })

  it('書式に合わない hash は 1 枚目から始める', () => {
    window.history.replaceState(null, '', '#/nowhere')

    render(<ThreeSlides />)

    expect(screen.getByRole('heading', { name: '1枚目' })).toBeInTheDocument()
  })

  it('URL の書き換えに追従する', async () => {
    render(<ThreeSlides />)

    window.location.hash = '#/3'

    await waitFor(() => {
      expect(screen.getByText('3枚目')).toBeInTheDocument()
    })
  })

  it('同じスライド内で URL を書き換えても、そのあと段階送りが効く', async () => {
    render(<ThreeSlides />)

    pressNext()
    expect(screen.getByRole('heading', { name: '2枚目' })).toBeInTheDocument()

    window.location.hash = '#/2/1'
    await waitFor(() => {
      expect(screen.getByText('一つ目')).toBeInTheDocument()
    })

    pressNext()

    expect(screen.getByText('二つ目')).toBeInTheDocument()
    expect(screen.queryByText('3枚目')).not.toBeInTheDocument()
  })

  it('表示中に書式外の hash を書かれても表示は動かさず、URL を現在位置へ戻す', async () => {
    render(<ThreeSlides />)

    pressNext()
    expect(window.location.hash).toBe('#/2')

    window.location.hash = '#/nowhere'

    await waitFor(() => {
      expect(window.location.hash).toBe('#/2')
    })
    expect(screen.getByRole('heading', { name: '2枚目' })).toBeInTheDocument()
  })

  it('段階数を DOM へ出す', () => {
    const { container } = render(<ThreeSlides />)

    const deck = container.querySelector<HTMLElement>('.slide-deck')!

    expect(deck.dataset.stepCount).toBe('0')

    pressNext()

    expect(deck.dataset.stepCount).toBe('2')
  })

  it('キャンバスは固定寸法を持ち、倍率を transform で当てる', () => {
    const { container } = render(<ThreeSlides />)

    const canvas = container.querySelector<HTMLElement>('.slide-canvas')!

    expect(canvas.style.width).toBe(`${CANVAS_WIDTH}px`)
    expect(canvas.style.height).toBe(`${CANVAS_HEIGHT}px`)
    expect(canvas.style.transform).toMatch(/^scale\([\d.]+\)$/)
  })

  it('layout に対応するクラスを当て、notes は DOM へ出さない', () => {
    const { container } = render(<ThreeSlides />)

    const slide = container.querySelector('.slide')!

    expect(slide.className).toBe('slide slide--title')
    expect(screen.queryByText('発表者向けの覚書')).not.toBeInTheDocument()
    // テキストとして出ていないだけでなく、DOM 属性にも出ていないこと。素のビルド出力
    // （DR-0022）を公開したときにページのソースから読めては意味が無い（DR-0004）。
    expect(slide.outerHTML).not.toContain('発表者向けの覚書')
  })
})
