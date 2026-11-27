import { execFileSync } from 'node:child_process'
import { mkdirSync, readdirSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const outDir = join(root, '.cache', 'test-build')

rmSync(outDir, { recursive: true, force: true })
mkdirSync(outDir, { recursive: true })

const testEntries = readdirSync(join(root, 'tests'))
  .filter((f) => f.endsWith('.test.ts'))
  .map((f) => join(root, 'tests', f))

const esbuildBin = join(
  root,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'esbuild.cmd' : 'esbuild',
)

execFileSync(
  esbuildBin,
  [
    ...testEntries,
    '--bundle',
    '--platform=node',
    '--format=esm',
    '--target=node22',
    `--outdir=${outDir}`,
    '--out-extension:.js=.mjs',
    '--external:node:*',
  ],
  { stdio: 'inherit', cwd: root },
)

const builtTests = readdirSync(outDir)
  .filter((f) => f.endsWith('.test.mjs'))
  .map((f) => join(outDir, f))

try {
  execFileSync(process.execPath, ['--test', ...builtTests], {
    stdio: 'inherit',
    cwd: root,
  })
} finally {
  rmSync(outDir, { recursive: true, force: true })
}
