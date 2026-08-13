/**
 * dsh-tree-explorer — browser view (CJS, hand-written createElement so the
 * zero-dependency bundler needs no JSX transform). A sidebar footer action
 * (folder button) opens a right-docked directory-tree panel listing FILES and
 * directories, rooted at the current conversation's workspace (no escape via
 * breadcrumbs — the tree is the only navigation, and it stays within the
 * workspace). The panel reads the bundle's host-side `tree-fs` JSON routes.
 * State transitions live in tree-state.cjs (pure and tested).
 *
 * Icons: Phosphor Regular (MIT) inlined as SVG path strings — matches the
 * dsh harness aesthetic (the official dsh web uses Phosphor via @dds/ui-icons).
 * @module dsh-tree-explorer/client/view
 */

const React = require('react')
const { createElement, useEffect, useMemo, useState } = React
const { collectVisible, mergeChildren, togglePath } = require('./tree-state.cjs')

/** createElement shorthand. */
const h = createElement

// ---------------------------------------------------------------------------
// Phosphor Regular SVG paths (viewBox 0 0 256 256, fill currentColor).
// Source: https://github.com/phosphor-icons/core  (MIT license)
// ---------------------------------------------------------------------------

const ICONS = {
  folder: 'M216,72H131.31L104,44.69A15.86,15.86,0,0,0,92.69,40H40A16,16,0,0,0,24,56V200.62A15.4,15.4,0,0,0,39.38,216H216.89A15.13,15.13,0,0,0,232,200.89V88A16,16,0,0,0,216,72ZM40,56H92.69l16,16H40ZM216,200H40V88H216Z',

  folderSimple: 'M216,72H130.67L102.93,51.2a16.12,16.12,0,0,0-9.6-3.2H40A16,16,0,0,0,24,64V200a16,16,0,0,0,16,16H216.89A15.13,15.13,0,0,0,232,200.89V88A16,16,0,0,0,216,72Zm0,128H40V64H93.33L123.2,86.4A8,8,0,0,0,128,88h88Z',

  file: 'M213.66,82.34l-56-56A8,8,0,0,0,152,24H56A16,16,0,0,0,40,40V216a16,16,0,0,0,16,16H200a16,16,0,0,0,16-16V88A8,8,0,0,0,213.66,82.34ZM160,51.31,188.69,80H160ZM200,216H56V40h88V88a8,8,0,0,0,8,8h48V216Z',

  fileTs: 'M147.81,196.31a20.82,20.82,0,0,1-9.19,15.23C133.43,215,127,216,121.13,216a61.34,61.34,0,0,1-15.19-2,8,8,0,0,1,4.31-15.41c4.38,1.2,15,2.7,19.55-.36.88-.59,1.83-1.52,2.14-3.93.34-2.67-.71-4.1-12.78-7.59-9.35-2.7-25-7.23-23-23.11a20.56,20.56,0,0,1,9-14.95c11.84-8,30.71-3.31,32.83-2.76a8,8,0,0,1-4.07,15.48c-4.49-1.17-15.23-2.56-19.83.56a4.54,4.54,0,0,0-2,3.67c-.12.9-.14,1.09,1.11,1.9,2.31,1.49,6.45,2.68,10.45,3.84C133.49,174.17,150.05,179,147.81,196.31ZM216,88V216a16,16,0,0,1-16,16H176a8,8,0,0,1,0-16h24V96H152a8,8,0,0,1-8-8V40H56v72a8,8,0,0,1-16,0V40A16,16,0,0,1,56,24h96a8,8,0,0,1,5.66,2.34l56,56A8,8,0,0,1,216,88Zm-56-8h28.69L160,51.31ZM80,144H40a8,8,0,0,0,0,16H52v48a8,8,0,0,0,16,0V160H80a8,8,0,0,0,0-16Z',

  fileTsx: 'M214.51,156.65,197.83,180l16.68,23.35a8,8,0,0,1-13,9.3L188,193.76l-13.49,18.89a8,8,0,1,1-13-9.3L178.17,180l-16.68-23.35a8,8,0,0,1,13-9.3L188,166.24l13.49-18.89a8,8,0,0,1,13,9.3ZM123.6,171.31c-4-1.16-8.14-2.35-10.45-3.84-1.25-.82-1.23-1-1.11-1.9a4.54,4.54,0,0,1,2-3.67c4.6-3.12,15.34-1.73,19.83-.56A8,8,0,0,0,138,145.86c-2.12-.55-21-5.22-32.84,2.76a20.58,20.58,0,0,0-9,14.95c-2,15.88,13.65,20.41,23,23.11,12.06,3.49,13.12,4.92,12.78,7.59-.31,2.41-1.26,3.33-2.14,3.93-4.6,3.06-15.17,1.56-19.55.35A8,8,0,0,0,105.94,214a60.63,60.63,0,0,0,15.19,2c5.82,0,12.3-1,17.49-4.46a20.82,20.82,0,0,0,9.19-15.23C150,179,133.49,174.17,123.6,171.31ZM80,144H40a8,8,0,0,0,0,16H52v48a8,8,0,0,0,16,0V160H80a8,8,0,0,0,0-16ZM216,88v24a8,8,0,0,1-16,0V96H152a8,8,0,0,1-8-8V40H56v72a8,8,0,0,1-16,0V40A16,16,0,0,1,56,24h96a8,8,0,0,1,5.66,2.34l56,56A8,8,0,0,1,216,88Zm-27.31-8L160,51.31V80Z',

  fileJs: 'M213.66,82.34l-56-56A8,8,0,0,0,152,24H56A16,16,0,0,0,40,40v72a8,8,0,0,0,16,0V40h88V88a8,8,0,0,0,8,8h48V216H176a8,8,0,0,0,0,16h24a16,16,0,0,0,16-16V88A8,8,0,0,0,213.66,82.34ZM160,51.31,188.69,80H160Zm-12.19,145a20.82,20.82,0,0,1-9.19,15.23C133.43,215,127,216,121.13,216a61.34,61.34,0,0,1-15.19-2,8,8,0,0,1,4.31-15.41c4.38,1.2,15,2.7,19.55-.36.88-.59,1.83-1.52,2.14-3.93.34-2.67-.71-4.1-12.78-7.59-9.35-2.7-25-7.23-23-23.11a20.56,20.56,0,0,1,9-14.95c11.84-8,30.71-3.31,32.83-2.76a8,8,0,0,1-4.07,15.48c-4.49-1.17-15.23-2.56-19.83.56a4.54,4.54,0,0,0-2,3.67c-.12.9-.14,1.09,1.11,1.9,2.31,1.49,6.45,2.68,10.45,3.84C133.49,174.17,150.05,179,147.81,196.31ZM80,152v38a26,26,0,0,1-52,0,8,8,0,0,1,16,0,10,10,0,0,0,20,0V152a8,8,0,0,1,16,0Z',

  fileJsx: 'M147.81,196.31a20.82,20.82,0,0,1-9.19,15.23C133.43,215,127,216,121.13,216a60.63,60.63,0,0,0-15.19-2,8,8,0,0,0,4.31-15.41c4.38,1.21,15,2.71,19.55-.35.88-.6,1.83-1.52,2.14-3.93.34-2.67-.72-4.1-12.78-7.59-9.35-2.7-25-7.23-23-23.11a20.58,20.58,0,0,1,9-14.95c11.85-8,30.72-3.31,32.84-2.76a8,8,0,0,1-4.07,15.48c-4.49-1.17-15.23-2.56-19.83.56a4.54,4.54,0,0,0-2,3.67c-.12.9-.14,1.08,1.11,1.9,2.31,1.49,6.45,2.68,10.45,3.84C133.49,174.17,150.05,179,147.81,196.31ZM72,144a8,8,0,0,0-8,8v38a10,10,0,0,1-20,0,8,8,0,0,0-16,0,26,26,0,0,0,52,0V152A8,8,0,0,0,72,144Zm140.65,1.49a8,8,0,0,0-11.16,1.86L188,166.24l-13.49-18.89a8,8,0,0,0-13,9.3L178.17,180l-16.68,23.35a8,8,0,0,0,13,9.3L188,193.76l13.49,18.89a8,8,0,0,0,13-9.3L197.83,180l16.68-23.35A8,8,0,0,0,212.65,145.49ZM216,88v24a8,8,0,0,1-16,0V96H152a8,8,0,0,1-8-8V40H56v72a8,8,0,0,1-16,0V40A16,16,0,0,1,56,24h96a8,8,0,0,1,5.66,2.34l56,56A8,8,0,0,1,216,88Zm-27.31-8L160,51.31V80Z',

  fileJson: 'M48,180c0,11,7.18,20,16,20a14.24,14.24,0,0,0,10.22-4.66A8,8,0,1,1,85.77,206.4,30,30,0,0,1,64,216c-17.65,0-32-16.15-32-36s14.35-36,32-36a30,30,0,0,1,21.77,9.6,8,8,0,1,1-11.55,11.06A14.24,14.24,0,0,0,64,160C55.18,160,48,169,48,180Zm79.6-8.69c-4-1.16-8.14-2.35-10.45-3.84-1.26-.81-1.23-1-1.12-1.9a4.54,4.54,0,0,1,2-3.67c4.6-3.12,15.34-1.73,19.83-.56a8,8,0,0,0,4.07-15.48c-2.12-.55-21-5.22-32.83,2.76a20.55,20.55,0,0,0-9,14.95c-2,15.88,13.64,20.41,23,23.11,12.07,3.49,13.13,4.92,12.78,7.59-.31,2.41-1.26,3.34-2.14,3.93-4.6,3.06-15.17,1.56-19.55.36a8,8,0,0,0-4.3,15.41,61.23,61.23,0,0,0,15.18,2c5.83,0,12.3-1,17.49-4.46a20.82,20.82,0,0,0,9.19-15.23C154,179,137.48,174.17,127.6,171.31Zm64,0c-4-1.16-8.14-2.35-10.45-3.84-1.25-.81-1.23-1-1.12-1.9a4.54,4.54,0,0,1,2-3.67c4.6-3.12,15.34-1.73,19.82-.56a8,8,0,0,0,4.07-15.48c-2.11-.55-21-5.22-32.83,2.76a20.58,20.58,0,0,0-8.95,14.95c-2,15.88,13.65,20.41,23,23.11,12.06,3.49,13.12,4.92,12.78,7.59-.31,2.41-1.26,3.34-2.15,3.93-4.6,3.06-15.16,1.56-19.54.36A8,8,0,0,0,173.93,214a61.34,61.34,0,0,0,15.19,2c5.82,0,12.3-1,17.49-4.46a20.81,20.81,0,0,0,9.18-15.23C218,179,201.48,174.17,191.59,171.31ZM40,112V40A16,16,0,0,1,56,24h96a8,8,0,0,1,5.66,2.34l56,56A8,8,0,0,1,216,88v24a8,8,0,1,1-16,0V96H152a8,8,0,0,1-8-8V40H56v72a8,8,0,0,1-16,0ZM160,80h28.68L160,51.31Z',

  fileHtml: 'M216,120V88a8,8,0,0,0-2.34-5.66l-56-56A8,8,0,0,0,152,24H56A16,16,0,0,0,40,40v80a8,8,0,0,0,16,0V40h88V88a8,8,0,0,0,8,8h48v24a8,8,0,0,0,16,0ZM160,51.31,188.69,80H160ZM68,160v48a8,8,0,0,1-16,0V192H32v16a8,8,0,0,1-16,0V160a8,8,0,0,1,16,0v16H52V160a8,8,0,0,1,16,0Zm56,0a8,8,0,0,1-8,8h-8v40a8,8,0,0,1-16,0V168H84a8,8,0,0,1,0-16h32A8,8,0,0,1,124,160Zm72,0v48a8,8,0,0,1-16,0V184l-9.6,12.8a8,8,0,0,1-12.8,0L148,184v24a8,8,0,0,1-16,0V160a8,8,0,0,1,14.4-4.8L164,178.67l17.6-23.47A8,8,0,0,1,196,160Zm56,48a8,8,0,0,1-8,8H216a8,8,0,0,1-8-8V160a8,8,0,0,1,16,0v40h20A8,8,0,0,1,252,208Z',

  fileMd: 'M213.66,82.34l-56-56A8,8,0,0,0,152,24H56A16,16,0,0,0,40,40v72a8,8,0,0,0,16,0V40h88V88a8,8,0,0,0,8,8h48V224a8,8,0,0,0,16,0V88A8,8,0,0,0,213.66,82.34ZM160,51.31,188.69,80H160ZM144,144H128a8,8,0,0,0-8,8v56a8,8,0,0,0,8,8h16a36,36,0,0,0,0-72Zm0,56h-8V160h8a20,20,0,0,1,0,40Zm-40-48v56a8,8,0,0,1-16,0V177.38L74.55,196.59a8,8,0,0,1-13.1,0L48,177.38V208a8,8,0,0,1-16,0V152a8,8,0,0,1,14.55-4.59L68,178.05l21.45-30.64A8,8,0,0,1,104,152Z',

  fileLock: 'M120,176h-8v-4a28,28,0,0,0-56,0v4H48a8,8,0,0,0-8,8v40a8,8,0,0,0,8,8h72a8,8,0,0,0,8-8V184A8,8,0,0,0,120,176Zm-48-4a12,12,0,0,1,24,0v4H72Zm40,44H56V192h56ZM213.66,82.34l-56-56A8,8,0,0,0,152,24H56A16,16,0,0,0,40,40v88a8,8,0,0,0,16,0V40h88V88a8,8,0,0,0,8,8h48V216H160a8,8,0,0,0,0,16h40a16,16,0,0,0,16-16V88A8,8,0,0,0,213.66,82.34ZM160,51.31,188.69,80H160Z',

  fileX: 'M213.66,82.34l-56-56A8,8,0,0,0,152,24H56A16,16,0,0,0,40,40V216a16,16,0,0,0,16,16H200a16,16,0,0,0,16-16V88A8,8,0,0,0,213.66,82.34ZM160,51.31,188.69,80H160ZM200,216H56V40h88V88a8,8,0,0,0,8,8h48V216Zm-42.34-82.34L139.31,152l18.35,18.34a8,8,0,0,1-11.32,11.32L128,163.31l-18.34,18.35a8,8,0,0,1-11.32-11.32L116.69,152,98.34,133.66a8,8,0,0,1,11.32-11.32L128,140.69l18.34-18.35a8,8,0,0,1,11.32,11.32Z',

  // Fallback for css/rust/toml/yaml/sh/py etc.
  fileCode: 'M69.84,154.32,90.34,176a8,8,0,0,1-11.31,11.31L37.66,145.94a16,16,0,0,1,0-22.62l41.37-41.37a8,8,0,0,1,11.32,11.31L48.92,134.65Zm116.32-52.64L165,79.37a8,8,0,0,1,11.32-11.31l41.37,41.37a16,16,0,0,1,0,22.62L176.32,173.42a8,8,0,0,1-11.31-11.31L185.51,146.62,165,126.34A8,8,0,0,1,186.16,101.68Z',

  caretRight: 'M181.66,133.66l-80,80a8,8,0,0,1-11.32-11.32L164.69,128,90.34,53.66a8,8,0,0,1,11.32-11.32l80,80A8,8,0,0,1,181.66,133.66Z',

  caretDown: 'M213.66,101.66l-80,80a8,8,0,0,1-11.32,0l-80-80A8,8,0,0,1,53.66,90.34L128,164.69l74.34-74.35a8,8,0,0,1,11.32,11.32Z',
}

