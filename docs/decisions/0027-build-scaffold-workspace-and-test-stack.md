# DR-0027: 足場は pnpm workspace とし、テストは Vitest で書く

- **状態**: 承認済み
- **日付**: 2026-09-06
- **関連**: [DR-0002](./0002-source-format-jsx-react.md), [DR-0011](./0011-lint-and-measure.md), [DR-0021](./0021-starter-contains-runtime-only.md), [DR-0028](./0028-single-check-entry-point.md)
- **正本**: `package.json` / `pnpm-workspace.yaml`（バージョンと構成の値）

## 文脈

[DR-0002](./0002-source-format-jsx-react.md) で React / TypeScript / Vite が必須依存になり、[DR-0011](./0011-lint-and-measure.md) で契約検査を自作 ESLint プラグインとして実装すると決まった。だが**プラグインをどこに置くか**、**テストを何で書くか**、**Node のどのバージョンを前提にするか**は決まっていなかった。

## 決定

**リポジトリを pnpm workspace にし、`packages/*` を持つ。** 契約検査プラグイン（`packages/eslint-plugin-slide`）はここに置く。スライドアプリ本体はリポジトリ直下（`src/`）に置く。

**テストは Vitest で書く。** DOM を要する部分は jsdom + Testing Library を使う。

**Node.js は 22 以上を前提とする。**

## 理由

- **プラグインを別パッケージにすると、それ自体を配布・テストできる単位になる。** ESLint プラグインは名前解決の都合でパッケージ境界を持つ方が素直で、参考元のデザインシステムの ESLint プラグインも同じ形をとっている
- **Vitest は Vite の設定をそのまま使える。** ビルドと同じ解決規則でテストが走るので、`vite.config.ts` に書いた設定を二重管理しない
- Node 22 は現行の LTS で、`vite` / `vitest` のいずれも前提を満たす

## 検討した他の選択肢

### 単一パッケージのまま、プラグインを `src/` の下に置く

workspace の設定が要らない。

**却下理由**: ESLint はプラグインをパッケージ名で解決する。単一パッケージだと相対パス参照の回避策が要り、実験の starter へ配る形も作れない。

### Jest

エコシステムが厚い。

**却下理由**: Vite とは別に変換の設定を持つことになり、ビルドとテストで解決規則が分岐する。契約検査は「ビルドされる物」を対象にするため、分岐は避けたい。

### Node 20（一世代前の LTS）

**却下理由**: 現時点で 20 に留める理由が無い。個人用の環境であり、互換の要求も無い。

## 帰結

- `packages/*` に置いたコードが `pnpm check` の全段（typecheck / lint / test）に入ることを、設定側で保証する（[DR-0028](./0028-single-check-entry-point.md)）。指定の一覧は `packages/README.md` に置く
- **リポジトリ直下の足場と、実験の共通 starter（[DR-0021](./0021-starter-contains-runtime-only.md)、`experiments/`）の関係は未決である。** 複製にすると、直下だけを更新したときに Baseline と Harness が異なるビルド条件で走り、比較の前提（starter は完全に同一）が静かに崩れる。starter を作る Issue で「生成するか、一致を検査するか」を決める → [DR-0039](./0039-experiment-starter-checked-against-root-scaffold.md) で一致検査に決定
- TypeScript のバージョンだけは別の制約を受ける（[DR-0026](./0026-typescript-5-for-eslint-ast.md)）
