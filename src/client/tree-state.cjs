/**
 * Pure state helpers for the sidebar directory-tree panel. No React, no
 * browser globals — unit-testable under plain Node. The React view owns
 * rendering; these functions own the state transitions. CJS so the zero-
 * dependency bundler can inline it verbatim.
 * @module tree-panel/tree-state
 */

/**
 * Toggle one path in an expand set, returning a new Set (immutable update).
 * @param {Set<string>} expanded - currently expanded directory paths.
 * @param {string} path - the directory path to toggle.
 * @returns {Set<string>} the next expand set.
 */
exports.togglePath = function togglePath(expanded, path) {
  const next = new Set(expanded)
  if (next.has(path)) next.delete(path)
  else next.add(path)
  return next
}

/**
 * Merge one loaded level into the children map, returning a new Map.
 * @param {ReadonlyMap<string, object[]>} childrenByPath - loaded levels keyed by directory path.
 * @param {string} path - the directory whose level was loaded.
 * @param {object[]} rows - the level's directory rows.
 * @returns {Map<string, object[]>} the next children map.
 */
exports.mergeChildren = function mergeChildren(childrenByPath, path, rows) {
  const next = new Map(childrenByPath)
  next.set(path, rows)
  return next
}

/**
 * The crumb to jump to for a breadcrumb click: crumbs are root-to-target, so
 * clicking crumb `index` navigates to that crumb's path. The last crumb is
 * the current directory and clicking it is a no-op for navigation.
 * @param {readonly { name: string, path: string }[]} crumbs - ancestor chain.
 * @param {number} index - clicked crumb index.
 * @returns {string|undefined} the path to load, or undefined to stay put.
 */
exports.crumbTarget = function crumbTarget(crumbs, index) {
  if (index < 0 || index >= crumbs.length) return undefined
  if (index === crumbs.length - 1) return undefined
  return crumbs[index].path
}

/**
 * Flatten the visible tree for rendering: pre-order rows with their indent
 * depth, derived from the expand set and the loaded levels. Rows with no
 * loaded level render as collapsed leaves.
 * @param {ReadonlyMap<string, object[]>} childrenByPath - loaded levels keyed by directory path ('' = root).
 * @param {ReadonlySet<string>} expanded - expanded directory paths.
 * @param {object[]} rootRows - the root level's rows.
 * @returns {{ row: object, depth: number, expanded: boolean, level: string }[]} visible rows in render order.
 */
exports.collectVisible = function collectVisible(childrenByPath, expanded, rootRows) {
  const out = []
  const walk = (rows, level, depth) => {
    for (const row of rows) {
      const path = row.path ?? `${level}/${row.name}`
      const isExpanded = expanded.has(path)
      out.push({ row, depth, expanded: isExpanded, level })
      if (isExpanded) {
        const kids = childrenByPath.get(path)
        if (kids !== undefined && kids.length > 0) walk(kids, path, depth + 1)
      }
    }
  }
  walk(rootRows ?? [], '', 0)
  return out
}