/** Render an inline SVG icon (currentColor inherits the parent color). */
function iconSvg(name, size) {
  return h('svg', { width: size, height: size, viewBox: '0 0 256 256', fill: 'currentColor', 'aria-hidden': 'true' },
    h('path', { d: ICONS[name] }))
}

/** Extension → icon name. Missing entries fall back to 'file'. */
const FILE_ICON_BY_EXT = {
  ts: 'fileTs', tsx: 'fileTsx',
  js: 'fileJs', jsx: 'fileJsx',
  json: 'fileJson',
  html: 'fileHtml', htm: 'fileHtml',
  md: 'fileMd', mdx: 'fileMd',
  lock: 'fileLock',
  // Code-style fallbacks for languages dsh-tree-explorer doesn't ship dedicated icons for.
  css: 'fileCode', scss: 'fileCode', less: 'fileCode',
  rs: 'fileCode',
  toml: 'fileCode', yaml: 'fileCode', yml: 'fileCode',
  sh: 'fileCode', bash: 'fileCode', py: 'fileCode',
  txt: 'file',
  // Whole-name special cases (no extension).
  gitignore: 'fileX', dockerignore: 'fileX', gitattributes: 'fileX', env: 'fileCode',
}

function getFileIcon(name) {
  const lower = name.toLowerCase()
  if (FILE_ICON_BY_EXT[lower] !== undefined) return FILE_ICON_BY_EXT[lower]
  const ext = lower.split('.').pop() ?? ''
  return FILE_ICON_BY_EXT[ext] ?? 'file'
}

