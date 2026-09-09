import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from './App'
import './index.css'

const container = document.getElementById('root')

if (!container) {
  throw new Error('#root が見つからない。index.html の構造を確認すること。')
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
