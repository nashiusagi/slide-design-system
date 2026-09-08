# DR-0035: layout / component 契約は役割の選択基準と slots / allowedIn の対応で書く

- **状態**: 承認済み
- **日付**: 2026-09-08
- **関連**: [DR-0009](./0009-five-layer-contract.md), [DR-0010](./0010-three-layouts.md), [DR-0018](./0018-plain-css-with-tokens.md), [DR-0030](./0030-slide-class-derived-from-layout.md)
- **正本**: `design/layouts/`, `design/components/`, `design/schemas/layout.schema.json`, `design/schemas/component.schema.json`

## 文脈

[DR-0009](./0009-five-layer-contract.md) は `layouts` / `components` という層があることを決め、[DR-0010](./0010-three-layouts.md) は「見た目ではなく役割で選ぶ契約にする」という方針を決めた。しかし具体的にどんなフィールドを持つ JSON にするかは、#5 でこの2層を実装するまで決まっていなかった。

Phase 1.5 で layout / component が増える（[DR-0010](./0010-three-layouts.md) の帰結）ため、後から追加する契約が同じ形に従えるよう、ここで形自体を決めて残す必要がある。

## 決定

**layout 契約**は `name` / `role` / `whenToUse` / `whenNotToUse` / `classes` / `slots` を持つ。`whenToUse` と `whenNotToUse` を両方必須にし、どちらも配列で複数書けるようにする。`classes` は [DR-0030](./0030-slide-class-derived-from-layout.md) が定める `slide--<layout>` のみを持つ。`slots` は、その layout が使う component 名と、必須かどうか・最大個数を書く。

**component 契約**は `name` / `role` / `allowedIn` / `usage` / `props` を持つ。`allowedIn` はその component が使ってよい layout 名の配列。`props` は `{ プロパティ名: { type, required, description } }` という平坦なオブジェクトで、実装（React コンポーネントの型）はここでは持たない。`type` は `string` / `string[]` のみを許す。Phase 1 の4 component が要求する値は、見出しや本文の文言（`string`）か、箇条書きの項目（`string[]`）のどちらかで表現でき、真偽値や数値を要求する component がまだ無いため、現時点で必要な範囲に絞った。

**layout の `slots` と component の `allowedIn` は同じ対応関係を両側から書く。** `pnpm design:check` は両方向の矛盾を検査する。`slots` → `allowedIn` 方向（`slots` が参照する component 名が無い、`allowedIn` に layout が無い）と、`allowedIn` → `slots` 方向（`allowedIn` が参照する layout 名が無い、その layout の `slots` に自分が無い）の両方を見る。片方向だけだと、「実際には使われていない layout を `allowedIn` に書いてしまう」誤りを検出できない。

## 理由

- **`whenToUse` / `whenNotToUse` を両方必須にすると、選択基準を書く場所が強制される。** 片方だけだと「使うとき」は書いても「使わないとき」の線引きが曖昧なまま残りやすい。3 レイアウトが役割で重ならないためには両方向の記述が要る
- **`classes` を `slide--<layout>` 1 つに絞ったのは、[DR-0030](./0030-slide-class-derived-from-layout.md) が実装スコープをそこまでと決めているため。** region ごとの子クラスまで契約に持たせると、まだ存在しない component 実装の DOM 構造を先取りして決めることになり、契約が実装より先に固まってしまう
- **`slots` と `allowedIn` を両側に書くのは、AI が契約を読む入り口を揃えるため。** layout を選ぶときは `slots` から使える component が分かり、component を選ぶときは `allowedIn` から使える layout が分かる。どちらか一方だけだと、逆方向から読むときに他方のファイルを探しに行くことになる
- **両側に書く以上、矛盾しうる。** 矛盾を機械検査するのは、[DR-0009](./0009-five-layer-contract.md) の帰結（契約と実装の整合を保つ仕組みが要る）と同じ理由による
- **`props.type` を `string` / `string[]` に絞ったのは、まだ来ていない要求に備えないため。** 4 つの component の `props` はすべてこの2値で表現できる。真偽値や数値の prop が実際に要る component が出てきた時点で、この DR を更新してから schema の enum を広げる

## 検討した他の選択肢

### `slots` だけを持ち、component 側は `allowedIn` を持たない

契約を書く量が減る。

**却下理由**: component の契約だけを読んでも、どの layout で使えるかが分からない。AI が component から先に選ぶ経路（例えば「箇条書きを使いたい」から入る）で、使える layout を探すのに layout 契約を総当たりすることになる。

### layout の中に component の props まで埋め込む（component を独立した層にしない）

1 ファイルで完結する。

**却下理由**: [DR-0009](./0009-five-layer-contract.md) が component を独立した層と決めている。埋め込むと同じ component が複数 layout に登場したときに props の定義が重複し、片方だけ直す抜け漏れが生まれる。

### `classes` に region ごとの子クラスまで含める

layout.css が region 単位でスタイルを持てる。

**却下理由**: [DR-0030](./0030-slide-class-derived-from-layout.md) の実装スコープ（`slide--<layout>` のみ）を超える。component の DOM 構造は別 Issue が決めるべきで、layout 契約が先回りして決めると、component 実装時に契約を作り直すことになる。

### `props.type` に真偽値・数値・enum なども許す

将来の component がどんな prop を要求しても対応できる。

**却下理由**: Phase 1 の4 component はいずれも文字列かその配列しか要求しない。来ていない要求に備えて型の種類を広げると、AI がまだ使われない型を選んで実装との対応が無い prop を作る余地が生まれる。

## 帰結

- Phase 1.5 で layout / component を追加するときも、この5フィールド（layout）・5フィールド（component）の形に従う。形を変えるときはこの DR を置き換える
- component の実際の React 実装（`props` が実際の TypeScript の型とどう対応するか）は別 Issue で決める。ここで決めたのは契約が AI に見せる形であって、実装の型ではない
- `slots` と `allowedIn` の対応が矛盾していないことは `pnpm design:check` が両方向から検査する。検査対象が増えたら（layout や component が増えたら）、`scripts/validate-design.mjs` の `LAYOUT_NAMES` / `COMPONENT_NAMES` に 1 行ずつ足す。`CONTRACTS` はこの一覧から導出しているため個別の追記は要らない
- `design/schemas/layout.schema.json` / `component.schema.json` の `name` / `allowedIn` / `slots.component` の enum は JSON Schema の静的な列挙であり、`LAYOUT_NAMES` / `COMPONENT_NAMES` からは自動生成していない。layout / component を増減させるときは、両方のスキーマの enum も合わせて更新すること
