---
name: slide-harness
description: このリポジトリの設計契約（DESIGN.md / design/）に従ってスライドを実装、または既存の実装をレビューする。Issue をスライドの生成・修正タスクへ落とすときや、契約あり/契約なしの比較実験で生成を行うときに使う。
---

# Slide Harness

設計契約を実装契約として使う。**この Skill の中に契約の中身（色・数値・layout や component の説明文）を複製しない。** 契約は常に `DESIGN.md` / `design/` を正本として参照する（DR-0013）。

## 実装前に

1. Issue を確認する。何を作るか、完了条件は何かを読む。曖昧な判断が要り、それがスライドの構成や中身を左右するときは、`DESIGN.md` の「衝突したときの優先順位」に従って決め、選んだ理由と代替案を最終報告に書く。**実行は非対話が前提であり、生成の途中で人に質問しても誰も答えられない。**
2. リポジトリ直下の `DESIGN.md` を読む。
3. 解決済みの契約があれば読む。

   `HARNESS_RESOLVED.json`

   無ければ、このタスクが必要とする deck / layout / component を manifest として用意し、解決する。

   `node scripts/resolve-design-contract.mjs <manifest.json>`

   manifest の形は `{ "decks": [...], "layouts": [...], "components": [...] }`。deck を指定すると、その deck が使う layout と component は自動で解決結果へ含まれる。少なくとも一つの参照が要る。

4. 解決結果の `resources` に列挙されたファイルだけを読む。存在しない deck・layout・component 参照は `resolve-design-contract.mjs` がエラーで止める。エラーが出たら manifest 側を直す。契約側を無いままにして先へ進まない。

## 実装

1. 使う layout は `design/layouts/*.json` の `whenToUse` / `whenNotToUse` に基づいて選ぶ。見た目の好みで選ばない。deck 契約（`design/decks/*.md`）があるときは、そこで宣言された `layout` にそのまま従う。
2. `design/layout.css` が定義するクラス名（`slide--<layout>`)をそのまま使う。同じ見た目を独自の CSS で再実装しない。
3. 色・余白・文字サイズは `design/theme.css` の `--dh-*` トークンだけを経由する。生の色値・生の px 値を書かない。
4. スライド内部品は `design/components/*.json` の `allowedIn` / `props` に従う。契約に無い部品、契約と異なる props 形状の部品を作らない。
5. Phase 1 の範囲外にあるレイアウト・部品を先取りして作らない。

## 検査と修正

1. 実装が一区切りついたら `pnpm check` を実行する。`design:check → theme:check → typecheck → lint → test → build` を一度に走らせ、契約違反・型・lint・テスト・ビルドをまとめて確認する。逐次的に個別コマンドを都度実行しない。
2. 失敗した検査を読み、実装側を直す。`design/theme.css` のような生成物は手で直さず、対応する生成スクリプト（例: `pnpm theme:generate`）を再実行する。
3. `pnpm measure` は現時点では `pnpm check` に含まれていない（DR-0038: `src/App.tsx` がまだ `design/theme.css` / `design/layout.css` を実消費していないため）。実装がキャンバス上の実測（はみ出し・最小フォントサイズ・コントラスト）に関わるときは、`pnpm build` の後に `pnpm measure` を別途実行して確認する。
4. 検査で拾えない項目（1 枚 1 メッセージになっているか、話の順序が通っているか）は人が判断する `review` 項目である（`design/rules.json` の `method: "review"`、DR-0011）。これを自動合格として報告しない。
5. すべての機械検査が通るまで、完了として報告しない。

## 出力

次を報告する。

- 対応した Issue、使った deck / layout / component の ID
- 変更したファイル
- 実行した検査とその結果。失敗して残っている項目、あるいは人の判断が要る `review` 項目
- 契約に無い判断をした箇所があれば、その理由と検討した代替案
