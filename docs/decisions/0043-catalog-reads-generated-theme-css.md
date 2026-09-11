# DR-0043: カタログは値を `design/theme.css` から読み、見本は `var(--dh-*)` を当てて描く

- **状態**: 承認済み
- **日付**: 2026-09-11
- **関連**: [DR-0005](./0005-single-theme-personal.md), [DR-0018](./0018-plain-css-with-tokens.md), [DR-0033](./0033-derived-values-are-generated-and-checked.md), [DR-0034](./0034-contrast-metric-wcag21-srgb.md), [DR-0042](./0042-design-catalog-as-separate-build-entry.md)
- **実装**: `src/docs/tokens.ts`, `src/docs/pages/Foundations.tsx`, `vite.config.ts`（`test.css.include`）

## 文脈

[DR-0042](./0042-design-catalog-as-separate-build-entry.md) の決定2で、カタログは `design/` の契約ファイルを読み込んで描画し、トークン名・値を書き写さないと決めた。トークンの一覧ページを作る段になって、「読む」にも複数の読み方があることが分かった。

`design/tokens.json` の葉は単位を持たない。余白のような長さも、行送りや字の太さのような無次元の値も、同じ素の数値として書かれている。px を付けるかどうかの規則は `scripts/generate-theme.mjs` の `UNITLESS_PATHS` が持っている。単位の付いた姿で見せるには、その規則をカタログ側にも持つか、別の読み方をするかを決める必要がある。

見本（実際の色面・実寸のバー・実際の字）をどう描くかも同じ問題を持つ。tokens.json の値を直接 `style` へ渡すこともできるし、`design/theme.css` が生成した `var(--dh-*)` を当てることもできる。

## 決定

### 1. 表示する値は `design/theme.css` の宣言から読む

カタログは `design/theme.css` を `?raw` で読み、`--dh-*: <値>;` を名前から値へ引ける形にして表示する。tokens.json の生の値は、対応する変数が無いときの受け皿としてだけ使う。

読み込んだ CSS が空のときは例外を投げる。vitest は CSS の読み込みを空文字へ差し替えるため、`test.css.include` への列挙が漏れると、表示も期待値も空になって検査が素通りする。

トークンの位置（`['type', 'slideTitle']`）から変数名（`--dh-type-slide-title`）を作る規則は、`generate-theme.mjs` の `toKebab` と同じものをカタログ側にも持つ。これは写しなので、全トークンについて作った名前が theme.css に実在することをテストで固定する。

### 2. 見本は `var(--dh-*)` を当てて描く

スウォッチの色、余白のバーの幅、文字の大きさ・行送り・太さ、角丸、影は、すべて `var(--dh-*)` を JSX の `style` へ渡して描く。tokens.json の値を直接渡さない。

### 3. カタログが `?raw` で読む CSS は、vitest の `test.css.include` に載せる

vitest は既定で CSS の読み込みを空文字へ差し替えるため、`?raw` もテストでは空になる。対象のファイルを `test.css.include` へ列挙して、テストでも実体が読めるようにする。CSS 全体の処理は有効にしない。

## 理由

- **単位の規則を二重に持たない。** px を付ける／付けないの判定を `generate-theme.mjs` とカタログの両方が持つと、片方だけ変わったときにカタログの表示だけが静かにずれる。生成された CSS の値を読めば、規則の写しは変数名の作り方だけに減る
- **カタログが「実際に効いている値」を見せる。** theme.css はスライドが実際に読む CSS であり、tokens.json との一致は `pnpm theme:check` が担保している（[DR-0033](./0033-derived-values-are-generated-and-checked.md)）。カタログが読むものと、スライドに効くものが同一になる
- **見本に `var(--dh-*)` を当てると、見本が壊れたときに気づける。** 変数名を間違えれば見本は何も反映されない姿で描かれる。tokens.json の値を直接渡す書き方ではこの失敗が起きない代わりに、theme.css が壊れていてもカタログだけが正しく見えてしまう
- **テストで空になる読み込みを放置しない。** 値の表示を検査するテストは、`?raw` が空だと「表示も期待値も空」で通ってしまう。`test.css.include` を絞って、対象のファイルだけ実体を読ませる

## 検討した他の選択肢

### tokens.json の値を表示し、単位はカタログ側で付ける

theme.css を読まずに済み、依存が1つ減る。

**却下理由**: `UNITLESS_PATHS`（`type.lineHeight` / `type.weight` は無次元）の写しをカタログが持つことになる。トークンの軸が増えたときに、正本・生成スクリプト・カタログの3か所を揃える必要が生じる。カタログは契約を見る場所であって、契約の解釈を再実装する場所ではない。

### tokens.json の値を `style` へ直接渡して見本を描く

変数名を組み立てる写しが要らなくなる。

**却下理由**: [DR-0018](./0018-plain-css-with-tokens.md) がスタイルを `--dh-*` 変数で書くと決めており、カタログだけがトークン変数を経由しない書き方になる。生成された CSS が壊れていてもカタログは正しく見えるため、[DR-0042](./0042-design-catalog-as-separate-build-entry.md) がカタログに与えた役目（契約の現在の姿を見る場所）とも噛み合わない。

### vitest の `test.css` を全体で有効にする

設定が1行で済む。

**却下理由**: jsdom は組版をしないので、カタログが `?raw` で読むファイル以外の CSS を処理しても得るものが無く、全テストがその分だけ遅くなる。

## 帰結

- カタログの表示値は theme.css の生成結果であり、`pnpm theme:generate` を忘れた状態では古い値が出る。これは `pnpm theme:check` が落とすので、検査を通った状態では起こらない
- カタログが新しい契約 CSS を `?raw` で読むときは、`vite.config.ts` の `test.css.include` へ足す。足し忘れても気づけるよう、読み込んだ CSS が空なら読み込み側で例外を投げる。文章での注意だけにすると、本番側とテスト側が同じ空文字から期待値と実測値を組み立て、テストが無検査のまま緑になる
- 色のコントラスト比は `design/tokens.json` の `$measured` を読むだけで、カタログは算出しない（[DR-0033](./0033-derived-values-are-generated-and-checked.md) / [DR-0034](./0034-contrast-metric-wcag21-srgb.md)）。併記する相手の面は `design/rules.json` の `contrast.surfaces` を読む