// ---------------------------------------------------------------------------
// Styles (right-docked, full-height, dsh's dark surface tones)
// ---------------------------------------------------------------------------

const BUTTON_STYLE = {
  width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'transparent', border: 'none', borderRadius: 6, cursor: 'pointer', color: '#9aa4b2',
}
const BUTTON_HOVER = Object.assign({}, BUTTON_STYLE, { background: 'rgba(255,255,255,0.08)' })

const PANEL_STYLE = {
  position: 'fixed', right: 0, top: 0, bottom: 0, width: 320, maxWidth: '40vw',
  background: '#1b2029', borderLeft: '1px solid #2e3644',
  boxShadow: '-4px 0 16px rgba(0,0,0,0.45)', padding: 8, zIndex: 1000,
  fontFamily: 'system-ui, sans-serif', fontSize: 13, color: '#d7dce4',
  display: 'flex', flexDirection: 'column',
}

const ROW_STYLE = {
  display: 'flex', alignItems: 'center', gap: 4, padding: '3px 6px', borderRadius: 5,
  cursor: 'pointer', whiteSpace: 'nowrap', userSelect: 'none',
}

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

function fetchListing(path, signal) {
  return fetch(`/tree-fs/list?path=${encodeURIComponent(path)}`, { signal })
    .then(async (res) => {
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error ?? `HTTP ${res.status}`)
      }
      return res.json()
    })
}

