# slide-design-system

スライドを「設計契約 → AI 生成 → 機械検査 → 修正」のループで作る環境。

[デザインハーネス](https://design-harness.com/)の方法論を、業務画面（[Atlas Design System](https://github.com/lumilinks-hq/atlas-design-system)）からスライド領域へ移植する。同じお題を「設計契約なし」と「契約あり」で AI に生成させ、その差と修正過程を比較する。

## 何を確かめるか

AI が生成したスライドの妥当性を、印象ではなく**機械判定**で担保できるか。

スライドには、業務画面には無い検査可能性がある。固定キャンバスを使うため、**要素がキャンバスからはみ出したかを実測で判定できる**。プレゼンで最も多い事故（文字が枠外へ出る、表が切れる）を、生成のたびに自動で検出できる。

## 進め方

- Phase 1 — AI に書かせる Harness。契約・検査・修正ループを作る
- Phase 2 — 人間がオーサリングする環境。人間は deck 契約を書き、実装は AI が生成する

根拠は [DR-0001](./docs/decisions/0001-phase-1-is-ai-harness.md)。

## 開発

Node.js 22 以上と pnpm が要る。

```bash
pnpm install
npx playwright install chromium  # pnpm measure が使うブラウザ本体。初回のみ
pnpm dev              # 開発サーバ
pnpm build            # dist/index.html + dist/assets/ を出力
pnpm theme:generate   # design/tokens.json から design/theme.css を生成
pnpm measure          # dist/ を実測し measurements.json を出力（要 pnpm build。DR-0011）
pnpm check            # design:check → theme:check → typecheck → lint → test → build
```

`design/theme.css` は生成物なので直接編集しない。トークンを変えたら `pnpm theme:generate` を実行する。
`pnpm check` の `theme:check` が、theme.css とトークンの乖離、および記録済みのコントラスト算出値と再計算の乖離を検出する。

出力形式の根拠は [DR-0022](./docs/decisions/0022-plain-vite-build-output.md)、足場の構成は [DR-0027](./docs/decisions/0027-build-scaffold-workspace-and-test-stack.md)。

検査の実行口は `pnpm check` に一本化する。契約に基づく検査は、この並びの中へ足していく。契約自体の検証は先頭の `design:check` / `theme:check` 段へ、lint は `lint` 段へ、measure はビルド出力に対して実測するため `build` より後段へ置く。

**現時点では `pnpm measure` を `pnpm check` へ組み込んでいない。** `src/App.tsx` はまだ `design/theme.css` / `design/layout.css` を読み込んでおらず、実測すると既存のプレースホルダ表示（ブラウザ既定のフォントサイズ・余白）が no-overflow / min-font-size に落ちる。App が設計契約を実際に消費するようになった時点で `check` の build 後段へ足す。根拠は [DR-0038](./docs/decisions/0038-defer-measure-in-check.md)。

**「実測」はビルド出力をブラウザ上で測ること（measure 系）を指す。** トークンの数値から計算して求めるコントラストや色相差は「算出値」と呼び、区別する。算出値はビルドを要さないので先頭の段に置く。

`pnpm check` が通ることは、どの Issue でも共通の必要条件であり、個々の Issue を終えてよいかは Issue の完了条件で判定する。

根拠は [DR-0028](./docs/decisions/0028-single-check-entry-point.md)。

## 正本の在り処

| パス | 内容 |
| --- | --- |
| `DESIGN.md` | AI が最初に読む設計方針。北極星、Do / Don't、衝突時の優先順位 |
| `design/tokens.json` | color / space / type / radius / shadow / canvas |
| `design/theme.css` | `design/tokens.json` から生成した `--dh-*`。直接編集しない |
| `design/layouts/` | スライドのレイアウト契約 |
| `design/layout.css` | レイアウトの実装。クラス名と値は `design/layouts/` の契約に従う |
| `design/components/` | スライド内部品の契約 |
| `design/decks/` | 発表ごとの構成（deck 契約） |
| `design/rules.json` | 検査ルール（lint / measure / review） |
| `design/schemas/` | 契約自体を検証する JSON Schema |
| `docs/decisions/` | 決定記録（DR）。なぜそう決めたか、何を却下したか |
| `docs/PUBLICATION_POLICY.md` | 公開してよいもの／してはいけないものの基準 |
| `experiments/` | お題、共通 starter、保存済み Run |
| `skills/slide-harness/` | AI が契約に従って実装するための Agent Skill |

設計データは正本にのみ置く。Skill やドキュメントへ複製しない。

## 検査

| method | 手段 | 見るもの |
| --- | --- | --- |
| lint | ESLint（自作プラグイン） | 契約外の layout / component、トークンを経由しない色・長さ、deck 契約との不一致 |
| measure | Playwright（ビルド出力に対して実測） | キャンバスからのはみ出し、フォントサイズ下限、コントラスト、deck 契約の素材との一致 |
| review | 人 | 1 枚 1 メッセージか、話の順序が通っているか |

`review` とされた項目は自動合否にせず、画面を見て人が判断する。

根拠は [DR-0011](./docs/decisions/0011-lint-and-measure.md)。

## 実験

生成は Claude Code のサブエージェントを明示的に起動して行う。**スクリプトは AI を起動しない。** 担当はワークスペースの用意、Run の保存、検査、採点、比較まで。

生成は 1 回だけ、採点は何度でも再実行できる。ルールを追加したとき、保存済み Run へ遡って効き目を確認できる。

根拠は [DR-0019](./docs/decisions/0019-claude-only-runner.md) / [DR-0020](./docs/decisions/0020-scripts-do-not-invoke-ai.md)。

## 公開時の注意

公開してよいもの／してはいけないものの基準は [`docs/PUBLICATION_POLICY.md`](./docs/PUBLICATION_POLICY.md) を参照。実行コマンドは `pnpm public:sanitize` / `pnpm public:audit`（`pnpm check` に組み込み済み）。根拠は [DR-0023](./docs/decisions/0023-public-repo-with-audit.md)。

## 決定記録

このプロジェクトの意思決定は [`docs/decisions/`](./docs/decisions/) に記録している。索引は [`docs/decisions/README.md`](./docs/decisions/README.md)。

デザインの値（色、閾値）は DR に複製せず、`DESIGN.md` / `design/tokens.json` / `design/rules.json` を正本とする。
