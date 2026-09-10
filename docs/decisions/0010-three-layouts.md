# DR-0010: レイアウト variant は 3 種から始める

- **状態**: 承認済み
- **日付**: 2026-09-06
- **関連**: [DR-0009](./0009-five-layer-contract.md), [DR-0015](./0015-first-experiment.md)
- **正本**: `design/layouts/`

## 文脈

layout variant が多すぎると AI が選択に迷い、少なすぎると AI が契約外の独自レイアウトを作って契約が破れる。参考元のデザインシステムはページレイアウトを 3 variant に絞り、かつ「Issue 固有の画面名ではなく、業務オブジェクトの関係から選べ」と選択基準を明記していた。

## 決定

`title` / `bullets` / `statement` の 3 種から始める。各 variant は「見た目」ではなく「そのスライドが担う役割」で定義し、選択基準を契約に明記する。

## 理由

- 契約 → 生成 → lint → 修正のループを最短で貫通させ、検査基盤の設計ミスを早期に発見できる
- variant が増えるほど「どれを選ぶべきか」の判断基準を書くコストが乗算で増える
- 3 種は後から増やせる。増やす前に土台の妥当性を確かめる方が安い

## 検討した他の選択肢

### 7 種（title / section / statement / bullets / two-column / code / figure）

技術発表で実用になる最小セット。

**却下理由**: 回路が通る前に契約の量が増え、設計ミスの発見が遅れる。実用性は Phase 1.5 で回収する。

### 9 種フル（上記 + table + quote）

**却下理由**: 同上に加え、選択基準の記述コストが最大になる。

## 帰結

- components も従属して最小になる（`SlideTitle` / `BulletList` / `Statement` / `Emphasis` 程度）
- 第 1 弾のお題（[DR-0015](./0015-first-experiment.md)）は 3 種で表現できる構成に制約される
- `section` / `code` / `figure` の追加は Phase 1.5 の Issue として起こす
