/**
 * Resolves the *absolute* backend origin the tunnel (Electron agent or
 * browser-extension agent) should connect its WebSocket to.
 *
 * This is deliberately separate from `provideApi('/api')` in `app.config.ts`:
 * that's a relative path resolved by the dev-server proxy (or a same-origin
 * reverse proxy in production), which works fine for the Angular app's own
 * HTTP calls but is meaningless outside the page — a browser extension's
 * background service worker has no such proxy and needs a real origin.
 */
export function resolveBackendUrl(): string {
  // Dev: the desktop SPA is served on :4300, proxied to the real API on
  // :3000 (see libs/ui/proxy.conf.json) — the same default the Electron
  // agent itself assumes (MCP_BRIDGE_WS_URL in electron/agent.js).
  if (location.port === '4300') {
    return 'http://localhost:3000';
  }
  // Production: assumes the SPA and API are served from the same origin
  // behind one reverse proxy.
  return location.origin;
}
