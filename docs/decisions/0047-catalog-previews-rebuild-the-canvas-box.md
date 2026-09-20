# DR-0047: カタログのプレビューは `design/layout.css` をそのまま読み、箱だけを自前で作る

- **状態**: 承認済み
- **日付**: 2026-09-20
- **関連**: [DR-0021](./0021-starter-contains-runtime-only.md), [DR-0030](./0030-slide-class-derived-from-layout.md), [DR-0042](./0042-design-catalog-as-separate-build-entry.md), [DR-0043](./0043-catalog-reads-generated-theme-css.md)
- **実装**: `src/docs/layouts.ts`, `src/docs/pages/Layouts.tsx`, `src/docs/docs.css`

## 文脈

[DR-0043](./0043-catalog-reads-generated-theme-css.md) は、カタログがトークンを「生成された CSS から読み、`var(--dh-*)` を当てて描く」と決めた。レイアウトのページを作る段になって、同じ問いがレイアウトにも現れた。プレビューの余白と配置をどこから持ってくるか、である。

スライドが実行時に見ている姿は、3つの層が重なってできている。

- `src/runtime/runtime.css` の `.slide` — 箱の性質（親いっぱいに広がる、`box-sizing: border-box`）
- `src/runtime/canvas.ts` の寸法と `Deck` が当てる倍率 — 実寸のキャンバスと、画面へ収める縮小
- `design/layout.css` の `.slide--<layout>` — 余白と配置

このうち設計契約に属するのは3つめだけだ。上2つはスライド機構（[DR-0021](./0021-starter-contains-runtime-only.md)）で、[DR-0042](./0042-design-catalog-as-separate-build-entry.md) はカタログが `src/runtime/` を参照することを禁じている。禁止は文章だけでなく ESLint の `no-restricted-imports` として効いているので、`fitScale` も `Slide` も呼べない。

つまりカタログは、機構の側を自前で用意したうえで、契約の側は読み込んだものをそのまま当てる必要がある。どこまでを自前で作るかが決めどころになる。

## 決定

### 1. 余白と配置は `design/layout.css` を読み込んで当てる

`src/docs/docs.css` が `design/layout.css` を `@import` し、プレビューの枠へ契約の `classes` をそのまま当てる。カタログ側に `.slide--*` 相当のスタイルを書かない。

クラス名は契約の `classes` から取る。[DR-0030](./0030-slide-class-derived-from-layout.md) の導出規則（`slide--<layout>`）をカタログ側で再実装しない。

### 2. 自前で作るのは箱だけ

プレビューの枠が持つものを、出所で3つに分ける。

- **実行時の `.slide`（`src/runtime/runtime.css`）から写す機構の性質は `box-sizing: border-box` だけ**とする。ここを増やさない
- **キャンバス寸法**は `design/tokens.json` の `canvas` を `var(--dh-canvas-*)` で当てる。写しではなく、トークンを読んでいる
- **境界線と背景**は、縮めた箱の範囲を読み手に見せるためのカタログ自身の装飾として持つ。`.slide` には無いもので、`.slide--*` の余白・配置には触れない

余白と配置はこのどれでもない。決定1 のとおり `design/layout.css` が決める。

### 3. 縮小は `zoom` で行い、`fitScale` は流用しない

実寸の箱を CSS の `zoom` で縮めて見せる。基礎のページがキャンバスの寸法を見せるために使っている枠（`.doc-canvas`）を、レイアウトのプレビューも共有する。

### 4. 契約は `import.meta.glob` でディレクトリごと読む

`design/layouts/*.json` をファイル名の列挙なしに読み込み、並びはパス順（名前の辞書順）にする。読み込みが0件なら例外を投げる。

## 理由

