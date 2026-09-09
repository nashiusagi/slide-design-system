# 公開ポリシー

このリポジトリは public である（[DR-0023](./decisions/0023-public-repo-with-audit.md)）。ここに書くのは、何を公開してよいか／してはいけないかの基準と、機械検査でどこまで守れるかの境界線。

## 公開するもの

- 設計契約一式（`DESIGN.md` / `design/`）、検査の実装（`packages/`, `scripts/`）、Agent Skill（`skills/`）、決定記録（`docs/decisions/`）
- 保存済み Run（`experiments/*/runs/**`）。生成ソース、採点結果（`scoring.json`）、実測結果（`measurements.json`）を含む（[DR-0014](./decisions/0014-baseline-comparison.md)）

保存済み Run を公開するのは、結果だけでなく生成条件と修正過程を検証できる状態を保つため（DR-0023）。

## 公開してはいけないもの

- **端末の絶対パス。** 保存 Run の生成過程で、隔離ワークスペースの絶対パス（`/home/<user>/...` や一時ディレクトリのパス）が実測結果（`measurements.json` の `dist` フィールド等）やログ、生成ソースのコメントに紛れ込むことがある
- **OS ユーザー名。** 上記の絶対パスの一部として、あるいは単独の文字列として混ざることがある
- **API キー・token らしき文字列。** 生成過程やツールの出力に、それらしい形の文字列（`sk-...`、`ghp_...` 等）が偶然含まれることがある。実際に有効な鍵かどうかに関わらず、パターンが一致した時点で検査の対象にする

## 機械検査の役割と限界

`scripts/sanitize-run-artifacts.mjs` は、上記の既知パターン（絶対パス・ユーザー名）を機械的に置換する。`scripts/audit-public-data.mjs` は、置換漏れや API キー・token らしき文字列が残っていないかを検査し、`pnpm check` に組み込まれている。

**audit が通ることは、公開してよいという承認ではない。** audit は既知の文字列パターンしか見ない。次のようなものは検査できず、人が目で確認する必要がある。

- スクリーンショットや画像に写り込んだ情報（[Issue #11 の非スコープ](https://github.com/nashiusagi/slide-design-system/issues/11)）
- 差分（diff）の中身が意図した情報だけを含んでいるか
- パターンに一致しない、新しい形の秘密情報
- **単独の文字列としての OS ユーザー名は、audit を実行しているマシンのものしか検出できない。** 生成を別マシンで行い、そちらで sanitize しないまま保存した Run のユーザー名（パスの一部でなく、コメント等に単独で残ったもの）までは検出できない
- **`root` / `admin` / `node` のような汎用アカウント名は、単独文字列としての検出対象から意図的に外している。** コンテナ・CI ではこうした名前で実行することが多く、含めると `id="root"` のような無関係なボイラープレートまで誤検知するため（一覧は `scripts/audit-public-data.mjs` の `GENERIC_USERNAMES` を正本とする）

**公開してよい範囲の最終判断は、常に人が行う（DR-0023）。**

## 使い方

```bash
# 保存 Run 1件分を sanitize する（実行するとファイルを上書きする）
node scripts/sanitize-run-artifacts.mjs experiments/harness-intro/runs/<run-id>

# 公開データ全体を audit する（既定では experiments/*/runs を対象にする）
node scripts/audit-public-data.mjs
```

Run を保存したら、コミットする前に sanitize → audit の順で実行する。audit が引っかかったら、sanitize をやり直すか、該当箇所を人が確認して手で直す。
