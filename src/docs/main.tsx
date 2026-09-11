import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { DocsApp } from './DocsApp'
import './docs.css'

const container = document.getElementById('docs-root')

if (!container) {
  throw new Error('#docs-root が見つからない。docs.html の構造を確認すること。')
}

createRoot(container).render(
  <StrictMode>
    <DocsApp />
  </StrictMode>,
)