- **プレビューが「実装そのもの」でなければ、見る意味が無い。** カタログはレイアウトの現在の姿を確かめる場所だ。余白をカタログ側に書けば、`design/layout.css` を変えてもプレビューは変わらず、変わらないことに誰も気づけない
- **`fitScale` は呼べないし、呼ぶ必要も無い。** [DR-0042](./0042-design-catalog-as-separate-build-entry.md) が `src/runtime/` への参照を禁じている。加えて `fitScale` は表示領域の実測値を引数に取る関数で、使うには寸法の監視が要る。カタログのプレビューは画面いっぱいに広げるものではなく、固定の縮尺で並べれば足りる
- **縮尺を2つ持たない。** 基礎のページとレイアウトのページが別々の倍率を持つと、同じ実寸の箱が2つの大きさで並ぶ。どちらが実寸に対して何倍なのかを読み手が追えなくなる
- **`box-sizing` の写しは避けられない。** `.slide--*` は高さを親いっぱいに取る指定と `padding` を併せ持つので、`border-box` でない箱に当てると余白が枠の外へ出る。機構の側の性質を1つだけ写すことになるが、`src/runtime/` を参照できない以上ここは代えがきかない。写したことを隠さず、CSS のコメントで出所を指しておく
- **0件を例外にする。** glob のパスがずれても、ページは「契約が0件」の姿で何事もなく描かれ、件数を突き合わせるテストも `0 === 0` で通る（[DR-0043](./0043-catalog-reads-generated-theme-css.md) 決定1 の「読み込んだ CSS が空のときは例外を投げる」と同じ形の素通り）

## 検討した他の選択肢

### `src/runtime/` の `Slide` をカタログでも使う

実行時とまったく同じ DOM になり、`box-sizing` の写しも要らなくなる。

**却下理由**: [DR-0042](./0042-design-catalog-as-separate-build-entry.md) がカタログからスライド本体への参照を禁じている。参照が生えるとカタログのコードがスライドのバンドルへ入りうる経路ができ、measure が実測する対象が本番と同一の物でなくなる（[DR-0011](./0011-lint-and-measure.md) / [DR-0022](./0022-plain-vite-build-output.md)）。禁止は ESLint で効いており、例外を開けるなら DR-0042 の決定自体を覆すことになる。プレビューのために覆すほどの理由は無い。

### `src/runtime/runtime.css` だけをカタログの CSS から読み込む

`.slide` の箱の性質を写さずに済む。ESLint の禁止は `.ts` / `.tsx` にしか掛かっていないので、CSS の `@import` なら通る。

**却下理由**: lint をすり抜けるだけで、[DR-0042](./0042-design-catalog-as-separate-build-entry.md) が引いた境界を越えることに変わりはない。`.slide-deck` / `.slide-canvas` という、カタログが使わない規則も一緒に入る。写すのが `box-sizing` の1行である以上、境界を越える側の代償のほうが大きい。すり抜けられること自体は帰結へ残し、検査で塞ぐ。

### プレビューを実寸のまま置き、囲みをスクロールさせる

縮小に伴う見た目のずれ（字の丸めなど）が無くなる。

**却下理由**: レイアウトは「一枚の中で箱がどう配置されるか」を見るものなので、全体が一度に見えないと分からない。横スクロールの中では配置の比較ができない。

## 帰結

- カタログが契約の CSS を新たに読み込むときは、`src/docs/docs.css` の `@import` へ足す。カタログ側で同じ見た目を書き直さない
- 部品（#36 / #37）のプレビューも同じ形に乗る。`design/` 側の実装を読み込み、カタログが用意するのは置き場所だけにする
- `.slide` が持つ性質が増えたときは、`src/docs/docs.css` の `.doc-canvas__frame` が追随する必要がある。追随漏れはプレビューの見た目のずれとしてしか現れず、機械では捕まらない
- **この結線は片側にしか書かない。** 写した側（`src/docs/docs.css`）のコメントが `src/runtime/runtime.css` を指し、逆向きは置かない。`src/runtime/` は starter として Baseline 条件へもそのまま渡る（[DR-0021](./0021-starter-contains-runtime-only.md)）ので、カタログや設計契約を指すコメントを置くと、契約の有無という実験の条件差がコメント経由で薄まる。`.slide` を触る人がカタログ側を直す必要に気づく経路は、この DR と `docs.css` のコメントだけになる
- **カタログの CSS から `src/runtime/` を `@import` しない。** ESLint の境界検査は `.ts` / `.tsx` にしか掛かっておらず（`eslint.config.js` の `forbidCrossEntryImports`）、CSS の `@import` は素通りする。この穴は `src/docs/docs.css.test.ts` が塞ぐ
- カタログのページの並び（`src/docs/pages.ts` の `DOCS_PAGES`）は、契約の層の並び（tokens → layouts → components → rules）に置く。後続の Issue はその位置へ足す
- プレビューの中身は、部品の実装ができるまでスロットごとのプレースホルダに留める。部品の見た目をカタログ側で先取りしない
