/**
 * `scripts/measure-slides.mjs` が実装する measure ルールIDの一覧（DR-0011）。
 *
 * `scripts/measure-slides.mjs` は Playwright（devDependency）を読み込むため、
 * `scripts/validate-design.mjs`（ブラウザ不要な静的検査）へ直接 import すると
 * 重い依存を持ち込んでしまう。この一覧だけを独立したファイルに切り出すことで、
 * 両者が同じ値を、余計な依存無しに共有できる。
 */
export const IMPLEMENTED_MEASURE_RULE_IDS = ['no-overflow', 'min-font-size', 'contrast']
