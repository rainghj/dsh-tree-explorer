// Standalone smoke test for lib/tree-fs.js (no harness needed).
import { apply } from './lib/tree-fs.js'

let captured
const dispose = apply({ webServer: { register: (route) => { captured = route; return () => {} } } })

function call(url) {
  return new Promise((resolve) => {
    const res = {
      writeHead(status, headers) { res._status = status; res._headers = headers },
      end(body) { resolve({ status: res._status, body }) },
    }
    captured.handler({ url, headers: {} }, res)
  })
}

const repo = process.cwd().replace(/\\/g, '/')
const r1 = await call('/tree-fs/list?path=' + encodeURIComponent(repo))
const d1 = JSON.parse(r1.body)
console.log('list status:', r1.status)
console.log('crumbs tail:', d1.crumbs.at(-1).name)
console.log('entries count:', d1.entries.length)
const dirs = d1.entries.filter((e) => e.kind === 'directory').map((e) => e.name)
const files = d1.entries.filter((e) => e.kind === 'file').map((e) => e.name)
console.log('dirs:', dirs.join(', '))
console.log('files:', files.join(', '))

const r2 = await call('/tree-fs/read?path=' + encodeURIComponent(repo + '/package.json'))
const d2 = JSON.parse(r2.body)
console.log('read status:', r2.status, '| name:', d2.name, '| starts:', JSON.stringify(d2.content?.slice(0, 30)))

const r3 = await call('/tree-fs/list?path=' + encodeURIComponent(repo + '/../../..'))
const d3 = JSON.parse(r3.body)
console.log('traversal blocked status:', r3.status, '| error:', d3.error)

const r4 = await call('/tree-fs/git/status?path=' + encodeURIComponent(repo))
const d4 = JSON.parse(r4.body)
console.log('git status (not a repo yet):', r4.status, '| repo:', d4.repo, '| entries:', d4.entries.length)

console.log('TREE-FS SMOKE OK')
