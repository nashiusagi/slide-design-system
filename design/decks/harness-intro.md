---
title: "harness-intro: この仕組み自体の紹介"
---

layout: title
keyMessage: "AI に契約を渡してスライドを書かせる仕組みを紹介する"

---

layout: bullets
keyMessage: "設計は5層の契約でできていて、AIはそれだけを読んで書く"

- tokens: 色・余白・文字サイズなどの値そのもの
- layouts: スライドがどんな役割を担うときに選ぶかの基準
- components: スライド内部品の使用可否と props の形
- rules: 検査の閾値
- decks: 何を伝えるかという素材（このファイル自身）

---

layout: statement
keyMessage: "書くのは AI、決めるのは契約"
