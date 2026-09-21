# DR-0050: 部品は `src/components/` に React コンポーネントとして実装し、クラス名は契約名から取る

- **状態**: 承認済み
- **日付**: 2026-09-21
- **関連**: [DR-0007](./0007-north-star.md), [DR-0011](./0011-lint-and-measure.md), [DR-0018](./0018-plain-css-with-tokens.md), [DR-0021](./0021-starter-contains-runtime-only.md), [DR-0029](./0029-position-in-url-and-explicit-fragment-index.md), [DR-0030](./0030-slide-class-derived-from-layout.md), [DR-0035](./0035-layout-component-contract-shape.md), [DR-0037](./0037-eslint-plugin-slide-rule-scope.md), [DR-0038](./0038-defer-measure-in-check.md), [DR-0039](./0039-experiment-starter-checked-against-root-scaffold.md), [DR-0041](./0041-postcss-for-layout-class-check.md), [DR-0042](./0042-design-catalog-as-separate-build-entry.md), [DR-0049](./0049-catalog-detects-implementation-by-registry.md)
- **実装**: `src/components/`, `scripts/validate-design.mjs`（`checkComponentClasses`）, `packages/eslint-plugin-slide/src/rules/component-approved.mjs`, `eslint.config.js`

## 文脈

`design/components/` には部品の契約があるが、実装が無い。[DR-0035](./0035-layout-component-contract-shape.md) は契約の形を決めたうえで、「実際の React 実装（`props` が実際の TypeScript の型とどう対応するか）は別 Issue で決める」を帰結に残していた。ここがその別 Issue（#37）にあたる。

決めることは2つある。**どこへ置くか**と、**どんな形で公開するか**である。

置き場所には外から条件が3つ掛かっている。

1. [DR-0021](./0021-starter-contains-runtime-only.md) は starter にスライド機構（`src/runtime/`）までを共通で入れ、契約は Harness 条件にだけ渡すと決めている。部品を `src/runtime/index.ts` から公開すると Baseline 条件が契約の実装を手に入れ、実験で測りたい条件差が壊れる
2. [DR-0049](./0049-catalog-detects-implementation-by-registry.md) は、カタログが部品を登録表で引くと決めたうえで「カタログから参照できる場所であること」だけを条件として残した
3. [DR-0042](./0042-design-catalog-as-separate-build-entry.md) は、カタログ（`src/docs/`）とスライド本体（`src/App.tsx` / `src/runtime/`）が互いを参照しないと決めている

形のほうにも既存の前提がある。`component-approved` というルールの名前と役割は [DR-0011](./0011-lint-and-measure.md) が決めたが、**その検出方法を決めたのは [DR-0037](./0037-eslint-plugin-slide-rule-scope.md) である。** あちらは「まだ無い実装を前提にしない」ために検査を絞り、契約名を PascalCase にした JSX 要素の再定義と `allowedIn` との対応だけを見る形にした。正規の実装を import して使う前提で書かれており、DOM 構造を検査する版は「component の React 実装が入る Issue で改めて検討する」と保留されている。この Issue がその Issue にあたる。

## 決定

### 1. 置き場所は `src/components/`

`src/runtime/` でも `src/docs/` でもない、両方から読める第3の場所に置く。`src/runtime/index.ts` からは公開しない。starter へ複製する対象（`scripts/prepare-workspace.mjs` の `MIRRORED_SRC_FILES`）にも入れない。

### 2. 形は React コンポーネント

CSS クラスだけを提供する形は取らない。契約の `props` を TypeScript の型として持ち、契約名を PascalCase にした名前で公開する。

契約の `props.type` と実装の型は原則そのまま対応させる。**例外は `statement` の `text` だけで、ここは `ReactNode` で受ける。** `statement` レイアウトの `slots` は `emphasis` を任意で1つ許しており（[DR-0035](./0035-layout-component-contract-shape.md)）、`emphasis` は他の部品の中へ埋め込んで使う部品だ。埋め込める先はこの部品しかないので、`string` で受けると契約が許している組み合わせを実装が作れなくなる。他の部品は `emphasis` を伴うレイアウトを `allowedIn` に持たないため、契約どおりの型で受ける。

### 3. クラス名は契約名そのもの

