/**
 * 生成結果の取り込み・Run 保存・検査・採点を行う（DR-0020 の責務2〜4）。
 *
 *   node scripts/evaluate-run.mjs save --experiment=<dir> --condition=<baseline|harness|harness-corrected> \
 *     --workspace=<dir> --prompt=<path> [--model=<name>] [--corrected-from=<run-id>] [--id=<run-id>]
 *   node scripts/evaluate-run.mjs score --run=<runDir>
 *
 * `save` は隔離ワークスペース（scripts/prepare-workspace.mjs が用意したもの）の
 * `src/`（と、あれば `dist/`）を Run として取り込み、`<experimentDir>/schemas/run.schema.json`
 * を満たす `run.json` を書き出す。`score` は保存済み Run に対して lint（contract-aware）と
 * measure（`dist/` があるときだけ）を実行し、`scoring.json` を書き出す。どちらも AI を
 * 起動しない（DR-0020）。生成は別途サブエージェントを手動で起動して行う（DR-0019）。
 */
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { basename, join, relative, resolve as resolvePath } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import Ajv2020 from 'ajv/dist/2020.js'
import { ESLint } from 'eslint'
import jsConfigs from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'

import slidePlugin from '../packages/eslint-plugin-slide/src/index.mjs'

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url))

/**
 * scoreLint が実際に評価する lint ルールID。deck-conformance は特定の deck を前提とする
 * ルールオプションが要り、Run 一般の採点には使えないためここには含めない（design/rules.json
 * の対応する rule の description を参照）。scripts/compare-runs.mjs もこの一覧を使い、
 * 「採点していないルールを暗黙に pass とみなす」ことを避ける。
 */
export const SCORED_LINT_RULE_IDS = ['no-raw-color', 'no-raw-scale', 'layout-approved', 'component-approved']

/**
 * `dir` 配下のファイルを再帰的に列挙し、`dir` からの相対パス（`/` 区切り）で返す。
 *
 * @param {string} dir
 * @returns {string[]}
 */
export function collectFiles(dir) {
  /**
   * @param {string} current
   * @returns {string[]}
   */
  function walk(current) {
    return readdirSync(current, { withFileTypes: true }).flatMap((entry) => {
      const entryPath = join(current, entry.name)

      if (entry.isDirectory()) {
        return walk(entryPath)
      }

      return [relative(dir, entryPath).split('\\').join('/')]
    })
  }

  return walk(dir)
}

/**
 * `run.json` の中身を組み立てる。IO を持たない純関数。
 *
 * @param {{
 *   id: string, experiment: string, condition: string, createdAt: string,
 *   prompt: string, files: string[], model?: string, correctedFrom?: string, notes?: string,
 * }} input
 */
export function buildRunRecord({ id, experiment, condition, createdAt, prompt, files, model, correctedFrom, notes }) {
  return {
    id,
    experiment,
    condition,
    createdAt,
    prompt,
    source: { files },
    ...(model !== undefined && { model }),
    ...(correctedFrom !== undefined && { correctedFrom }),
    ...(notes !== undefined && { notes }),
  }
}

/**
 * @param {object} run
 * @param {object} schema `<experimentDir>/schemas/run.schema.json` の中身
 * @returns {string[]}
 */
export function validateRunRecord(run, schema) {
  const ajv = new Ajv2020({ allErrors: true, strict: true })
  const validate = ajv.compile(schema)

  if (validate(run)) {
    return []
  }

  return (validate.errors ?? []).map((error) => `run.json: ${error.instancePath || '/'} ${error.message}`)
}

/**
 * 隔離ワークスペースの生成結果を Run として取り込む。
 *
 * @param {{
 *   experimentDir: string, condition: string, workspaceDir: string, prompt: string,
 *   model?: string, correctedFrom?: string, notes?: string, id?: string, repoRoot?: string,
 * }} options
 */
