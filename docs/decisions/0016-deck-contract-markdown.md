# DR-0016: deck 契約は Markdown + frontmatter で書く

- **状態**: 承認済み
- **日付**: 2026-09-06
- **関連**: [DR-0001](./0001-phase-1-is-ai-harness.md), [DR-0017](./0017-key-message-required-body-optional.md), [DR-0009](./0009-five-layer-contract.md)
- **正本**: `design/decks/`

## 文脈

deck 契約は Phase 1 では lint（`deck-conformance`）の対象であり、Phase 2 では**人間が書く場所**になる。つまり両フェーズの接合部にあたる。Atlas の `examples` は JSON だったが、あれは AI しか書かないから成立していた。

Phase 2 で人間が契約を書くと決めた以上（[DR-0001](./0001-phase-1-is-ai-harness.md)）、人間が書いて苦痛でない形式である必要がある。

## 決定

Markdown + YAML frontmatter で書く。deck 全体のメタを先頭の frontmatter に、各スライドを `---` で区切って layout と本文を書く。パーサで JSON へ正規化してから既存の JSON Schema 検証に載せる。

## 理由

- 人間にとって最も自然に書ける。箇条書きやコードをそのまま書ける
- Phase 2 でオーサリング形式を作り直す必要がない
- 正規化層を一枚挟むだけで、契約検証の仕組みは JSON のまま維持できる

## 検討した他の選択肢

### YAML 単体

構造が明示的で Schema 検証との相性が良い。

**却下理由**: 長い本文やコードブロックを YAML の文字列として書くとインデントの扱いが煩雑になる。

### JSON（Atlas 完全準拠）

検証もツールも最も素直で、Atlas のスクリプトをそのまま使える。

**却下理由**: Phase 2 で人間が書くときの苦痛。改行も日本語も書きにくい。

## 帰結

- Markdown → JSON の正規化パーサとそのテストが必要になる
- パーサが契約の一部となるため、パーサの挙動変更は契約の変更として扱う
