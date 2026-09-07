# DR-0033: トークンから導かれる値は生成し、`pnpm check` で再計算と突き合わせる

- **状態**: 承認済み
- **日付**: 2026-09-07
- **関連**: [DR-0008](./0008-accent-hue-purple.md), [DR-0018](./0018-plain-css-with-tokens.md), [DR-0021](./0021-starter-contains-runtime-only.md), [DR-0028](./0028-single-check-entry-point.md)
- **実装**: `scripts/generate-theme.mjs`
- **正本**: `design/tokens.json`

## 文脈

`design/theme.css` の `--dh-*` はトークンから導かれる（[DR-0018](./0018-plain-css-with-tokens.md)）。コントラストと色相差の値もトークンから導かれ、記録先は `design/tokens.json` と決まっている（[DR-0008](./0008-accent-hue-purple.md)）。

導かれる値には共通の壊れ方がある。**元を直して導出をやり直し忘れると、契約の値と実際に効く値が静かにずれる。** 記録された値の場合はさらに悪く、古いまま「基準を満たしている」と読めてしまう。

## 決定

**導かれる値は人が書かない。生成する。** そして `pnpm check` の中で、生成し直した結果と現物を突き合わせて、違えば落とす。

算出値の記録（`design/tokens.json` の `$measured`）も同じ扱いにする。`$measured` は生成側が所有し、人は編集しない。`$schema` と `$comment` は人が書く説明であり、生成器はそのまま保存する。

[DR-0008](./0008-accent-hue-purple.md) の帰結は算出値を「コメントとして記録する」と書いているが、コメントは機械が突き合わせられない。記録先を `design/tokens.json` とする点はそのままに、記録の形を `$measured` キーへ改める。

## 理由

- **ずれを検出できない記録は、無い方がまし。** 古い算出値は「検証済み」という誤った合図を出す。突き合わせがあれば、古い記録は必ず落ちる
- 突き合わせは生成と同じコードで行うので、検査のために別の実装を持たない。二重実装なら、そちらが先に腐る
- 判定は `design/rules.json` の閾値が持つ（[DR-0011](./0011-lint-and-measure.md)）。ここが持つのは「記録が再計算と一致しているか」だけで、責務が重ならない

## 検討した他の選択肢

### 算出値を生成物（`design/theme.css`）のコメントにだけ書く

正本を生成器が書き換えないので、入力と出力の関係が素直になる。

**却下理由**: 記録先を `design/tokens.json` と定めた [DR-0008](./0008-accent-hue-purple.md) の帰結に反する。トークンを読む人（と AI）が、色の値とその算出結果を同じファイルで見られる利点も失う。

### 導かれる値を人が測って書き写す

生成器が正本を書き換えない。

**却下理由**: 色を 1 つ変えるたびに全ペアを測り直すことになり、必ず抜ける。抜けても検査は通ってしまう。

## 帰結

- `design/theme.css` を直接編集しない。編集は `design/tokens.json` に対して行い、`pnpm theme:generate` で反映する
- 生成物と実測値の突き合わせは `pnpm check` の `design:check` の直後、`typecheck` より前に置く（[DR-0028](./0028-single-check-entry-point.md)）
- 今後トークンから導かれるものを足すときは、生成と突き合わせを同じスクリプトに実装する
- ランタイムが設計契約から独立して持つ値（`src/runtime/canvas.ts` のキャンバス寸法）は例外で、生成ではなく突き合わせで守る。starter のランタイムは契約を読まずに動く必要があるため（[DR-0021](./0021-starter-contains-runtime-only.md) / [DR-0004](./0004-phase-1-runtime-scope.md)）
- 突き合わせの判定は、契約を引数で受け取る純関数として書く。壊れた入力に対して必ず 1 件返ることをテストで固定する。判定とファイルの読み込みが同じ関数に入っていると、判定側の抜け道がテストから見えない
- `design/theme.css` はまだどこからも読み込まれていない。突き合わせが緑でも「実際に効いている CSS 変数がトークンと一致している」ことは言えない。配線する Issue で、生成物がビルド出力へ入っていることを確認する検査を `build` より後段へ足す
- `design/rules.json` ができるまでの間、コントラストの閾値は `scripts/validate-design.mjs` が暫定で持つ。正本は `rules.json` の `contrast` であり（[DR-0008](./0008-accent-hue-purple.md) / [DR-0011](./0011-lint-and-measure.md)）、rules.json を作る Issue（#7 / #8）で読み込みへ置き換えて暫定の表を消す
