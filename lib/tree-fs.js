/**
 * tree-fs — host-side file/git JSON service for the dsh-tree-explorer panel.
 * Registers a `/tree-fs` prefix route on `ctx.webServer` and answers:
 *
 *   GET /tree-fs/list?path=<abs>         → { path, crumbs, entries }
 *       entries: [{ name, path, hidden, kind: 'directory'|'file'|'other', size, mtime }]
 *   GET /tree-fs/read?path=<abs>         → { path, name, content }   (text, 1 MiB cap)
 *   GET /tree-fs/git/status?path=<abs>   → { repo|null, entries: [{ path, index, worktree }] }
 *   GET /tree-fs/git/diff?path=<abs>&file=<rel>&staged=1 → { repo|null, diff }
 *   GET /tree-fs/config                  → { entry }   (panel entry placement; cordis.yml config)
 *
 * Everything is the bundle's own code — no official harness capability is
 * touched. The route is same-origin with the Web UI (the page is served by
 * the same dsh webserver), so the browser fetches it with no CORS setup.
 *
 * Security (M1): paths must be absolute and contain no `..` segment; the
 * response caps listing size and read size. Hardening still to do: Origin /
 * Host validation against trustedHosts, and confining to the workspace roots
 * (the service currently serves any absolute path the local user's browser
 * requests).
 * @module dsh-tree-explorer/tree-fs
 */

import { readdir, stat, readFile } from 'node:fs/promises'
import { basename, dirname, isAbsolute, join, resolve } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import z from '@deepseek-ai/schemastery'

const execFileP = promisify(execFile)

/** Cordis plugin name used by loader diagnostics. */
export const name = 'tree-fs'

/** Services required: the webserver route table. */
export const inject = ['webServer']

/**
 * Plugin config (set in the bundle's cordis.patch.yml row; the client reads
 * it back through GET /tree-fs/config because browser boot carries no config).
 * @typedef {{ entry: 'sidebar-footer'|'header-utilities'|'hidden' }} Config
 */
export const Config = z.object({
  entry: z.union(['sidebar-footer', 'header-utilities', 'hidden']).default('sidebar-footer'),
})

/** Cap on listing rows per level; the listing stops enumerating past it. */
const MAX_ENTRIES = 2000
/** Cap on a single file read; larger files fail loud with 413. */
const MAX_READ_BYTES = 1024 * 1024
/** Cap on a git subprocess run (status/diff). */
const GIT_TIMEOUT_MS = 5000
const GIT_MAX_BUFFER = 4 * 1024 * 1024

/** Hidden by the platform convention (dot-prefixed); Windows hidden attribute is not consulted (M1). */
function isHidden(name) {
  return name.startsWith('.')
}

/**
 * Reject path traversal: the input must be absolute and contain no `..`
 * segment. Returns the normalized absolute path.
 * @param {string} input - the `path` query value.
 * @returns {string} the resolved absolute path.
 */
function safePath(input) {
  if (typeof input !== 'string' || input === '') throw new Error('path is required')
  if (!isAbsolute(input)) throw new Error(`path must be absolute: ${input}`)
  if (input.split(/[\\/]/).includes('..')) throw new Error('path traversal is not allowed')
  return resolve(input)
}

/** Ancestor chain from the filesystem root to `target` inclusive — breadcrumb rows. */
function ancestryCrumbs(target) {
  const crumbs = []
  let current = target
  for (;;) {
    const parent = dirname(current)
    crumbs.unshift({ name: parent === current ? current : basename(current), path: current, hidden: false })
    if (parent === current) return crumbs
    current = parent
  }
}

/**
 * List one level: files AND directories, directories first then files, each
 * name-sorted (numeric-aware). Symlinks resolve through `stat` for kind.
 * @param {string} dir - absolute directory path.
 * @returns {Promise<object[]>} entry rows.
 */
async function listDirectory(dir) {
  const dirents = await readdir(dir, { withFileTypes: true })
  const entries = []
  for (const d of dirents) {
    if (entries.length >= MAX_ENTRIES) break
    const p = join(dir, d.name)
    let kind = d.isDirectory() ? 'directory' : d.isFile() ? 'file' : 'other'
    let size = 0
    let mtime = 0
    try {
      const st = await stat(p)
      if (d.isSymbolicLink()) kind = st.isDirectory() ? 'directory' : 'file'
      size = st.size
      mtime = st.mtimeMs
    } catch { /* keep the dirent-derived kind for unreadable entries */ }
    entries.push({ name: d.name, path: p, hidden: isHidden(d.name), kind, size, mtime })
  }
  entries.sort((a, b) => {
    const aDir = a.kind === 'directory'
    const bDir = b.kind === 'directory'
    if (aDir !== bDir) return aDir ? -1 : 1
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
  })
  return entries
}