function loadLevel(path, setLevels, setListing, setLoading, setError, signal) {
  setLoading(path)
  setError(null)
  return fetchListing(path, signal).then((listing) => {
    setLevels((prev) => mergeChildren(prev, listing.path, listing.entries))
    setListing(listing)
    return listing
  }).catch((err) => {
    if (signal?.aborted) return undefined
    setError(err?.message ?? String(err))
    return undefined
  }).finally(() => {
    setLoading((prev) => (prev === path ? null : prev))
  })
}

// ---------------------------------------------------------------------------
// The right-docked tree panel
// ---------------------------------------------------------------------------

function TreePanelView({ initialPath, onClose }) {
  const [levels, setLevels] = useState(() => new Map())
  const [expanded, setExpanded] = useState(() => new Set())
  const [loading, setLoading] = useState(null)
  const [error, setError] = useState(null)
  const [listing, setListing] = useState(undefined)
  const [showHidden, setShowHidden] = useState(false)

  // The tree is always rooted at the WORKSPACE ROOT (initialPath), not at the
  // most-recently-loaded directory. Expanding a sub-folder stores its entries
  // under that folder's path in `levels`, but the tree body keeps rendering
  // the root's children with sub-folders expanded inline.
  const rootKey = initialPath
  const rootRows = rootKey === undefined ? undefined : levels.get(rootKey)

  useEffect(() => {
    const controller = new AbortController()
    void loadLevel(initialPath, setLevels, setListing, setLoading, setError, controller.signal)
    return () => controller.abort()
  }, []) // mount only; the panel instance is the navigation scope

  const onRowClick = (row, path) => {
    if (row.kind !== 'directory') return // M1: files are leaf rows (preview arrives in M2)
    if (expanded.has(path)) {
      setExpanded((prev) => togglePath(prev, path))
      return
    }
    setExpanded((prev) => togglePath(prev, path))
    if (levels.get(path) === undefined) {
      void loadLevel(path, setLevels, setListing, setLoading, setError)
    }
  }

  const visible = useMemo(
    () => collectVisible(levels, expanded, rootRows === undefined ? [] : rootRows.filter((r) => showHidden || r.hidden !== true)),
    [levels, expanded, rootRows, showHidden],
  )

  const header = h('div', { style: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 } },
    h('span', { style: { fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }, title: initialPath ?? '' },
      h('span', { style: { width: 16, height: 16, color: '#e0c976', display: 'inline-flex' } }, iconSvg('folder', 16)),
      h('span', null, initialPath ? initialPath.split(/[\\/]/).pop() : '\u76ee\u5f55'),
    ),
    loading != null ? h('span', { style: { color: '#8b94a3', fontSize: 12 } }, '\u52a0\u8f7d\u4e2d\u2026') : null,
    h('span', { style: { marginLeft: 'auto', display: 'flex', gap: 4 } },
      h('button', {
        type: 'button',
        onClick: () => setShowHidden((v) => !v),
        style: Object.assign({}, BUTTON_STYLE, { width: 'auto', padding: '0 8px', fontSize: 12 }),
        title: '\u663e\u793a\u9690\u85cf\u9879',
      }, showHidden ? '\u9690\u85cf' : '\u663e\u793a\u9690\u85cf'),
      h('button', { type: 'button', onClick: onClose, style: Object.assign({}, BUTTON_STYLE, { width: 28, height: 28 }), title: '\u5173\u95ed' }, '\u2715'),
    ),
  )

  const errorBlock = error != null
    ? h('div', { style: { color: '#e06c75', margin: '4px 0', padding: '4px 0' } },
        error,
        h('button', {
          type: 'button',
          onClick: () => void loadLevel(rootKey ?? initialPath, setLevels, setListing, setLoading, setError),
          style: Object.assign({}, BUTTON_STYLE, { width: 'auto', padding: '0 8px', fontSize: 12, color: '#61afef', marginTop: 4 }),
        }, '\u91cd\u8bd5'),
      )
    : null

  const treeBody = visible.length === 0 && loading === null && error === null
    ? h('div', { style: { color: '#8b94a3', padding: 8 } }, '\uff08\u7a7a\u76ee\u5f55\uff09')
    : visible.map(({ row, depth, expanded: isExpanded }) => {
      const path = row.path ?? ''
      const isDir = row.kind === 'directory'
      return h('div', {
        key: path,
        style: Object.assign({}, ROW_STYLE, { paddingLeft: 6 + depth * 16 }),
        onClick: () => onRowClick(row, path),
        title: path,
      },
        h('span', { style: { width: 12, color: '#8b94a3', display: 'inline-flex' } },
          isDir ? iconSvg(isExpanded ? 'caretDown' : 'caretRight', 12) : null),
        h('span', { style: { width: 16, height: 16, color: isDir ? '#e0c976' : '#8b94a3', display: 'inline-flex' } },
          iconSvg(isDir ? 'folder' : getFileIcon(row.name), 14)),
        h('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis' } }, row.name),
      )
    })

  return h('div', { style: PANEL_STYLE, role: 'dialog', 'aria-label': '\u76ee\u5f55\u6811' },
    h('div', null, header, errorBlock),
    h('div', { style: { flex: 1, overflowY: 'auto', minHeight: 0 } }, treeBody))
}

