/**
 * dsh-tree-explorer — browser half (CJS). Registers the "目录树" panel toggle
 * in BOTH the sidebar footer and the session-header utilities (top-right)
 * slots. The toggle component reads /tree-fs/config (entry:
 * sidebar-footer | header-utilities | hidden) and renders only in the slot
 * that matches, so the placement is a cordis.yml config on the tree-fs row,
 * not code. Bundled by build.mjs into dist/client.js; package.json
 * `dsh.client` makes clientModules serve it to the browser.
 * @module dsh-tree-explorer/client
 */

const { SidebarTreeAction } = require('./TreePanel.cjs')

/** Cordis plugin name used by loader diagnostics. */
exports.name = 'tree-panel'

/** Services required: the slot registry (the panel needs no host service). */
exports.inject = ['slots']

/**
 * Register the toggle in both candidate slots via `slots.inject()`: the
 * sidebar shell / session header may activate later or replace their
 * declarations, and this waits on the actual declaration, removes the
 * contribution if it collapses, and re-runs after redeclaration.
 * @param {import('@deepseek-ai/cordis').Context} ctx - client root context.
 */
exports.apply = function apply(ctx) {
  const footerAction = (props) => SidebarTreeAction({ ...props, slot: 'sidebar-footer' })
  const headerUtility = (props) => SidebarTreeAction({ ...props, slot: 'header-utilities' })

  ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
    name: 'sidebar.footer.action',
    id: 'tree-panel',
  }, footerAction))

  ctx.slots.inject('conversation.session.header.utilities', () => ctx.slots.register({
    name: 'conversation.session.header.utilities',
    id: 'tree-panel',
  }, headerUtility))
}
