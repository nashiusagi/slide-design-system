# DR-0042: デザインカタログはスライド本体と別のビルドエントリに置く

- **状態**: 承認済み
- **日付**: 2026-09-11
- **関連**: [DR-0011](./0011-lint-and-measure.md), [DR-0018](./0018-plain-css-with-tokens.md), [DR-0021](./0021-starter-contains-runtime-only.md), [DR-0022](./0022-plain-vite-build-output.md), [DR-0028](./0028-single-check-entry-point.md), [DR-0029](./0029-position-in-url-and-explicit-fragment-index.md), [DR-0031](./0031-navigation-keys-and-no-history.md), [DR-0037](./0037-eslint-plugin-slide-rule-scope.md)
- **実装**: `vite.config.ts`（`build.rollupOptions.input`）, `docs.html`, `src/docs/`, `eslint.config.js`（`no-restricted-imports`）

## 文脈

`design/` の契約（トークン・レイアウト・部品・ルール）は JSON / CSS のファイルとしてしか存在せず、人が目で確かめる場所が無い。トークンを変えたときに何がどう変わるのかを見るための「デザインカタログ」を用意したい。

一方このリポジトリの最終出力は素の `vite build` 成果物であり（[DR-0022](./0022-plain-vite-build-output.md)）、measure 検査はそのビルド出力に対して実測する（[DR-0011](./0011-lint-and-measure.md)）。カタログをどこへ置くかは、この2つの前提と噛み合う必要がある。

## 決定

### 1. カタログはスライド本体とは別のビルドエントリに置く

`docs.html` をリポジトリ直下に、実装を `src/docs/` に置き、Vite の `build.rollupOptions.input` へ `index.html` と並ぶ2つ目のエントリとして登録する。カタログのコードは `index.html` のバンドルへ入れない。`src/docs/` から `src/App.tsx` や `src/runtime/` を参照せず、逆向きの参照も作らない。

ページ間の移動はハッシュルーティングで行う。静的ホスティングでサーバ側の rewrite を前提にしないため、パスルーティングは使わない。スライドの現在位置を扱う `src/runtime/hash.ts` は対象が異なる（あちらは位置、こちらはページ）ので流用せず、カタログ側に独立して持つ。書式は一部重なる。スライド側は段階 0 を省略して `#/3` と書く（[DR-0029](./0029-position-in-url-and-explicit-fragment-index.md)）ため、数字だけのページ ID はスライドの URL と同一文字列になる。カタログのページ ID に数字だけの名前は使わない。

移動は素の `<a href>` に任せ、履歴を積む。ブラウザの戻る・進むがそのままページ間の移動になる。[DR-0031](./0031-navigation-keys-and-no-history.md) が履歴を積まないと決めたのはスライドのページ送りであり、対象が違う。未知・不正な hash はエラーにせず先頭のページへ落とす（カタログは 404 のページを持たない）。

この分離は規約だけでは守れないので、`eslint.config.js` の `no-restricted-imports` で `src/docs/` ↔ `src/App.tsx` / `src/runtime/` の相互参照を禁止する。lint 段に載るだけなので `pnpm check` のコマンド列は変わらない。

### 2. カタログは `design/` の契約ファイルを読み込んで描画する

トークン名・値・レイアウトや部品の説明文を、カタログ側のソースへ書き写さない。カタログは `design/tokens.json` などの契約ファイルと `design/theme.css` の `--dh-*` を読み込み、そこにある内容を表示する。カタログ自身のスタイルも `--dh-*` から取り、生の色値・長さリテラルを書かない（[DR-0018](./0018-plain-css-with-tokens.md)）。

### 3. `pnpm check` へは新しい段を足さず、既存の typecheck / lint / build が覆う

カタログの `.ts` / `.tsx` は `src/` 配下にあるため、`tsconfig.app.json` の `include`（`src`）と ESLint の `src/**/*.{ts,tsx}` 設定にそのまま入る。ビルドはエントリを追加した時点で `pnpm build` の対象になる。`pnpm check` のコマンド列は変えない（[DR-0028](./0028-single-check-entry-point.md)）。

**ただし `src/docs/` の CSS はどの段の対象でもない。** `no-raw-color` / `no-raw-scale` は JSX の `style` だけを見る実装で、CSS ファイルは対象外だと [DR-0037](./0037-eslint-plugin-slide-rule-scope.md) が決めている。`scripts/validate-design.mjs` が読む CSS も `design/layout.css` だけだ。決定2の「生の色値・長さリテラルを書かない」は、カタログの CSS については機械検査で担保されておらず、人のレビューで守る。CSS ファイルへの `no-raw-color` / `no-raw-scale` 適用は [DR-0037](./0037-eslint-plugin-slide-rule-scope.md) が保留しており、そこで決まった時点でカタログの CSS も対象に含める。

