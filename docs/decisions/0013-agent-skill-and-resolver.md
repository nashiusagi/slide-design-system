# DR-0013: AI への契約供給は Agent Skill + resolve スクリプトで行う

- **状態**: 承認済み
- **日付**: 2026-09-06
- **関連**: [DR-0019](./0019-claude-only-runner.md), [DR-0009](./0009-five-layer-contract.md)

## 文脈

参考元のデザインシステムは契約を AI へ配る経路を 3 つ持っていた。Agent Skill、MCP サーバー（`scripts/mcp/server.mjs`）、manifest から必要ファイルだけを解決する `resolve-design-contract.mjs` である。重要なのは、Skill の中に設計データを複製せず必ず manifest から解決させる原則で、その SKILL.md にも「設計データを Skill 側へ複製しない」旨が明記されている。

## 決定

Agent Skill と resolve スクリプトを作る。MCP サーバーは作らない。設計データを Skill へ複製しない原則は踏襲する。

## 理由

- 実行環境が Claude Code に限られる（[DR-0019](./0019-claude-only-runner.md)）ため、Skill をそのまま読ませられる。MCP を挟む必要がない
- resolve スクリプトを持つことで、正本を 1 つに保ったまま「この実験で必要な契約だけ」を AI へ渡せる
- MCP は他の CLI を使う段になってから足せばよい。設計上、resolve スクリプトが既にあれば MCP はその薄いラッパになる

## 検討した他の選択肢

### Skill + MCP サーバー両方（参考元と同じ構成）

他の CLI からも同じ契約を引ける。

**却下理由**: Phase 1 では過剰。使う CLI が 1 つに決まっている。

### CLAUDE.md に契約への導線を直接書く

最速。

**却下理由**: 常に読まれてしまうため、「契約を見た場合と見ない場合を比較する」実験（[DR-0014](./0014-baseline-comparison.md)）が成立しなくなる。

## 帰結

- SKILL.md に設計データが複製されていないことを検査する仕組みを持つ。対象は色（`design/tokens.json` の color）、layout / component の役割・使用基準の文章、rule の description、および `DESIGN.md` の記述（見出し・箇条書き記号を除いた20文字以上の行）。`space` / `max` のような小さい数値、および20文字未満の短い行は「3」「1280x720」のような一般的な表現と衝突しやすく誤検知になるため対象にしない
- 非対話で実行される前提を SKILL.md に明記する。生成中に質問しても誰も答えられない
- `resolve-design-contract.mjs` は解決結果をカレントディレクトリの `HARNESS_RESOLVED.json` へ書き出す。SKILL.md はこのファイル名を実行結果の受け渡し規約として参照する