export function saveRun(options) {
  const repoRoot = options.repoRoot ?? REPO_ROOT
  const experimentAbsDir = join(repoRoot, options.experimentDir)
  const id = options.id ?? `${options.condition}-${Date.now()}`
  const runDir = join(experimentAbsDir, 'runs', id)

  if (existsSync(runDir)) {
    throw new Error(`${runDir} は既に存在する。--id を変えるか、既存の Run を消してからやり直すこと`)
  }

  mkdirSync(runDir, { recursive: true })

  const workspaceDir = resolvePath(options.workspaceDir)
  const workspaceSrc = join(workspaceDir, 'src')
  const sourceDir = join(runDir, 'source')
  cpSync(workspaceSrc, sourceDir, { recursive: true })

  const workspaceDist = join(workspaceDir, 'dist')
  if (existsSync(workspaceDist)) {
    cpSync(workspaceDist, join(runDir, 'dist'), { recursive: true })
  }

  const run = buildRunRecord({
    id,
    experiment: basename(options.experimentDir),
    condition: options.condition,
    createdAt: new Date().toISOString(),
    prompt: options.prompt,
    files: collectFiles(sourceDir),
    model: options.model,
    correctedFrom: options.correctedFrom,
    notes: options.notes,
  })

  const schema = JSON.parse(readFileSync(join(experimentAbsDir, 'schemas/run.schema.json'), 'utf8'))
  const problems = validateRunRecord(run, schema)

  if (problems.length > 0) {
    throw new Error(`保存しようとした run.json がスキーマを満たさない:\n${problems.join('\n')}`)
  }

  writeFileSync(join(runDir, 'run.json'), `${JSON.stringify(run, null, 2)}\n`)

  return { runDir, run }
}

/**
 * `sourceDir` 配下の `.ts` / `.tsx` を、契約検査ルール（deck-conformance を除く）で lint する。
 * ルールが読む design/layouts・design/components は常にリポジトリ直下（正本）を見る
 * （packages/eslint-plugin-slide/src/lib/design-contracts.mjs）ため、baseline / harness の
 * どちらの Run にも同じ基準を当てられる。
 *
 * @param {string} sourceDir
 */
