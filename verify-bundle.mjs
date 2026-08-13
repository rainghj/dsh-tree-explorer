/**
 * Runtime verification of the built bundle: simulate the browser module table
 * (window.__ModuleLoader__.load), execute the factory with stub platform
 * modules, exercise apply() (two slot registrations), and render the toggle
 * with a mini React-hooks harness so the async /tree-fs/config placement
 * gate can resolve. Run: node verify-bundle.mjs  (after node build.mjs)
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

globalThis.window = {}
let loaded = undefined
window.__ModuleLoader__ = { load: (entry) => { loaded = entry } }

// Stub the same-origin config fetch the toggle reads on mount (bundle default:
// sidebar-footer, matching the cordis.patch.yml config).
globalThis.fetch = async () => ({ json: async () => ({ entry: 'sidebar-footer' }) })

const code = readFileSync(fileURLToPath(new URL('./dist/client.js', import.meta.url)), 'utf8')
vm.runInThisContext(code, { filename: 'client.js' })

if (loaded === undefined) throw new Error('bundle did not call window.__ModuleLoader__.load')
if (loaded.id !== 'dsh-tree-explorer') throw new Error(`unexpected bundle id: ${loaded.id}`)
console.log('load() id OK:', loaded.id)

// Mini React harness: useState persists per render pass, useEffect queues
// effects (run + flush below), useMemo runs eagerly.
function createHarness() {
  const states = []
  let cursor = 0
  const effects = []
  const ReactStub = {
    Fragment: Symbol('Fragment'),
    createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }),
    useState: (init) => {
      const i = cursor++
      if (!(i in states)) states[i] = typeof init === 'function' ? init() : init
      return [states[i], (v) => { states[i] = typeof v === 'function' ? v(states[i]) : v }]
    },
    useEffect: (fn) => { effects.push(fn) },
    useMemo: (fn) => fn(),
  }
  const sandboxRequire = (id) => {
    if (id === 'react') return ReactStub
    throw new Error(`unexpected require(${id})`)
  }
  return {
    ReactStub, sandboxRequire, states,
    render(component, props) {
      cursor = 0
      return component(props)
    },
    async flushEffects() {
      // Run effects WITHOUT their cleanups (cleanup simulates unmount, which
      // this test never performs; running it here would set the fetch
      // guard's `cancelled` flag and suppress the state update).
      while (effects.length > 0) {
        const fn = effects.shift()
        fn()
      }
      // A macrotask tick lets every pending microtask of the stubbed fetch
      // chain (fetch → r.json() → setEntry) run before the next render.
      await new Promise((resolve) => setTimeout(resolve, 0))
    },
  }
}

const h = createHarness()
const plugin = loaded.factory(h.sandboxRequire)
if (plugin.name !== 'tree-panel') throw new Error(`bad name: ${plugin.name}`)
if (!Array.isArray(plugin.inject) || !plugin.inject.includes('slots')) {
  throw new Error(`bad inject: ${JSON.stringify(plugin.inject)}`)
}
if (typeof plugin.apply !== 'function') throw new Error('apply is not a function')
console.log('factory exports OK: name/inject/apply')

// apply() with a stub client ctx → expect TWO registrations.
const registered = []
const ctx = {
  slots: {
    inject: (name, cb) => { registered.push({ name, cb }) },
    register: (opts, comp) => ({ opts, comp }),
  },
}
plugin.apply(ctx)
const names = registered.map((r) => r.name).sort()
if (names.join(',') !== 'conversation.session.header.utilities,sidebar.footer.action') {
  throw new Error(`unexpected registrations: ${names.join(',')}`)
}
const byName = Object.fromEntries(registered.map((r) => [r.name, r.cb()]))
for (const key of ['sidebar.footer.action', 'conversation.session.header.utilities']) {
  const c = byName[key]
  if (c.opts.name !== key) throw new Error(`register name mismatch for ${key}`)
  if (c.opts.id !== 'tree-panel') throw new Error(`register id mismatch for ${key}`)
  if (typeof c.comp !== 'function') throw new Error(`component is not a function for ${key}`)
}
console.log('apply() OK: 2 registrations (sidebar.footer.action + conversation.session.header.utilities) id=tree-panel')

// Render the footer toggle: config says entry=sidebar-footer, so the footer
// instance renders the button while the header instance stays hidden.
// Default props for the runtime standard hooks.
const stdProps = {
  useSessions: (sel) => sel({ current: undefined }),
  useWorkspaces: (sel) => sel({ items: [{ path: 'C:/work' }] }),
}
const footerRender1 = h.render(byName['sidebar.footer.action'].comp, stdProps)
if (footerRender1 !== null) throw new Error('footer should render nothing before config loads')
await h.flushEffects() // resolve the config fetch → setEntry('sidebar-footer')
const footerRender2 = h.render(byName['sidebar.footer.action'].comp, stdProps)
const button = footerRender2?.children?.[0]
if (button?.type !== 'button' || button?.props?.title !== '目录树') {
  throw new Error(`footer button render mismatch: ${JSON.stringify(button)}`)
}
const headerRender = h.render(byName['conversation.session.header.utilities'].comp, stdProps)
if (headerRender !== null) throw new Error('header should stay hidden when entry=sidebar-footer')
console.log('render OK: entry=sidebar-footer → footer button title=目录树, header hidden')

console.log('VERIFY PASSED')
