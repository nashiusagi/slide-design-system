/**
 * 実験（`experiments/<name>/`）の隔離ワークスペースを用意する（DR-0020 の責務1）。
 *
 *   node scripts/prepare-workspace.mjs create <experimentDir> <condition> [--out=<dir>]
 *   node scripts/prepare-workspace.mjs check-starter <experimentDir>
 *
 * `create` は `<experimentDir>/starter/` をコピーしたワークスペースを用意する。
 * `<experimentDir>/manifest.json` の `conditions.<condition>` が
 * `includesDesignContract: true` を持つときだけ、設計契約と Agent Skill も
 * 追加でコピーする（DR-0021）。AI はここでは起動しない（DR-0020）。生成は
 * 別途サブエージェントを手動で起動して行う（DR-0019）。
 *
 * `check-starter` は `<experimentDir>/starter/` のランタイム機構がリポジトリ直下の
 * 実装と一致しているかを検査する（DR-0039）。`pnpm check` から呼ばれる。
 */
import { cpSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { resolveManifestFile } from './resolve-design-contract.mjs'

/** リポジトリルートの絶対パス。このファイル自身の位置から導く。 */
const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url))

/**
 * starter とリポジトリ直下で内容が一致しているべきファイル（`src/` からの相対パス）。
 * ランタイム機構（DR-0021）に限る。`App.tsx` は starter 側が空の初期状態、直下側が
 * 動作確認用の見本で意図的に異なるため対象にしない（DR-0039）。
 */
export const MIRRORED_SRC_FILES = [
  'runtime/Deck.tsx',
  'runtime/Slide.tsx',
  'runtime/Fragment.tsx',
  'runtime/canvas.ts',
  'runtime/context.ts',
  'runtime/hash.ts',
  'runtime/index.ts',
  'runtime/runtime.css',
  'index.css',
]

/**
 * starter のランタイム機構がリポジトリ直下と一致しているか（DR-0039）。
 *
 * @param {string} repoRoot
 * @param {string} starterDir `<experimentDir>/starter` の絶対パス
 * @returns {string[]}
 */
export function checkStarterMatchesRoot(repoRoot, starterDir) {
  return MIRRORED_SRC_FILES.flatMap((relativePath) => {
    const rootPath = join(repoRoot, 'src', relativePath)
    const starterPath = join(starterDir, 'src', relativePath)

    if (!existsSync(starterPath)) {
      return [`${starterPath}: starter に無い（src/${relativePath} をコピーすること）`]
    }

    const rootContent = readFileSync(rootPath, 'utf8')
    const starterContent = readFileSync(starterPath, 'utf8')

    if (rootContent !== starterContent) {
      return [`${starterPath}: src/${relativePath} と内容が食い違う。starter 側を最新へ揃えること`]
    }

    return []
  })
}

/**
 * manifest の `conditions.<condition>` を取り出す。無ければエラーにする。
 *
 * @param {{ conditions?: Record<string, unknown> }} manifest
 * @param {string} condition
 */
export function resolveCondition(manifest, condition) {
  const config = manifest.conditions?.[condition]

  if (config === undefined) {
    const known = Object.keys(manifest.conditions ?? {})
    throw new Error(`manifest に condition '${condition}' が無い（既知: ${known.join(', ') || '無し'}）`)
  }

  return /** @type {{ includesDesignContract: boolean, agentSkills: string[], contractManifest?: object }} */ (config)
}

/**
 * ワークスペースに設計契約・Agent Skill のどちらも混入していないか（DR-0021 の帰結）。
 * baseline 条件のワークスペースを用意した直後の確認に使う。
 *
 * @param {string} workspaceDir
 * @returns {string[]}
 */
export function assertNoDesignContract(workspaceDir) {
  return [
    ['DESIGN.md', 'DESIGN.md'],
    ['design', 'design/'],
    ['skills', 'skills/'],
  ]
    .filter(([name]) => existsSync(join(workspaceDir, name)))
    .map(([, label]) => `${workspaceDir}: 設計契約 or Agent Skill（${label}）が混入している`)
}

