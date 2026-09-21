# DR-0051: 検証ルールのページは、実装状況を検査の許容リストから引き、部品からのリンクは張らない

- **状態**: 承認済み
- **日付**: 2026-09-21
- **関連**: [DR-0011](./0011-lint-and-measure.md), [DR-0042](./0042-design-catalog-as-separate-build-entry.md), [DR-0044](./0044-bypass-fixtures-required.md), [DR-0048](./0048-docs-hash-carries-section.md), [DR-0049](./0049-catalog-detects-implementation-by-registry.md)
- **正本**: `scripts/unimplemented-rules.json`（実装がまだ無いルールID）
- **実装**: `src/docs/rules.ts`, `src/docs/pages/Rules.tsx`, `scripts/validate-design.mjs`（`main()` の `unimplementedRuleIds`）

## 文脈

カタログに `#/rules`（検証ルール一覧）を足す（#38）。`design/rules.json` は9つのルールと閾値を持ち、ページはそれを読んで並べる。ここまでは他のページ（`#/layouts` / `#/components`）と同じで、[DR-0042](./0042-design-catalog-as-separate-build-entry.md) 決定2 がすでに決めている。

決める必要があるのは3つある。

1. **実装状況を出すか。** `deck-body-fidelity` は宣言だけがあり実装が無い。部品のページは「契約にあるのに実装が無い」を画面上の穴として見せており（[DR-0049](./0049-catalog-detects-implementation-by-registry.md)）、ルールにも同じ穴がある。ただし部品と違い、ルールの実装は ESLint プラグインと Playwright のスクリプトで、どちらもブラウザ側のバンドルから読めない——[DR-0049](./0049-catalog-detects-implementation-by-registry.md) が取った「カタログが登録表を持つ」形をそのまま当てると、**カタログが状態を持つ**ことになる
2. **閾値をどう引くか。** 閾値を持つルールがあり、その値は `rules[]` の中ではなく契約のトップレベルに、ルールごとのブロックとして置かれている
3. **部品からルールへのリンクを張るか。** #38 は「部品とルールの対応をどこから引くかを決める。契約に無い対応関係をカタログ側で新たに定義しないこと」と書いている

## 決定

### 1. 実装状況は出す。判定は `scripts/unimplemented-rules.json` から引く

`scripts/validate-design.mjs` が持っていた `UNIMPLEMENTED_RULE_IDS` をこのファイルへ切り出し、検査スクリプトとカタログの両方がここを読む。カタログは一覧を持たず、`ruleImplemented(id, unimplemented)` で判定するだけにする。

この一覧が実装状況の正本になるのは、`pnpm design:check` がそう作られているからだ。lint 側の対応検査（`checkLintRuleCoverage`）は免除を持たず、measure 側（`checkMeasureRuleCoverage`）はこの一覧に挙げたIDだけを免除する。しかも実装済みのIDが一覧へ残っていれば検査が落ちる（`staleKnownUnimplemented`）。**検査が通っている限り、ここに無いルールには実装が在る。**

### 2. 未実装は「未実装」と書いて出す

[DR-0049](./0049-catalog-detects-implementation-by-registry.md) 決定2 と同じ。空欄や省略にしない。

### 3. 部品からルールへのリンクは張らない

`design/components/*.json` にも `design/rules.json` にも、部品とルールを結ぶ項目が無い。対応を作るには「この部品はこのルールに関係する」をカタログ側で判断することになり、それは契約に無い対応関係を新たに定義することにあたる（#38 が禁じている）。

ルール側の節 ID（`ruleSectionId`）は置く。リンクの着き先は用意しておき、張る側は対応が契約に入った時点で足す。

### 4. 閾値はルールIDのキャメルケースで、契約のトップレベルから引く

`no-raw-scale` → `noRawScale` のように畳んだキーで引く。カタログ側に「ルールID → 閾値ブロック」の対応表を持たない。

## 理由

- **カタログが状態を持つと、必ず古くなる。** ルールを実装した人が直すのは実装と検査であって、カタログではない。カタログ側に一覧を置けば、実装した日から「未実装」と表示し続ける。しかもその食い違いは、[DR-0049](./0049-catalog-detects-implementation-by-registry.md) の登録表と違って**誰も踏まない**——登録表はプレビューが出ないという形で目に見えるが、状態の一覧は文字が1つ違うだけだ
- **免除の一覧は、すでに機械が正しさを守っている。** 実装済みのIDが残れば検査が落ち、未実装のIDを外せば検査が落ちる。カタログはこの性質へ相乗りするだけでよく、新しい検査を足す必要が無い（[DR-0049](./0049-catalog-detects-implementation-by-registry.md) 決定3 と同じく、実装の有無を契約として検査する形は取らない）
- **切り出しは、検査スクリプト側にとっても損が無い。** 値は1箇所から読むようになるだけで、検査の内容は変わらない
- **対応表は、閾値を持つルールが増えたときに落ちる。** 足し忘れると、その閾値は画面のどこにも出ないまま契約にだけ在る状態になり、静かに落ちる。キャメルケースで引く形なら、契約が置いた場所をそのまま辿る。**引けないブロックが在ることは `rules.test.ts` が逆向き（トップレベルのブロック → 対応するルール）で見ている**
- **契約に無い対応を作ると、カタログが契約になる。** 「この部品はこのルールに関係する」は、書いた瞬間に人が参照する対応関係になる。正本が持たない情報をカタログが持てば、それは [DR-0042](./0042-design-catalog-as-separate-build-entry.md) 決定2 が避けようとした「カタログと契約の食い違い」そのものだ