部品契約は `classes` を持たない（[DR-0035](./0035-layout-component-contract-shape.md)）。クラス名は実装側が決めることになるので、規則をここで固定する——契約名をそのままクラス名にする。レイアウトの `slide--<layout>`（[DR-0030](./0030-slide-class-derived-from-layout.md)）とは綴りで区別が付く。

対応が過不足なく取れていることは `pnpm design:check`（`checkComponentClasses`）が検査する。判定はレイアウト側（`checkLayoutClasses`）と同じ構文木の見方（[DR-0041](./0041-postcss-for-layout-class-check.md)）を使う。

### 4. スタイルは `design/` へ置かない

部品の CSS（`src/components/components.css`）は実装の一部として実装と同じ場所に置き、`design/` へは置かない。読み込むのは使う側で、実装のモジュールからは読み込まない。

### 5. `component-approved` は、正規の実装だけ再定義の検査を外す

契約名の定義をどこにも作れないままでは、import して使う相手が存在しない。正規の実装がどこに在るかはルールオプション（`implementsContractsIn`、値はディレクトリ）で外から与え、`eslint.config.js` が持つ。`allowedIn` の判定は外さない。

**外すのは、そのファイル自身の契約名1つだけにする。** オプションを持つファイルで全契約名の再定義を許すと、正規の実装の置き場所でありさえすれば契約名を無関係な実装で埋められ、このルールの半分がその置き場所で消える。

**どのファイルが自分の契約名を名乗れるかは、パス全体で決める。** 指定されたディレクトリの直下にある `<契約名>.<拡張子>` という形にちょうど一致したときだけ外す。ベースネームだけで見ると、`Statement.mock.tsx` や入れ子の `variants/Statement.tsx` が同じ名前を名乗れてしまい、「正規の実装は1つ」という前提が崩れる。

### 6. DOM 構造の検査は、いまは足さない

[DR-0037](./0037-eslint-plugin-slide-rule-scope.md) が保留した「`component-approved` に DOM 構造の検査を足すか」は、足さないと決める。

代わりに、各部品が描く要素をこの DR が記録する。見出しは `h1`、箇条書きは順序を持たない `ul`、結論は `p`、強調は `strong` にする。見出しを `h1` にするのは、スライドが1枚ずつ描かれ、その主題がそのビューの最上位の見出しになるからだ。カタログのプレビューは実物をそのまま描く場所（[DR-0049](./0049-catalog-detects-implementation-by-registry.md)）なので、カタログの都合で階層を変えない。強調で太さを変えないのは、強調の手段を色の一点に絞るため（[DR-0007](./0007-north-star.md)）。

## 理由

