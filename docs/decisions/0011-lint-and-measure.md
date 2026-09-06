# DR-0011: 検査は lint（静的）と measure（実測）の 2 系統で行う

- **状態**: 承認済み
- **日付**: 2026-09-06
- **関連**: [DR-0002](./0002-source-format-jsx-react.md), [DR-0006](./0006-online-sharing-first.md), [DR-0012](./0012-min-font-size.md)
- **正本**: `design/rules.json`

## 文脈

Atlas は 28 ルールを `method: lint | eval | review` に分類し、lint を ESLint で自動実行、review は人が判断していた。スライド領域では、Atlas に無い検査が可能になる。1280x720 の固定キャンバスを使うため（[DR-0004](./0004-phase-1-runtime-scope.md)）、要素が枠外へ出たかを実測で判定できる。

## 決定

2 系統を実装する。

**lint（ESLint / 静的）**
- `no-raw-color` — JSX・CSS に生の色値を書かない
- `no-raw-scale` — 生の px（余白・文字サイズ）を書かない
- `layout-approved` — 契約外の layout 名を使わない
- `component-approved` — 承認外の独自 HTML で部品を再実装しない
- `deck-conformance` — deck 契約の枚数・順序・layout 割当と一致する

**measure（Playwright / ビルド出力に対して実測）**
- `no-overflow` — キャンバスから要素がはみ出していない
- `min-font-size` — computed fontSize が下限を割っていない
- `contrast` — 実測の前景 / 背景コントラストが 4.5:1 以上

判断が分かれるもの（1 枚 1 メッセージか、話の順序が通っているか）は `review` として人が判断する。

## 理由

- lint だけでは「見た目が実際に壊れていないか」を一切判定できない
- `no-overflow` は PowerPoint にも Google Slides にも無い検査であり、プレゼンで最も多い事故（文字が枠外へ出る、表が切れる）を機械判定できる。これが本命
- オンライン共有優先（[DR-0006](./0006-online-sharing-first.md)）により密度上限のルール化余地が減った分を、実測系で補う

## 検討した他の選択肢

### lint のみ

ビルドもブラウザも不要でループが速い。

**却下理由**: 上記の通り、実際の破綻を検出できない。Harness の主張が弱くなる。

### lint + measure + VLM 評価

スクリーンショットをマルチモーダル LLM に見せ、review 項目を半自動化する。

**却下理由**: 判定が非決定的になり、「機械判定で保証する」という Harness の主張がぬるくなる。将来の選択肢としては残す。

## 帰結

- Playwright が devDependency に入る
- measure はビルド出力（`dist/`）に対して実行する。本番と同一の物を検査することになる（[DR-0022](./0022-plain-vite-build-output.md)）
- `design/rules.json` のルール ID と lint 実装の 1 対 1 対応を検査する仕組みが要る
