/**
 * `dist/` を配信する最小限の静的サーバ。
 *
 * vite build の出力は `<script type="module">` を使う（DR-0022）。ES Modules は
 * `file://` からの読み込みをブラウザが拒否するため、http で配信する必要がある。
 *
 * ビルド出力をブラウザで開いて測る工程が2つある（`measure-slides.mjs` の実測と、
 * `score-slide-content.mjs` の表示文字の取り出し）。同じサーバを両方が持つと、
 * 配信できる拡張子の一覧が片方だけ古くなる。
 */
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join } from 'node:path'

/** @type {Record<string, string>} */
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
}

/**
 * @param {string} distDir
 * @returns {Promise<import('node:http').Server>}
 */
export function startStaticServer(distDir) {
  const server = createServer(async (req, res) => {
    const pathname = decodeURIComponent((req.url ?? '/').split('?')[0].split('#')[0])
    const filePath = join(distDir, pathname === '/' ? '/index.html' : pathname)

    try {
      const body = await readFile(filePath)
      res.writeHead(200, { 'Content-Type': MIME_TYPES[extname(filePath)] ?? 'application/octet-stream' })
      res.end(body)
    } catch {
      res.writeHead(404)
      res.end()
    }
  })

  return new Promise((resolvePromise, rejectPromise) => {
    server.on('error', rejectPromise)
    server.listen(0, () => resolvePromise(server))
  })
}

/**
 * 立ち上げたサーバの origin（`http://127.0.0.1:<port>`）を返す。
 *
 * @param {import('node:http').Server} server
 */
export function originOf(server) {
  const address = server.address()

  if (address === null || typeof address === 'string') {
    throw new Error('静的サーバのポートを取得できない。')
  }

  return `http://127.0.0.1:${address.port}`
}