- **`src/runtime/` から出すと実験が壊れる。** [DR-0021](./0021-starter-contains-runtime-only.md) の条件差は「渡す情報だけが違う」で成り立っている。部品がスライド機構と同じ口から出ていると、starter へ複製する範囲を人が毎回切り分けることになり、切り分けを誤った瞬間に Baseline が契約の実装を持つ。第3の場所なら、複製する対象の一覧（`MIRRORED_SRC_FILES`）に載っていないことがそのまま切り分けになる。しかも `src/runtime/index.ts` は starter と1文字単位で突き合わされている（[DR-0039](./0039-experiment-starter-checked-against-root-scaffold.md)）ので、ここへ部品の公開を足すと `pnpm experiment:starter:check` が落ちる——混入の経路のうち最も起こりやすいものは機械で塞がっている
- **カタログとスライド本体の両方が読む必要がある。** カタログは登録表へ実装を載せる（[DR-0049](./0049-catalog-detects-implementation-by-registry.md)）し、スライド本体は実際にスライドを組む。`src/docs/` へ置けばスライド本体が読めず、`src/runtime/` へ置けばカタログが読めない（[DR-0042](./0042-design-catalog-as-separate-build-entry.md)）。どちらでもない場所が要る
- **React コンポーネントにすると、契約が型になる。** `props` の必須・型が呼び出し側で効く。CSS クラスだけを配る形だと、契約が定めた `props` はどこにも現れず、AI も人も契約を読んで手で守ることになる。加えて `component-approved` が見ているのは契約名の JSX 要素なので、クラスだけを配る形ではこの検査が当たる対象が永久に生まれない
- **型が使い方の担保になる。** `bullet-list` の項目を `string[]` で受けると、項目の中に入れ子の構造を作れず、強調も埋め込めない。契約の使い方に書かれた制約が、読んで守るものではなく書けないものになる。`statement` だけを緩めたのは、そこだけは契約が組み合わせを許しているからだ
- **クラス名を契約名にすると、対応を機械で見られる。** レイアウトが `classes` を契約に持つのと同じ効果を、規則の側で作る。規則が無いと、実装が在るのに見た目を持たない部品を誰も検出できない——カタログの登録表は、登録が在るかどうかしか見ない（[DR-0049](./0049-catalog-detects-implementation-by-registry.md) の帰結）
- **スタイルを `design/` へ置かないのは、あちらが契約の層だからだ。** `design/layout.css` があそこに在るのは、レイアウト契約が `classes` を宣言していて、実装がそれに従っているかを検査できるからである（[DR-0030](./0030-slide-class-derived-from-layout.md)）。部品契約は `classes` を持たない。加えて `design/` のファイルは Harness 条件へ渡す資源の候補になる（`scripts/resolve-design-contract.mjs`）。部品の CSS をそこへ置くと、渡すかどうかの判断が発生し、渡せば実行済みの実験と条件が変わる。それは別の決定として起こすべきもので、実装の置き場所を決めるついでに動かしてよい線ではない
- **実装のモジュールが CSS を読み込まないのは、読み込む側の事情が違うからだ。** カタログはトークンを読み込んでいるので、部品の CSS を足せばそのまま実物の見た目になる。スライド本体はまだトークンを読み込んでおらず（[DR-0038](./0038-defer-measure-in-check.md)）、部品の CSS だけが先に載ると、値の定義されていない変数を参照した中途半端な見た目になる
- **DOM 構造の検査を足さないのは、いま塞ぎたい穴がそこに無いからだ。** [DR-0037](./0037-eslint-plugin-slide-rule-scope.md) が懸念していたのは「素の `h1` / `ul` で部品を再実装する」書き方で、その実例は `src/App.tsx` の仮スライドだけだった。この Issue でそこが契約名の要素に置き換わり、実例が消える。検査を足すなら「`Slide` の下に素の要素を書かない」という別の規則になり、レイアウトの箱・カタログのプレビューといった例外を洗い直すことになる。それはこの Issue の範囲を超える
- **`component-approved` を緩めないと実装が作れない。** あのルールは「契約名を、契約と無関係なローカル実装で埋めていないか」を見る。正規の実装はその例外にあたる唯一の場所で、例外が無いと検査が実装の存在そのものを禁じる。置き場所をルールへ書き込まずオプションにしたのは、実装の在り処を決めるのがこの DR であって検査ではないからだ。検査が場所を知っていると、置き場所を動かすたびに検査の実装を書き換えることになる

## 検討した他の選択肢

### `src/runtime/` に置き、`src/runtime/index.ts` から公開する

スライドを書く側の import 元が1つで済む。

**却下理由**: [DR-0021](./0021-starter-contains-runtime-only.md) の条件差が壊れる。starter へ複製されるのはこのディレクトリなので、Baseline 条件が契約の実装を手に入れる。比較しているものが「契約の有無」ではなくなる。

### CSS クラスだけを提供し、React コンポーネントは公開しない

実装が薄く、スライドを書く側は素の要素にクラスを付けるだけで済む。

**却下理由**: 契約の `props`（[DR-0035](./0035-layout-component-contract-shape.md)）がどこにも現れない。必須かどうかも型も、読んで守るものになる。`component-approved` が見る対象も生まれないので、`allowedIn` の検査が永久に空振りする。使い方の制約を実装で担保する手段も無くなる。

### スタイルを `design/components.css` として契約の側へ置く

`design/layout.css` と並びが揃い、契約を読む AI が実装の見本も一緒に受け取れる。

**却下理由**: 部品契約は `classes` を持たない（[DR-0035](./0035-layout-component-contract-shape.md)）ので、`design/` へ置いても契約として検査する相手が無い。実装が契約の顔をして正本の中に混ざる。さらに Harness 条件へ渡すかどうかの判断が付いて回り、渡せば実行済みの実験と条件が変わる。

