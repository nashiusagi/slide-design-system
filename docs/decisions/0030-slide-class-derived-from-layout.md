# DR-0030: Slide のクラス名は `slide slide--<layout>` として layout から導く

- **状態**: 承認済み
- **日付**: 2026-09-07
- **関連**: [DR-0018](./0018-plain-css-with-tokens.md), [DR-0021](./0021-starter-contains-runtime-only.md), [DR-0010](./0010-three-layouts.md)
- **正本**: `design/layouts/`

## 文脈

[DR-0018](./0018-plain-css-with-tokens.md) により、レイアウトはクラス名で当てる。クラス名は契約（`design/layouts/`）が定め、`design/layout.css` がその名前で実装を持つ。

一方でランタイムの `Slide` は、契約がまだ無い状態でも `layout` props からクラスを当てなければならない（[DR-0021](./0021-starter-contains-runtime-only.md)：ランタイムは設計契約から独立して動く）。`Slide` がクラス名を**どうやって決めるか**を、契約側が持つクラス名と衝突しない形で決める必要がある。

## 決定

`Slide` は `slide` と `slide--<layout>` の 2 つを当てる。`<layout>` は props の値をそのまま使い、ランタイムは値を検査しない。

`design/layouts/` の契約が持つクラス名は、この規則で導かれる名前と一致していなければならない。一致は `pnpm design:check`（#5）で検査する。

契約のファイル形式とクラス名を持つフィールドの名前は、この DR では決めない。`design/layouts/` を作る #5 が決める。

## 理由

- 導出規則が 1 本なら、契約とランタイムの一致を機械的に検査できる。`Slide` が任意のクラス名を props で受け取る形にすると、契約に無いクラスが混ざっても検出できない
- ランタイムが layout 名の一覧を持たないので、レイアウトが 3 種から増えても（[DR-0010](./0010-three-layouts.md)）ランタイムは変わらない。契約外の名前を弾くのは lint の役目（#7）
- `slide` と `slide--<layout>` を両方当てるのは、すべてのスライドに共通する箱の性質（キャンバスいっぱいに広がる）と、レイアウト固有の性質を別の場所に書けるようにするため

## 検討した他の選択肢

### 契約が持つクラス名を `Slide` に props として渡す

契約が正本であることが構造として明らかになる。

**却下理由**: ランタイムが契約に依存し、[DR-0021](./0021-starter-contains-runtime-only.md) の「Baseline へも同じランタイムを渡す」が成り立たなくなる。

### `data-layout` 属性だけを出し、CSS は属性セレクタで当てる

クラス名の導出規則が要らなくなる。

**却下理由**: [DR-0018](./0018-plain-css-with-tokens.md) が前提にしている「契約がクラス名を指定し、実装がそれを使う」という形から外れる。属性セレクタは詳細度も低く、契約側の記述と実装の対応も読みにくい。

## 帰結

- `design/layout.css`（#5）は、`design/layouts/` にある各 variant について `slide--<layout>` を実装する。variant の一覧は正本が持つ（[DR-0010](./0010-three-layouts.md) の 3 種から始まり、Phase 1.5 で増える）
- `.slide` の最低限の性質（キャンバスいっぱいに広がる箱）は `src/runtime/runtime.css` が持つ。見た目は持たない
- `Slide` は `data-layout` も併せて出す。実測検査（[DR-0011](./0011-lint-and-measure.md)）がレイアウト別に判定を切り替えるための手掛かりで、スタイルはここに当てない
