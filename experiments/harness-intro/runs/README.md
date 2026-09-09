# runs/

保存済み Run を置く。1 Run につき 1 ディレクトリで、形式は次のとおり。

```
runs/<run-id>/
  run.json         # メタデータ。experiments/harness-intro/schemas/run.schema.json を満たす
  source/          # 生成された src/ の実体
  dist/            # 任意。ビルド済みなら置く。あると measure を再ビルド無しで再実行できる
  scoring.json     # scripts/evaluate-run.mjs が書き出す採点結果。再実行のたびに上書きされる
```

`run.json` は `scripts/evaluate-run.mjs save` が書き出す。`scoring.json` は `scripts/evaluate-run.mjs score` が書き出す。どちらも AI を起動せず、保存済みの内容だけから再計算する（[DR-0020](../../../docs/decisions/0020-scripts-do-not-invoke-ai.md)）。

実際の生成と Run の保存は #12（第1弾の生成と比較）のスコープで行う。このディレクトリは、その保存先として先に用意してある。
