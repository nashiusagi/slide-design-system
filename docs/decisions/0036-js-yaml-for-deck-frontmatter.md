# DR-0036: deck の frontmatter パースは js-yaml で行う

- **状態**: 承認済み
- **日付**: 2026-09-08
- **関連**: [DR-0016](./0016-deck-contract-markdown.md), [DR-0017](./0017-key-message-required-body-optional.md), [DR-0032](./0032-ajv-for-contract-validation.md)
- **実装**: `scripts/lib/deck.mjs`

## 文脈

deck 契約は Markdown + YAML frontmatter で書くと決めた（[DR-0016](./0016-deck-contract-markdown.md)）。`layout` / `keyMessage` はデッキ全体・各スライドの先頭に YAML マッピングとして書かれ、パーサはそれを JSON へ正規化する必要がある。

正規表現で `key: value` の行を素朴に拾う手も検討したが、`keyMessage` はコロンを含む日本語の文になりうる（例: `keyMessage: "契約は5層: tokens, layouts, ..."`）。この形は引用符とエスケープの扱いを正しく実装しないと壊れる。YAML の構文を自前で再実装するのは、DR-0032 が ajv について却下した「検証器を持たず手書きで済ませる」と同じ理由（書き漏らしが検査したつもりを生む）で避けたい。

## 決定

**js-yaml を devDependency に入れ、frontmatter ブロックと各スライド見出しブロックのパースに使う。** js-yaml 5系は型（`dist/js-yaml.d.ts`）を自ら同梱しており `exports` の `types` 条件で解決されるため、`@types/js-yaml` は入れない。入れると別系統（4系向け）の型が重なり、実際には使われないまま残る。

## 理由

- YAML の構文（引用符、エスケープ、コロンを含む文字列）を自前で再実装せずに済む
- 実行時の依存はスクリプト側（`scripts/lib/deck.mjs`、Node 上で動くパーサ）だけで、スライドの成果物（`dist/`）には入らない（[DR-0022](./0022-plain-vite-build-output.md)）。deck 契約はビルド前に解決される側であり、ブラウザで実行されるランタイムの依存ではない
- ajv と同じ「よく使われる devDependency 1本に寄せる」方針（[DR-0032](./0032-ajv-for-contract-validation.md)）に揃う

## 検討した他の選択肢

### 正規表現で `key: value` 行を読む

依存が増えない。

**却下理由**: `keyMessage` がコロンや引用符を含む日本語の文になりうる（文脈参照）。壊れるケースをすべて手で拾うのは、YAML パーサの再実装に等しい。

### gray-matter

frontmatter 抽出に特化しており、Markdown 系のツールでよく使われる。

**却下理由**: gray-matter は「ファイル先頭の frontmatter を 1 回抽出する」ためのライブラリで、本契約が必要とする「各スライド見出しブロックも同じ YAML マッピングとして繰り返しパースする」用途には素の YAML パーサ（js-yaml）の方が素直に合う。gray-matter を使っても内部で js-yaml を呼ぶだけで、依存が1段増えるだけの違いになる。

## 帰結

- `scripts/lib/deck.mjs` の構文エラー（frontmatter が無い等）は例外として投げ、`checkDecks` がそれを1件のエラー文字列に変換する
- 正規化後の JSON が契約として妥当かどうか（`keyMessage` 必須など）は、js-yaml ではなく `design/schemas/deck.schema.json` に対する ajv 検証が持つ。パーサは構文の正規化だけを担う
