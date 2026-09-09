# DR-0038: `pnpm measure` は、App が設計契約を消費するまで `pnpm check` へ組み込まない

- **状態**: 承認済み
- **日付**: 2026-09-09
- **関連**: [DR-0011](./0011-lint-and-measure.md), [DR-0028](./0028-single-check-entry-point.md)
- **正本**: `package.json`（`scripts.check` に `measure` が入っているかどうか）

## 文脈

Issue #8 で `scripts/measure-slides.mjs` を実装した。[DR-0028](./0028-single-check-entry-point.md) は「実測系は build の後段に置く」と決めており、「`pnpm check` に measure まで含めず、measure は別コマンドにする」という代替案を、「Issue を終えてよいかの判定から、本命の検査（`no-overflow`）が外れる」という理由で明示的に却下している。

原則通りなら、この PR で `pnpm measure` を `pnpm check` の build 後段へ組み込むべきだった。しかし実装時点で `src/App.tsx` はまだ `design/theme.css` / `design/layout.css` を読み込んでおらず（実データでの生成・比較は別 Issue のスコープ。おそらく #12「第1弾の生成と比較: harness-intro」）、ブラウザ既定のフォントサイズ・レイアウトのまま実測すると `no-overflow` / `min-font-size` が実際に落ちる。これは実装のバグではなく、検査対象がまだ実データを持たないために起きる。

## 決定

`pnpm measure` は独立コマンドとして提供し、`pnpm check` へは今は組み込まない。`src/App.tsx` が `design/theme.css` / `design/layout.css` を実際に消費するようになった時点で、[DR-0028](./0028-single-check-entry-point.md) の原則どおり build の後段へ組み込む。

## 理由

- [DR-0028](./0028-single-check-entry-point.md) が却下した代替案とは動機が異なる。あちらの却下理由は「本命の検査が Issue の完了判定から外れる」ことだったが、今回は「その本命の検査が、検査対象がまだ実データを持たない状態（プレースホルダ）に対しては、意味のある合否を返せない」という、DR-0028 が想定していなかった一時的な事情
- 今すぐ組み込んで `pnpm check` を常時赤にすると、以後の PR が持ち込む本当の失敗が、この既知の赤に紛れて見分けにくくなる。「入口が一つだと『通ったか』の意味が一つに定まる」という DR-0028 自身の狙いを、組み込むこと自体が損なう

## 検討した他の選択肢

### 今すぐ組み込み、`pnpm check` が赤いことを受け入れる

DR-0028 の原則に最も忠実。

**却下理由**: `main` が merge 直後から常時赤くなる。以降の全 PR で、その PR 固有の失敗を「既知の赤に新しい赤が混ざっていないか」という目視確認に頼ることになり、DR-0028 が「通ったかの意味を一つに定める」とした狙いを崩す。

### `src/App.tsx` に `design/theme.css` / `design/layout.css` を先取りして読み込ませる

実装すれば `pnpm check` を緑に保てる。

**却下理由**: `src/App.tsx` は「見た目は付けない。レイアウトの実装は `design/layout.css` が持ち、文言は deck 契約から来る。ここに先取りして書かない」と明記したプレースホルダ（#19 で導入）。実データでの生成・比較を担う別 Issue のスコープを先取りすることになり、フェーズスコープ違反になる。

## 帰結

- `src/App.tsx` が `design/theme.css` / `design/layout.css` を実際に消費するようになった Issue（#12 を想定）は、`pnpm measure` を `pnpm check` の build 後段へ追加することを完了条件に含める
- それまでの間、`no-overflow` 等の実測結果は `pnpm measure` を手動実行して確認する。理由と実行方法は `README.md` に明記する