/**
 * `contractManifest`（resolve-design-contract.mjs の manifest 形式）を実データに
 * 対して解決する。一時ファイル経由なのは resolveManifestFile がファイルパスしか
 * 受け取らないため（scripts/validate-design.mjs の checkResolveDesignContractSmoke
 * と同じ手法）。
 *
 * @param {object} contractManifest
 */
function resolveContractManifest(contractManifest) {
  const dir = mkdtempSync(join(tmpdir(), 'prepare-workspace-manifest-'))

  try {
    const manifestPath = join(dir, 'manifest.json')
    writeFileSync(manifestPath, JSON.stringify(contractManifest))

    return resolveManifestFile(manifestPath)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

/**
 * `<experimentDir>/starter/` を隔離ワークスペースへコピーし、条件に応じて
 * 設計契約・Agent Skill を追加する。
 *
 * @param {string} experimentDir リポジトリルートからの相対パス（例: 'experiments/harness-intro'）
 * @param {string} condition manifest.json の conditions のキー
 * @param {{ out?: string, repoRoot?: string }} [options]
 */
export function prepareWorkspace(experimentDir, condition, options = {}) {
  const repoRoot = options.repoRoot ?? REPO_ROOT
  const experimentAbsDir = join(repoRoot, experimentDir)
  const manifest = JSON.parse(readFileSync(join(experimentAbsDir, 'manifest.json'), 'utf8'))
  const conditionConfig = resolveCondition(manifest, condition)

  const targetDir =
    options.out ?? join(tmpdir(), 'slide-harness-experiments', basename(experimentDir), `${condition}-${Date.now()}`)

  mkdirSync(targetDir, { recursive: true })
  cpSync(join(experimentAbsDir, 'starter'), targetDir, { recursive: true })

  if (!conditionConfig.includesDesignContract) {
    const problems = assertNoDesignContract(targetDir)

    if (problems.length > 0) {
      throw new Error(`baseline 相当のワークスペースに契約が混入した:\n${problems.join('\n')}`)
    }

    return { targetDir, resources: [], skills: [] }
  }

  const resolved = resolveContractManifest(conditionConfig.contractManifest ?? {})

  for (const resource of resolved.resources) {
    const destination = join(targetDir, resource.path)
    mkdirSync(dirname(destination), { recursive: true })
    cpSync(join(repoRoot, resource.path), destination)
  }

  writeFileSync(join(targetDir, 'HARNESS_RESOLVED.json'), `${JSON.stringify(resolved, null, 2)}\n`)

  for (const skillName of conditionConfig.agentSkills ?? []) {
    cpSync(join(repoRoot, 'skills', skillName), join(targetDir, 'skills', skillName), { recursive: true })
  }

  return { targetDir, resources: resolved.resources, skills: conditionConfig.agentSkills ?? [] }
}

function main() {
  const [command, ...rest] = process.argv.slice(2)

  if (command === 'create') {
    const [experimentDir, condition, ...flags] = rest
    const outFlag = flags.find((flag) => flag.startsWith('--out='))

    if (experimentDir === undefined || condition === undefined) {
      console.error('Usage: node scripts/prepare-workspace.mjs create <experimentDir> <condition> [--out=<dir>]')
      process.exitCode = 1
      return
    }

    try {
      const result = prepareWorkspace(experimentDir, condition, {
        out: outFlag?.slice('--out='.length),
      })
      console.log(`ワークスペースを用意した: ${result.targetDir}`)
      console.log(`資源 ${result.resources.length} 件、Skill ${result.skills.length} 件`)
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error))
      process.exitCode = 1
    }

    return
  }

  if (command === 'check-starter') {
    const [experimentDir] = rest

    if (experimentDir === undefined) {
      console.error('Usage: node scripts/prepare-workspace.mjs check-starter <experimentDir>')
      process.exitCode = 1
      return
    }

    const problems = checkStarterMatchesRoot(REPO_ROOT, join(REPO_ROOT, experimentDir, 'starter'))

    if (problems.length > 0) {
      console.error(`\n${problems.join('\n')}`)
      process.exitCode = 1
      return
    }

    console.log('ok  starter がルート足場と一致する')
    return
  }

  console.error('Usage: node scripts/prepare-workspace.mjs <create|check-starter> ...')
  process.exitCode = 1
}

// テストから読み込むときは走らせない。process.exit と副作用（ファイル書き出し）を持つため。
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