// ---------------------------------------------------------------------------
// The sidebar footer action
// ---------------------------------------------------------------------------

/**
 * The panel toggle: a folder-icon button opening the right-docked directory
 * panel. The component is registered in BOTH the sidebar footer and the
 * session-header utilities slots; it reads /tree-fs/config (entry:
 * sidebar-footer | header-utilities | hidden) and renders only in the slot
 * that matches, so the placement is a cordis.yml config, not code.
 * @param {object} props - slot ('sidebar-footer' | 'header-utilities'), plus
 *   the standard props (useSessions, useWorkspaces) from the runtime share.
 */
function SidebarTreeAction({ slot = 'sidebar-footer', useSessions, useWorkspaces }) {
  const [open, setOpen] = useState(false)
  const [hover, setHover] = useState(false)
  const [entry, setEntry] = useState(null)

  // SnapshotSelectorHook: requires a selector. Resolve the panel root to the
  // workspace that owns the current session (the conversation's working
  // directory), mirroring the harness's own resolution
  // (packages/client/runtime/src/client/workspaces/service.ts:180-183). Fall
  // back to the first workspace when no session is current.
  // NOTE: hooks must run unconditionally — the early returns below (placement
  // gate) come AFTER every hook, or React's hook-count check throws.
  const currentSessionId = useSessions((s) => s.current ?? undefined)
  const initialPath = useWorkspaces((state) => {
    const owned = currentSessionId === undefined
      ? undefined
      : state.items.find((item) => item.sessionIds.includes(currentSessionId))
    return owned?.path ?? state.items[0]?.path ?? undefined
  })

  useEffect(() => {
    let cancelled = false
    fetch('/tree-fs/config').then((r) => r.json()).then((cfg) => {
      if (!cancelled) setEntry(cfg?.entry ?? 'sidebar-footer')
    }).catch(() => {
      if (!cancelled) setEntry('sidebar-footer')
    })
    return () => { cancelled = true }
  }, [])

  // Placement is config-driven: render nothing until config loads, and only
  // in the slot that matches (or anywhere when hidden).
  if (entry === null || entry === 'hidden' || entry !== slot) return null

  return h(React.Fragment, null,
    h('button', {
      type: 'button',
      title: '\u76ee\u5f55\u6811',
      'aria-label': '\u76ee\u5f55\u6811',
      onMouseEnter: () => setHover(true),
      onMouseLeave: () => setHover(false),
      onClick: () => setOpen((v) => !v),
      style: hover ? BUTTON_HOVER : BUTTON_STYLE,
    }, h('span', { style: { width: 16, height: 16, color: '#9aa4b2', display: 'inline-flex' } }, iconSvg('folderSimple', 16))),
    open ? h(TreePanelView, { initialPath, onClose: () => setOpen(false) }) : null,
  )
}

exports.TreePanelView = TreePanelView
exports.SidebarTreeAction = SidebarTreeAction