### `component-approved` の検査を、契約名の再定義については外す

ルールにオプションを足さずに済む。

**却下理由**: 再定義の検出こそがこのルールの半分である。契約名を無関係なローカル実装で埋める書き方は、記法を変えて何通りも書ける（`component-approved.bypass.mjs`）。どのファイルでも埋められる状態にすると、生成されたコードが契約名を自前の実装で上書きしても誰も気付かない。

### 部品を `packages/` の別パッケージにする

スライド本体・カタログのどちらからも独立し、境界がいちばん強い。

**却下理由**: 部品は `design/theme.css` のトークンと契約に密着していて、契約の変更と同じ PR で見え方まで確かめたい。`tsconfig` とビルドの設定が増え、分離で得るものに見合わない（[DR-0042](./0042-design-catalog-as-separate-build-entry.md) が同じ理由でカタログの別パッケージ化を却下している）。

## 帰結

- 部品を1つ増やすときは、契約・実装・同名のクラス・カタログの登録表の4箇所が揃って初めて画面に出る。CSS のクラスの欠落は `pnpm design:check` が、登録表の欠落と「登録した先が契約名のクラスを描いていないこと」はカタログのテスト（`src/docs/components.test.ts` / `src/docs/pages/Components.test.tsx`）が捕まえる。[DR-0049](./0049-catalog-detects-implementation-by-registry.md) の帰結は登録表が空だった時点の記述で、「登録漏れは機械では捕まらない」はこの DR の時点では当たらない
- **契約が定めた個数の上限（`slots` の `max`）は、実装も検査も担保していない。** `Statement` が `ReactNode` を受ける以上、`Emphasis` は何個でも埋め込める。`component-approved` が見るのは `allowedIn` だけで、個数を数える実装はどこにも無い。北極星（[DR-0007](./0007-north-star.md)、強調は一色だけ）に直結する制約が、読んで守るものとして残る。個数の検査は別 Issue として起こす
- **箇条書きは、項目ごとの段階表示ができない。** `BulletList` が `ul` と `li` の生成を抱えるため、`Fragment` で `li` を1つずつ囲めない（[DR-0029](./0029-position-in-url-and-explicit-fragment-index.md) が想定した書き方のうち、この形が取れない）。`bullets` の `slots` は `bullet-list` を1つまでとしているので、部品を並べて段階を分ける逃げ道も無い。Phase 1 ではこれを取らない判断とする。項目ごとに出したくなったら、`items` の型ではなく契約の形（[DR-0035](./0035-layout-component-contract-shape.md)）から決め直す
- 部品はレイアウトのクラスを子孫セレクタで参照しない。参照すると、契約に無い軸（レイアウトごとの見え方）を部品が持つことになる。レイアウトごとに見え方を変える必要が出たら、契約の形（[DR-0035](./0035-layout-component-contract-shape.md)）から決め直す
- `src/App.tsx` は部品を使って組む。ただしトークンとレイアウトの CSS は読み込まないままなので、見た目はまだ付かない。読み込みを足す Issue が `pnpm measure` の `pnpm check` への組み込みまで持つ（[DR-0038](./0038-defer-measure-in-check.md) の帰結）
- `checkComponentClasses` は、契約名以外のクラスをすべて余りとして報告する。レイアウトの `slide--` にあたる共通の接頭辞が部品のクラス名に無く、絞り込む条件が置けないためだ。部品の見た目だけを持つファイルなので、それ以外のクラスが要る場面は無い——要るようになったら、その時点で接頭辞の規則ごと決め直す
- `implementsContractsIn` を書く場所は `eslint.config.js` だけに保つ。`src` は抑止コメントを無効にしてある（`noInlineConfig`）ので、ファイル側から自分でこの例外を名乗ることはできない
- 正規の実装のファイルは、そのディレクトリ直下の `<契約名>.<拡張子>` に限られる。同じディレクトリへ `<契約名>.<何か>.<拡張子>` を置いても、下位のディレクトリへ同名のファイルを置いても、そちらは契約名を定義できない。実装を分割したくなったら、契約名を持つファイルから他のファイルを呼ぶ形にする
