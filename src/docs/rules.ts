/**
 * カタログが `design/rules.json` の検査ルール契約を読むための入口（DR-0042 決定2）。
 *
 * レイアウト・部品と違い、ルールの正本は1ファイルなので `import.meta.glob` は使わない。
 * ディレクトリを走査する `contractsFrom`（`src/docs/contracts.ts`）も通らない——0件の
 * ガードが意味を持つのは、パスがずれると静かに空になる glob のほうだ。1ファイルの import は
 * パスがずれればビルドが落ちる。
 *
 * ルールの文言・閾値をここへ書き写さない（DR-0042 決定2）。並べる対象も、閾値の値も、
 * すべてこのファイルが読んだ契約から引く。ルールを1つ足せばページへ自動で現れる。
 */
import rulesJson from '../../design/rules.json'
import unimplementedRules from '../../scripts/unimplemented-rules.json'

/**
 * `design/rules.json` の `rules[]` のうち、カタログが表示する項目。
 *
 * 正本は `design/schemas/rules.schema.json` で、契約が実際にこの形をしていることは
 * `pnpm design:check` が検査する（DR-0009 / DR-0035）。表示しない項目（`bypassAxes` /
 * `scopeExclusions`）は型へ入れない。型へ入れるとページ側が読めるようになり、Issue #38 の
 * スコープ外の情報が画面へ出る余地ができる。
 */
export type RuleContract = {
  id: string
  /** 検査の実行手段。値の一覧は `design/schemas/rules.schema.json` の enum が持つ。 */
  method: string
  severity: string
  description: string
}

/** 検査ルール契約の一覧（DR-0011 が lint / measure を分けた対象そのもの）。 */
export const RULES: RuleContract[] = rulesJson.rules

/**
 * 実装がまだ無いルールID（DR-0051）。
 *
 * 正本は `scripts/unimplemented-rules.json` で、`scripts/validate-design.mjs` の実装対応
 * 検査も同じファイルを読む。カタログ側に状態を持たない。
 *
 * 形が変わっていたら落とす。キーを綴り誤ると `undefined` になり、そのまま使うと**全ルールが
 * 実装済みとして表示される**。空の配列は正しい状態（未実装が無い）なので許すが、配列でない
 * ものは許さない。
 */
const unimplementedRuleIds: unknown = unimplementedRules.unimplementedRuleIds

if (!Array.isArray(unimplementedRuleIds)) {
  throw new Error(
    'scripts/unimplemented-rules.json の unimplementedRuleIds を配列として読めなかった。キーの綴りを確認すること（DR-0051）。',
  )
}

export const UNIMPLEMENTED_RULE_IDS: string[] = unimplementedRuleIds

/**
 * ルール1件を指す節 ID。`#/rules/<節ID>` のリンク先になる（DR-0048 決定3）。
 *
 * レイアウトの `layoutSectionId`・部品の `componentSectionId` と同じ役目。いまこの hash を
 * 指すリンクは無い（部品からルールへの対応は契約に無く、張っていない。DR-0051 決定3）が、
 * `id` を置く側だけが先にあると、後からリンクを張る人が契約名を直接書く形に倣ってしまう。
 *
 * ルールIDが hash の節 ID の書式（英小文字・数字・ハイフン）に収まることは `rules.test.ts` が
 * 全ルールについて固定している。スキーマの `pattern` が `^[a-z]+(-[a-z]+)*$` を求めているので
 * 契約が通る限り収まるが、その一致はスキーマ側の都合で崩れうる。
 */
export function ruleSectionId(ruleId: string): string {
  return ruleId
}

/**
 * ルールの実装が在るか（DR-0051 決定1）。
 *
 * 一覧を引数で受け取り、既定値を持たない。理由は `previewFor`（DR-0049 決定4）と同じ——
 * 省略できる形にすると、呼び出しがどの一覧を見ているかその場で読めず、テストが差し替えた
 * 一覧も反映されない。
 */
export function ruleImplemented(ruleId: string, unimplemented: string[]): boolean {
  return !unimplemented.includes(ruleId)
}

/** `min-font-size` → `minFontSize`。ルールIDから閾値ブロックのキーを作る。 */
export function thresholdKey(ruleId: string): string {
  return ruleId.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase())
}

/** 閾値の値。JSON がそのまま入るので、入れ子も配列も来る。 */
export type ThresholdValue = string | number | boolean | null | ThresholdValue[] | { [key: string]: ThresholdValue }

/**
 * ルールが持つ閾値。`design/rules.json` のトップレベルから、ルールIDのキャメルケースで引く。
 *
 * 対応表を持たない。`contrast` / `minFontSize` / `noOverflow` / `noRawScale` は、どれも
 * ルールIDをキャメルケースにしたキーで置かれている。対応表を書くと、閾値を持つルールが
 * 増えたときにそこへ足すまで画面から落ち、落ちたことは誰にも分からない。
 *
 * 閾値を持たないルールは `null`。`$` で始まるキー（`$comment`）は閾値ではないので除く。
 * 判定は `tokenEntries`（`src/docs/tokens.ts`）と同じ規則に揃えている。
 */
export function thresholdEntries(ruleId: string): [string, ThresholdValue][] | null {
  const block = (rulesJson as Record<string, unknown>)[thresholdKey(ruleId)]

  if (typeof block !== 'object' || block === null || Array.isArray(block)) {
    return null
  }

  return Object.entries(block as Record<string, ThresholdValue>).filter(([key]) => !key.startsWith('$'))
}

/**
 * ルールを `method` ごとに分ける。並びは契約に現れた順（DR-0011 が method を分けた対象）。
 *
 * method の一覧をここへ持たない。持つと、`design/schemas/rules.schema.json` の enum へ
 * 値が増えたときに、そちらのルールだけが画面から消える。
 */
export function rulesByMethod(rules: RuleContract[]): [string, RuleContract[]][] {
  const groups = new Map<string, RuleContract[]>()

  for (const rule of rules) {
    const group = groups.get(rule.method)

    if (group === undefined) {
      groups.set(rule.method, [rule])
    } else {
      group.push(rule)
    }
  }

  return [...groups]
}