## 検討した他の選択肢

### 実装状況を出さない

判定の根拠を持たずに済み、カタログは契約をそのまま見せる場所に徹する。

**却下理由**: `deck-body-fidelity` は「宣言はあるが動かない」ルールで、それを知らずに一覧を読んだ人は、9つすべてが効いていると受け取る。カタログは契約の現在の姿を見る場所であり、効いていない契約を効いているように見せるのは、書き写しと同じ種類の食い違いにあたる。

### `design/rules.json` の各ルールへ「実装済みか」の項目を足す

正本が持つ情報になり、スキーマで形を検査できる。

**却下理由**: [DR-0049](./0049-catalog-detects-implementation-by-registry.md) が部品で却下したのと同じ。実装の有無は契約ではなく、いま何ができているかという状態である。契約に書くと、実装したのにフラグを直し忘れた状態が「契約違反」として現れる。#38 も検査ルールの変更を非スコープに挙げている。

### `description` の文言から未実装を読み取る

`deck-body-fidelity` の `description` には未実装であることが書かれている。新しいファイルを作らずに済む。

**却下理由**: 文章の書きぶりに判定を負わせることになる。言い回しを整えただけで判定が変わり、しかも変わったことは画面を見るまで分からない。契約の文章は人に読ませるためのもので、機械が読む項目ではない。

### `scripts/lib/measure-rules.mjs` の `IMPLEMENTED_MEASURE_RULE_IDS` を読む

すでに在る一覧で、`scripts/measure-slides.mjs` 自身が実装の根拠として使っている。切り出しが要らない。

**却下理由**: measure しか覆わない。lint 側は「対応検査が免除を持たないので全部実装済み」という理屈を、カタログが自前で持つことになる——method ごとに別の根拠で判定する形になり、method が増えるたびに根拠を1つ足すことになる。未実装の一覧なら、どの method でも同じ1つの根拠で判定できる。

### 部品とルールの対応を、ルールの `scopeExclusions` や `description` から推測する

`component-approved` は部品契約を見るルールなので、文面から対応を引ける余地はある。

**却下理由**: 引けるのは「ルールが部品契約全体を見ている」ことまでで、**どの部品**かは出てこない。部品ごとのカードから張るリンクには足りず、足りない分を埋めるのはカタログ側の判断になる。

## 帰結

- `scripts/validate-design.mjs` は免除の一覧を `scripts/unimplemented-rules.json` から読む形になった。読み込みは他の契約と同じく `main()` の中で行う——モジュールの最上位で読むと、検査関数だけを import するテストの読み込み時にファイル読み込みが走り、vitest（Vite の変換を通す）では `resolve()` の組み立てたパスが file URL にならずに落ちる。ルールを実装したら、この JSON から外す。外し忘れれば `pnpm design:check` が落ちる
- **未実装の一覧が空になっても、それは正しい状態**（全ルールに実装が在る）なので、空を落とす形にはしていない。落とすのは、キーの綴りを誤って配列として読めなかったときだけだ（`src/docs/rules.ts`）。綴り誤りを許すと、全ルールが「実装済み」と表示される
- 一覧に挙げたIDが実在するルールであることは `src/docs/rules.test.ts` が見る。検査スクリプト側は、存在しないIDを書いても「免除が効かない」だけで黙って通る
- カタログは `scripts/` の JSON を読む。ビルドエントリの境界（[DR-0042](./0042-design-catalog-as-separate-build-entry.md)）が禁じているのはスライド本体（`src/App.tsx` / `src/runtime/`）との相互参照で、検査スクリプトのデータはそこに含まれない。`src/docs/docs.css.test.ts` が `scripts/cross-entry-boundary.json` を読んでいるのと同じ形である
- 部品 → ルールのリンクは張っていない。対応が契約に入った時点で、`ruleSectionId` を使って `#/rules/<ルールID>` を指す。着き先が実在することは `src/docs/pages/section-links.test.tsx` が見ている
- `method` の見出しはカタログ側で日本語に置き換えない。`design/schemas/rules.schema.json` の enum へ値が増えたとき、対応表を持つ形だとその束だけが名無しで出る
- ルールの `bypassAxes` / `scopeExclusions`（[DR-0044](./0044-bypass-fixtures-required.md)）はページに出していない。#38 が挙げた表示項目に入っていないためで、出さない理由があるわけではない
