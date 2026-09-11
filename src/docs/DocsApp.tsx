import { useEffect, useState } from 'react'

import { formatDocsHash, parseDocsHash } from './hash'
import { DOCS_PAGES, type DocsPage } from './pages'

/**
 * hash が指すページを返す。書式に合わない・未知の id のときは先頭のページ（DR-0042）。
 *
 * `DOCS_PAGES` は非空タプルなので先頭は必ず在る。ここが `undefined` を返す余地は無い。
 */
function resolvePage(hash: string): DocsPage {
  const id = parseDocsHash(hash)

  return DOCS_PAGES.find((page) => page.id === id) ?? DOCS_PAGES[0]
}

/**
 * デザインカタログの外枠（DR-0042）。
 *
 * ページ間の移動はハッシュルーティングで行う。静的ホスティングでサーバ側の
 * rewrite を前提にしないため、パスルーティングは使わない。移動は素の `<a href>`
 * に任せ、`hashchange` で表示を切り替える。履歴を積むので、ブラウザの戻る・進むが
 * そのまま効く（DR-0042。スライドのページ送りが履歴を積まない DR-0031 とは対象が違う）。
 */
export function DocsApp() {
  const [hash, setHash] = useState(() => window.location.hash)

  useEffect(() => {
    const handleHashChange = () => {
      setHash(window.location.hash)
    }

    window.addEventListener('hashchange', handleHashChange)

    return () => {
      window.removeEventListener('hashchange', handleHashChange)
    }
  }, [])

  const page = resolvePage(hash)

  return (
    <div className="docs-shell">
      <nav className="docs-nav" aria-label="カタログ">
        <p className="docs-nav__title">デザインカタログ</p>
        {DOCS_PAGES.map((item) => (
          <a
            key={item.id}
            className="docs-nav__link"
            href={formatDocsHash(item.id)}
            aria-current={item.id === page.id ? 'page' : undefined}
          >
            {item.title}
          </a>
        ))}
      </nav>

      <main className="docs-main">
        <article className="doc-page">
          <h1 className="doc-page__title">{page.title}</h1>
          <page.Body />
        </article>
      </main>
    </div>
  )
}
