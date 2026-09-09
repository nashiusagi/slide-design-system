# DR-0039: experiments の starter はコミットして持ち、ルート足場との一致を検査する

- **状態**: 承認済み
- **日付**: 2026-09-09
- **関連**: [DR-0021](./0021-starter-contains-runtime-only.md), [DR-0027](./0027-build-scaffold-workspace-and-test-stack.md), [DR-0020](./0020-scripts-do-not-invoke-ai.md)
- **正本**: `scripts/prepare-workspace.mjs`（`checkStarterMatchesRoot` が比較するファイルの一覧）

## 文脈

[DR-0027](./0027-build-scaffold-workspace-and-test-stack.md) は「リポジトリ直下の足場と、実験の共通 starter（`experiments/`）の関係は未決」とし、「生成するか、一致を検査するか」を starter を作る Issue（#10）で決めると先送りしていた。

`experiments/harness-intro/starter/` は Baseline / Harness の両条件へ同一に渡る初期状態（[DR-0021](./0021-starter-contains-runtime-only.md)）で、ランタイム機構（`src/runtime/**`・`src/index.css`）はリポジトリ直下と中身が同じであるべきものである。両者が食い違うと、実験の外で機構を直したときに starter だけ古いまま残り、生成条件が「今のランタイム」ではなく「過去のランタイム」に対する実験になってしまう。

## 決定

`experiments/harness-intro/starter/` はリポジトリにコミットする。ルート直下の対応ファイルから都度生成するのではなく、`scripts/prepare-workspace.mjs` の `check-starter` サブコマンドが両者の内容を突き合わせ、食い違いがあれば検査を失敗させる。対象はランタイム機構（`src/runtime/**`、`src/index.css`）に限る。`src/App.tsx` は対象にしない。starter 側は AI が書き換える空の初期状態であり、ルート側は動作確認用の見本（#19）で、両者は意図的に中身が異なる。

この検査は `pnpm experiment:starter:check` として独立に実行でき、`pnpm check` の静的検査の段（`design:check` の直後）に組み込む。

## 理由

- **コミットされた starter が要る。** 実験の再現性のために、ある Run がどの starter に対して生成されたかを後から読める必要がある。都度生成にすると、生成した時点のスナップショットが残らない
- **生成ではなく一致検査を選ぶ。** starter はテンプレートであり、`design/theme.css`（DR-0033）のような「値から導出される生成物」ではない。生成にすると、生成スクリプト自体が「ルートのどのファイルを、どう変換して starter に写すか」というもう一段のロジックを持つことになり、単純な一致検査より複雑になる
- 「生成し、生成物を検査する」という手法（DR-0033）と「実装をコミットし、対応する別の実装と一致するか検査する」という手法（`checkCanvasMatchesRuntime` / `checkLayoutClasses`、DR-0021・DR-0018）の両方が既にこのリポジトリにあり、starter は後者の形に近い

## 検討した他の選択肢

### `prepare-workspace.mjs` がワークスペース用意のたびにルートから生成する

`experiments/harness-intro/starter/` というディレクトリ自体を持たず、実行時にルートの `src/runtime/**` 等を読んでワークスペースへ書き出す。

**却下理由**: starter というコミットされた実体が無くなる。ある Run がどの starter に対して生成されたかを、後からリポジトリの履歴だけで追えなくなる。また `.gitignore` は既に `experiments/*/starter/dist/` 等を無視パターンとして持っており（#1）、starter がコミットされたディレクトリであることを前提にしている。

### 一致を検査せず、ずれを許容する

実装が最も簡単。

**却下理由**: [DR-0027](./0027-build-scaffold-workspace-and-test-stack.md) が懸念した「直下だけを更新した結果、異なるビルド条件で走る」という事態のうち、ランタイム機構が古いまま残る部分は、一致を検査しなければ誰も気付けない。ビルド設定（`vite.config.ts` / `tsconfig*.json` / `package.json` の依存バージョン）側の同種のリスクは、この決定を採ってもなお残る（帰結を参照）。それでも、少なくともランタイム機構については検査で塞げる分だけ、何も検査しないより前進する。

## 帰結

- `src/runtime/**` または `src/index.css` を変更する PR は、`experiments/harness-intro/starter/` 側の対応ファイルも同じ内容へ揃える。揃えないと `pnpm experiment:starter:check`（`pnpm check` 経由）が落ちる
- 将来 `experiments/` に starter を持つ実験が増えたときも、同じ `check-starter` サブコマンドが対象ディレクトリを引数に取れるようにする
- **ビルド設定（`vite.config.ts` / `tsconfig*.json` / `package.json` の依存バージョン）はこの検査の対象にしない。** starter は独立した npm パッケージとして単体で `pnpm install` できる必要があり、workspace 前提のルート直下 `package.json`（`ajv` / `playwright` / `vitest` 等、実験の生成には不要な依存を含む）をそのまま一致させる対象にはできない。両者のフレームワークの大枠（React / Vite / TypeScript のメジャーバージョン）を揃えることは starter 作成時の意図だが、以後の追随は自動検査ではなく人が更新する運用に委ねる。ルートが Vite や TypeScript のメジャーバージョンを上げても、この検査は starter 側の追随漏れを検出しない
