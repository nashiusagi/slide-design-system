# DR-0028: 検査の実行口を `pnpm check` に一本化する

- **状態**: 承認済み
- **日付**: 2026-09-06
- **関連**: [DR-0011](./0011-lint-and-measure.md), [DR-0022](./0022-plain-vite-build-output.md), [DR-0027](./0027-build-scaffold-workspace-and-test-stack.md)。measure を `check` へ組み込む時期は一時的に [DR-0038](./0038-defer-measure-in-check.md) が例外を持つ
- **正本**: `package.json`（`scripts.check` の実際の並び）

## 文脈

[DR-0011](./0011-lint-and-measure.md) は検査の中身（lint / measure と、その帰結として要る突き合わせ）を決めたが、**それを誰がどの順で実行するか**は決めていなかった。足場（#2）を組む時点で、この入口を作る必要が出た。

## 決定

検査の実行口を `pnpm check` 単一コマンドにする。中身は静的な検査から順に直列で繋ぎ、**ビルド出力を要する検査は build の後段に置く。**

## 理由

- **入口が一つだと、「通ったか」の意味が一つに定まる。** 検査ごとに別コマンドだと、どれを実行したかの組み合わせで結果が変わり、[DR-0011](./0011-lint-and-measure.md) の帰結にある「実行されたルール ID の集合を残す」という要請と噛み合わない
- **順序は依存で決まる。** measure はビルド出力（`dist/`）に対して実測する（[DR-0011](./0011-lint-and-measure.md) / [DR-0022](./0022-plain-vite-build-output.md)）ため、build より前には置けない。静的な検査を先に置くのは、速く落ちる方から潰すため
- ローカルと CI で同じ一行を叩けば同じ判定になる

## 検討した他の選択肢

### 検査ごとに別コマンドのままにし、CI が並べる

並列化しやすく、失敗箇所も分かりやすい。

**却下理由**: 判定の定義が CI 設定へ移り、リポジトリを clone した人が「何を満たせば良いか」を読めなくなる。並列化が必要になった時点で、CI が `check` の中の段を個別に叩けばよい。

### `pnpm check` に measure まで含めず、measure は別コマンドにする

`pnpm check` が速いまま保たれる。

**却下理由**: Issue を終えてよいかの判定から、本命の検査（`no-overflow`）が外れる。速さが問題になったら、`check` の中で段を分ける方法を先に検討する。

## 帰結

- 検査を足す Issue は、**`pnpm check` のどの段に入るかを併せて決める。** lint 系は lint 段、実測系は build より後段
- `pnpm check` が緑であることは、どの Issue でも共通の必要条件にすぎない。個々の Issue を終えてよいかは、Issue の完了条件で判定する（`.claude/skills/issue-workflow/SKILL.md`）
- 新しく作ったコードの置き場所が `check` の各段の対象に入っているかを確かめる。対象から外れた検査コードは、壊れていても緑を返す（[DR-0027](./0027-build-scaffold-workspace-and-test-stack.md) の帰結）
