# DR-0023: public リポジトリで公開し、sanitize と audit を実装する

- **状態**: 承認済み
- **日付**: 2026-09-06
- **関連**: [DR-0014](./0014-baseline-comparison.md), [DR-0015](./0015-first-experiment.md)

## 文脈

当初は「公開しない」と判断していた。理由は、Atlas が持つ `runs:sanitize` と `public:audit` を作らずに済ませるためである。しかし対象リポジトリ `nashiusagi/slide-design-system` が public であったため、前提を再検討した。

保存 Run（[DR-0014](./0014-baseline-comparison.md)）には、生成ソース、採点結果、実測結果が含まれる（実際の保存形式は #10 で確定し、`experiments/*/schemas/run.schema.json` を正本とする。この DR を書いた時点では Atlas 由来の想定として `changes.diff` や `events.jsonl`（AI の行動ログ）も含む案があったが、#10 では実装しなかった）。生成過程で使われた隔離ワークスペースの絶対パス（`/home/<user>/...` や一時ディレクトリのパス）が実測結果やログ、生成ソースのコメントに紛れ込むことがあり、OS ユーザー名が露出する。

## 決定

public リポジトリで公開する。あわせて以下を実装する。

- `docs/PUBLICATION_POLICY.md` — 公開するもの / しないものの基準
- `scripts/sanitize-run-artifacts.mjs` — 絶対パスを `<workspace>`、OS ユーザー名を `<user>` へ置換
- `scripts/audit-public-data.mjs` — 置換漏れの文字列検査、および API キー・token らしき文字列の検査（対象パターンの選定は [DR-0040](./0040-audit-secret-pattern-selection.md)）

## 理由

- 実験の証拠（3 条件の Run と採点）をリポジトリに残せる。「結果だけでなく生成条件と修正過程を検証できる」状態を保てる
- 将来の登壇やブログで、実験ごと参照できる
- 別マシンから続きをやるとき、過去の比較を見返せる

## 検討した他の選択肢

### private リポジトリにする

sanitize と audit の実装が丸ごと不要になる。

**却下理由**: 実験の公開価値を取った。

### public のまま Run を `.gitignore`

監査は不要で、仕組みと契約だけ公開できる。

**却下理由**: 比較実験の記録が手元のマシンにしか残らない。

## 帰結

- Issue が 1 本増える（sanitize + audit + PUBLICATION_POLICY.md）
- audit は文字列検査であり公開承認ではない。差分・ログ・画像は人が開いて確認する
- 公開してよい範囲の判断は最終的に人が行う