export async function scoreLint(sourceDir) {
  const files = collectFiles(sourceDir).filter((file) => file.endsWith('.ts') || file.endsWith('.tsx'))

  if (files.length === 0) {
    return { fileCount: 0, violationsByRule: {}, total: 0, messages: [] }
  }

  // tseslint.config() の戻り値は typescript-eslint 独自の Config 型で、ESLint の
  // overrideConfig が期待する Linter.Config 型とは languageOptions の型がわずかに
  // 食い違う（eslint.config.js が tseslint.config(...) をそのまま default export
  // するときは ESLint CLI が直接読むためこの不一致に当たらない）。実行時の形は
  // 同じ flat config なので、ここでは any として渡す。
  const eslint = new ESLint({
    cwd: sourceDir,
    overrideConfigFile: true,
    overrideConfig: /** @type {any} */ (
      tseslint.config({
        files: ['**/*.{ts,tsx}'],
        extends: [jsConfigs.configs.recommended, ...tseslint.configs.recommended],
        plugins: { slide: slidePlugin },
        languageOptions: { ecmaVersion: 2022, globals: globals.browser },
        rules: Object.fromEntries(SCORED_LINT_RULE_IDS.map((ruleId) => [`slide/${ruleId}`, 'error'])),
      })
    ),
  })

  const results = await eslint.lintFiles(files)

  /** @type {Record<string, number>} */
  const violationsByRule = {}
  /** @type {{ file: string, ruleId: string | null, message: string, line: number }[]} */
  const messages = []

  for (const result of results) {
    for (const message of result.messages) {
      // design/rules.json のルールIDには `slide/` 接頭辞が無い。compare-runs.mjs の
      // SCORED_LINT_RULE_IDS と同じ語彙で突き合わせられるよう、ここで落とす。
      const ruleId = message.ruleId?.replace(/^slide\//, '') ?? '(parse error)'
      violationsByRule[ruleId] = (violationsByRule[ruleId] ?? 0) + 1
      messages.push({ file: relative(sourceDir, result.filePath), ruleId: message.ruleId, message: message.message, line: message.line })
    }
  }

  const total = Object.values(violationsByRule).reduce((sum, count) => sum + count, 0)

  return { fileCount: files.length, violationsByRule, total, messages }
}

/**
 * `runDir/dist` があれば scripts/measure-slides.mjs を子プロセスで実行し、結果を読む。
 * 無ければ測定できないことを明示する（DR-0038 と同様、無音の pass 扱いにはしない）。
 *
 * @param {string} runDir
 * @param {string} repoRoot
 */
export function scoreMeasure(runDir, repoRoot) {
  const distDir = join(runDir, 'dist')

  if (!existsSync(distDir)) {
    return { status: 'skipped', reason: 'runs/<id>/dist が無い。ビルド済みの workspace から保存すると測定できる。' }
  }

  const outPath = join(runDir, 'measurements.json')

  try {
    execFileSync('node', [join(repoRoot, 'scripts/measure-slides.mjs'), `--dist=${distDir}`, `--out=${outPath}`], {
      stdio: 'pipe',
    })
  } catch {
    // measure-slides.mjs は違反があると exit code 1 を返す。measurements.json 自体は
    // 違反の有無に関わらず書き出し済みなので、ここでは失敗として扱わず読みに行く。
  }

  const measurements = JSON.parse(readFileSync(outPath, 'utf8'))

  return { status: 'measured', ...measurements }
}

/**
 * 保存済み Run を採点する。lint と measure の結果を `scoring.json` へ書き出す。
 *
 * @param {string} runDir
 * @param {{ repoRoot?: string }} [options]
 */
export async function scoreRun(runDir, options = {}) {
  const repoRoot = options.repoRoot ?? REPO_ROOT
  // ESLint の cwd オプションは絶対パスを要求する。CLI からは相対パスで渡りうるため
  // ここで一度だけ解決し、以降はこの絶対パスだけを使う。
  const absoluteRunDir = resolvePath(runDir)
  const run = JSON.parse(readFileSync(join(absoluteRunDir, 'run.json'), 'utf8'))

  const lint = await scoreLint(join(absoluteRunDir, 'source'))
  const measure = scoreMeasure(absoluteRunDir, repoRoot)

  const scoring = {
    runId: run.id,
    condition: run.condition,
    scoredAt: new Date().toISOString(),
    lint,
    measure,
  }

  writeFileSync(join(absoluteRunDir, 'scoring.json'), `${JSON.stringify(scoring, null, 2)}\n`)

  return scoring
}

/** @param {string[]} argv */
function parseFlags(argv) {
  /** @type {Record<string, string>} */
  const flags = {}

  for (const arg of argv) {
    const match = /^--([a-z-]+)=(.*)$/.exec(arg)

    if (match) {
      flags[match[1]] = match[2]
    }
  }

  return flags
}

async function main() {
  const [command, ...rest] = process.argv.slice(2)
  const flags = parseFlags(rest)

  if (command === 'save') {
    if (!flags.experiment || !flags.condition || !flags.workspace || !flags.prompt) {
      console.error(
        'Usage: node scripts/evaluate-run.mjs save --experiment=<dir> --condition=<...> --workspace=<dir> --prompt=<path> [--model=][--corrected-from=][--id=]',
      )
      process.exitCode = 1
      return
    }

    try {
      const { runDir, run } = saveRun({
        experimentDir: flags.experiment,
        condition: flags.condition,
        workspaceDir: flags.workspace,
        prompt: flags.prompt,
        model: flags.model,
        correctedFrom: flags['corrected-from'],
        id: flags.id,
      })
      console.log(`Run を保存した: ${runDir}（id: ${run.id}、ファイル ${run.source.files.length} 件）`)
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error))
      process.exitCode = 1
    }

    return
  }

  if (command === 'score') {
    if (!flags.run) {
      console.error('Usage: node scripts/evaluate-run.mjs score --run=<runDir>')
      process.exitCode = 1
      return
    }

    const scoring = await scoreRun(flags.run)
    console.log(
      `${flags.run}: lint 違反 ${scoring.lint.total} 件、measure は ${
        scoring.measure.status === 'measured' ? (scoring.measure.pass ? 'pass' : `${scoring.measure.violations.length} 件の違反`) : 'skipped'
      }`,
    )

    return
  }

  console.error('Usage: node scripts/evaluate-run.mjs <save|score> ...')
  process.exitCode = 1
}

// テストから読み込むときは走らせない。process.exit と副作用（ファイル書き出し）を持つため。
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