/** Find the git worktree root containing `dir`, or undefined when not a repo. */
async function findRepo(dir) {
  try {
    const { stdout } = await execFileP('git', ['-C', dir, 'rev-parse', '--show-toplevel'], { timeout: GIT_TIMEOUT_MS, maxBuffer: 1 << 16 })
    const root = stdout.trim()
    return root === '' ? undefined : root
  } catch {
    return undefined
  }
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  res.end(JSON.stringify(body))
}

/** Resolved config (module-scope so the route handler can read it; set in apply). */
let currentConfig = { entry: 'sidebar-footer' }

/** Route dispatch for everything under /tree-fs/*. */
async function handle(req, res) {
  try {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const sp = url.pathname
    const q = url.searchParams

    if (sp === '/tree-fs/list') {
      const dir = safePath(q.get('path'))
      const [crumbs, entries] = await Promise.all([Promise.resolve(ancestryCrumbs(dir)), listDirectory(dir)])
      return sendJson(res, 200, { path: dir, crumbs, entries })
    }

    if (sp === '/tree-fs/read') {
      const p = safePath(q.get('path'))
      const st = await stat(p)
      if (!st.isFile()) return sendJson(res, 400, { error: 'not a file' })
      if (st.size > MAX_READ_BYTES) {
        return sendJson(res, 413, { error: `file too large (${st.size} bytes, cap ${MAX_READ_BYTES})` })
      }
      const content = await readFile(p, 'utf8')
      return sendJson(res, 200, { path: p, name: basename(p), content })
    }

    if (sp === '/tree-fs/git/status') {
      const dir = safePath(q.get('path'))
      const repo = await findRepo(dir)
      if (repo === undefined) return sendJson(res, 200, { repo: null, entries: [] })
      const { stdout } = await execFileP('git', ['-C', repo, 'status', '--porcelain=v1'], { timeout: GIT_TIMEOUT_MS, maxBuffer: GIT_MAX_BUFFER })
      const entries = []
      for (const line of stdout.split('\n')) {
        if (line === '') continue
        const index = line[0]
        const worktree = line[1]
        const rest = line.slice(3)
        // porcelain v1 rename rows read "XY old -> new"; report the new path.
        const path = rest.includes(' -> ') ? rest.split(' -> ')[1] : rest
        entries.push({ path, index, worktree })
      }
      return sendJson(res, 200, { repo, entries })
    }

    if (sp === '/tree-fs/git/diff') {
      const dir = safePath(q.get('path'))
      const repo = await findRepo(dir)
      if (repo === undefined) return sendJson(res, 200, { repo: null, diff: '' })
      const file = q.get('file')
      const staged = q.get('staged') === '1'
      const args = ['-C', repo, 'diff', ...(staged ? ['--cached'] : []), '--']
      if (file !== null && file !== '') args.push(file)
      const { stdout } = await execFileP('git', args, { timeout: GIT_TIMEOUT_MS, maxBuffer: GIT_MAX_BUFFER })
      return sendJson(res, 200, { repo, diff: stdout })
    }

    if (sp === '/tree-fs/config') {
      return sendJson(res, 200, { entry: currentConfig.entry })
    }

    return sendJson(res, 404, { error: `no such route: ${sp}` })
  } catch (err) {
    const message = err?.message ?? String(err)
    const status = message === 'path is required' || message === 'path must be absolute: ' ? 400 : 500
    return sendJson(res, /^path |not a file|too large|traversal/.test(message) ? 400 : status, { error: message })
  }
}

/**
 * Mount the /tree-fs route. Returns the route disposer (cordis effect
 * contract: unloading this plugin removes the route).
 * @param {import('@deepseek-ai/cordis').Context} ctx - plugin context.
 * @param {Config} config - resolved plugin config (patch row `config`).
 */
export function apply(ctx, config = {}) {
  currentConfig = { entry: config.entry ?? 'sidebar-footer' }
  const dispose = ctx.webServer.register({ kind: 'prefix', path: '/tree-fs', handler: handle })
  return dispose
}
