/**
 * Zero-dependency bundler for the dsh-tree-explorer browser half. Reads the
 * CJS sources under src/client/, wraps each in a module function, and emits
 * dist/client.js in the harness clientBundle artifact contract:
 *
 *   window.__ModuleLoader__.load({
 *     id: "dsh-tree-explorer",
 *     factory: (require) => { var module = { exports: {} }; ... return module.exports; }
 *   })
 *
 * The bundle id MUST equal the loader entry's `name` (the package reference
 * in cordis.patch.yml): dsh-client-modules serves the bundle at
 * /plugins/<entry.name>/client.js and the browser module table keys by the
 * same id. Module-local requires resolve against the inlined table first,
 * then fall through to the injected require (react and the dsh-client-*
 * seeds the browser module table answers). Run with: node build.mjs  (Node
 * only, no npm install needed).
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ID = 'dsh-tree-explorer'

/** Module id → source file (all CJS, relative to the package root). */
const MODULES = {
  './tree-state.cjs': 'src/client/tree-state.cjs',
  './TreePanel.cjs': 'src/client/TreePanel.cjs',
  './index.cjs': 'src/client/index.cjs',
}

const parts = []
parts.push(`window.__ModuleLoader__.load({ id: ${JSON.stringify(ID)}, factory: (require) => {`)
parts.push('var module = { exports: {} }; var exports = module.exports;')
parts.push('var __modules = {};')
for (const [id, file] of Object.entries(MODULES)) {
  const source = readFileSync(join(HERE, file), 'utf8')
  parts.push(`__modules[${JSON.stringify(id)}] = function (module, exports, require) {`)
  parts.push(source)
  parts.push('};')
}
parts.push(`function __req(id) { var m = __modules[id]; if (!m) return require(id); var mod = { exports: {} }; m(mod, mod.exports, __req); return mod.exports; }`)
parts.push(`module.exports = __req(${JSON.stringify('./index.cjs')});`)
parts.push('return module.exports; } });')

const bundle = parts.join('\n')
mkdirSync(join(HERE, 'dist'), { recursive: true })
writeFileSync(join(HERE, 'dist', 'client.js'), bundle)
console.log(`built dist/client.js (${bundle.length} bytes)`)
