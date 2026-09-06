# DR-0021: starter にはスライド機構のみを入れ、契約は Harness 側だけに渡す

- **状態**: 承認済み
- **日付**: 2026-09-06
- **関連**: [DR-0014](./0014-baseline-comparison.md), [DR-0003](./0003-custom-slide-runtime.md)

## 文脈

Atlas の starter を調べたところ、中身はビルド設定と空の `App.tsx` だけで、デザインは一切入っていなかった。条件の差は `manifest.json` の `conditions` にある 2 つだけである。

```json
"baseline": { "includesDesignContract": false, "agentSkills": [] }
"harness":  { "includesDesignContract": true,  "agentSkills": ["atlas-design-system", ...] }
```

つまり実験の公平性は「starter は完全に同一、渡す情報だけが違う」で担保されている。

スライド領域では追加の判断が要る。スライド機構（`Deck` / `Slide` / `Fragment`）を starter に入れるかどうかである。

## 決定

starter にはビルド設定とスライド機構（ランタイム + 16:9 キャンバスの最低限の CSS）までを共通で入れる。トークン・layout 契約・components・rules・Skill は Harness 条件にのみ渡す。

本 DR で「設計契約」と呼ぶのは [DR-0009](./0009-five-layer-contract.md) の 5 層を指し、Agent Skill はこれに含まない。両者は同じ条件差に属するが別のものとして数える。

## 理由

- 機構を入れないと Baseline はページ送りから自作することになり、比較が「デザイン契約の効果」ではなく「機構を作れるか」の勝負になってしまう
- 差分を「デザイン契約の有無」に純化できる。実験として測りたいものが測れる

## 検討した他の選択肢

### Atlas 完写（空の App のみ）

現実の「何もないところから AI に作らせる」を再現できる。

**却下理由**: 差が大きすぎて契約の効果を分離できない。

### 機構 + トークンまで共通で渡す

差分を「layout / components / rules 契約と Skill の有無」に絞る。「トークンだけでは足りない」ことを示せる。

**却下理由**: 主張としては興味深いが、Phase 1 で示したいのは契約全体の効果。より基本的な比較を先に取る。

## 帰結

- starter に含まれるランタイムは、設計契約とは独立して動く必要がある。トークン変数が未定義でも壊れない設計にする
- baseline のワークスペースに設計契約と Agent Skill のどちらも混入していないことを検査する仕組みを持つ
- starter のキャンバス CSS は寸法を持つが、正本は `design/tokens.json` の `canvas` である（[DR-0004](./0004-phase-1-runtime-scope.md)）。starter の CSS を tokens から生成するか、両者の一致を検査する。ずれると `no-overflow` の基準面が条件ごとに変わり、lint では検出できない
