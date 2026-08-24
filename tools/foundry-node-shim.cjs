/**
 * Electron's ELECTRON_RUN_AS_NODE mode keeps `process.versions.electron`, while
 * Foundry uses that property to decide whether to create a desktop window.
 * Remove only the Electron marker before Foundry's entry point is evaluated so
 * the bundled Node 24 runtime follows Foundry's server-only path.
 *
 * @license MIT
 */

delete process.versions.electron;
