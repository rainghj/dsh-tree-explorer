/**
 * tree-panel — Node half. Exists so the plugin appears in the host cordis.yml
 * and Loader; the browser half ships through exports["./client"] and is
 * discovered through the `dsh.client` manifest declaration (mirroring
 * ui-directory-picker-browse). The empty apply is the Cordis contract: loader
 * diagnostics expect name/inject/apply on the module.
 * @module tree-panel
 */

export const name = 'tree-panel'

/** No host services are injected; the browser half does all the work. */
export const inject = []

/** No-op host-side registration. */
export function apply() {}