measure（`pnpm measure`）の対象は `index.html` のビルド出力のみで、カタログは対象にしない。measure が見るのは固定キャンバス上のはみ出し・フォントサイズ・コントラストであり（[DR-0011](./0011-lint-and-measure.md)）、キャンバスを持たないカタログにはこれらの判定が当たらない。

## 理由

- **検査対象を本番と完全に同一の物に保てる。** measure はビルド出力に対して実測する（[DR-0011](./0011-lint-and-measure.md)）。カタログを `src/App.tsx` へ相乗りさせると、スライドのバンドルにカタログのコードとスタイルが混ざり、実測している物が発表で配る物と一致しなくなる
- **starter との切り分けが崩れない。** starter にはスライド機構のみを入れると決めている（[DR-0021](./0021-starter-contains-runtime-only.md)）。カタログを `src/` のスライド側へ混ぜると、starter へ複製すべき範囲の線引きに毎回判断が要るようになる。別エントリなら `src/docs/` が丸ごと対象外だと一目で分かる
- **契約を読み込んで描画すれば、カタログと契約が食い違わない。** 値や説明文をカタログ側へ書き写すと、契約を変えたときにカタログだけが古い内容を表示し続ける。README の「設計データは正本にのみ置く」をカタログにも適用する。これは検査で担保するものではなく、書き写しが起きた時点でカタログの存在意義（契約の現在の姿を見る場所）が消えるという性質の話
- **Vite の multi-page input は追加の依存もビルド段も要らない。** `vite build` のまま `dist/index.html` と `dist/docs.html` の両方が出るので、[DR-0022](./0022-plain-vite-build-output.md) の「最終出力は素の `vite build` 成果物」を変えずに済む

## 検討した他の選択肢

### `src/App.tsx` へカタログを相乗りさせる（`#/docs` でカタログを表示する）

エントリも HTML も増えない。ルーティングもスライドの hash に一本化できる。

**却下理由**: スライドのバンドルへカタログのコードが混ざる。measure はビルド出力に対して実測する（[DR-0011](./0011-lint-and-measure.md)）ため、検査対象が「本番と完全に同一の物」でなくなる。カタログのページを1枚足すたびにスライドの出力物が太る構造でもあり、[DR-0021](./0021-starter-contains-runtime-only.md) の「starter にはスライド機構のみ」とも噛み合わない。

### カタログを別リポジトリ、あるいは workspace の別パッケージにする

スライド本体との分離が最も強い。

**却下理由**: カタログは `design/` の契約ファイルを読んで描画するものなので、契約と同じリポジトリ・同じビルドにある方が参照が素直で、契約の変更と同じ PR でカタログの見え方まで確認できる。別パッケージにすると `pnpm check` への組み込みとビルド設定が増え、分離で得るものに見合わない。

### Storybook などのカタログ専用ツールを導入する

カタログの体裁・ナビゲーション・ホットリロードが最初から揃う。

**却下理由**: 依存と設定が大きく増え、最終出力を素の `vite build` 成果物に保つ方針（[DR-0022](./0022-plain-vite-build-output.md)）から外れる。ここで要るのは契約ファイルを読んで並べて表示することだけで、専用ツールの機能のほとんどを使わない。

## 帰結

- `pnpm build` は `dist/index.html` と `dist/docs.html` の両方を出力する。`pnpm preview` でも両方が配信される
- カタログのページを足す後続の Issue（#34 / #35 / #36 / #38）は `src/docs/` の中だけを触る。スライド側（`src/App.tsx` / `src/runtime/`）を変更する必要は生じない
- `experiments/*/starter` へ複製する対象（`scripts/prepare-workspace.mjs` の `MIRRORED_SRC_FILES`）にカタログは入らない
- カタログの CSS は `pnpm check` のどの段からも検査されない。ページを足す後続 Issue では、生の色値・長さリテラルが入っていないかを人が見る。CSS 検査が入れば（[DR-0037](./0037-eslint-plugin-slide-rule-scope.md) の保留分）この穴は閉じる
- カタログのデプロイ・ホスティングはこの DR では決めない。必要になった時点で別の決定として起こす
