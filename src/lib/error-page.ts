import { escapeHtml } from "./output-encoding";

/** Safe for server logs: do not serialize arbitrary errors, URLs, tokens or stack locals. */
export function errorLogSummary(_error?: unknown): string {
  return "ClinicX request failed; private error details withheld";
}

/** Default is production-safe. Debug output requires a deliberate trusted dev caller. */
export function renderErrorPage(error?: unknown, options: { development?: boolean } = {}): string {
  const errorMessage = options.development
    ? escapeHtml(error instanceof Error ? error.stack || error.message : String(error || "Unknown error"))
    : "";
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>This page didn't load</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { font: 15px/1.5 system-ui, -apple-system, sans-serif; background: #fafafa; color: #111; display: grid; place-items: center; min-height: 100vh; margin: 0; padding: 1.5rem; }
      .card { max-width: 40rem; width: 100%; text-align: center; padding: 2rem; }
      h1 { font-size: 1.25rem; margin: 0 0 0.5rem; }
      p { color: #4b5563; margin: 0 0 1.5rem; }
      .actions { display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap; margin-bottom: 2rem; }
      a, button { padding: 0.5rem 1rem; border-radius: 0.375rem; font: inherit; cursor: pointer; text-decoration: none; border: 1px solid transparent; }
      .primary { background: #111; color: #fff; }
      .secondary { background: #fff; color: #111; border-color: #d1d5db; }
      pre { text-align: left; background: #e5e7eb; padding: 1rem; border-radius: 0.375rem; overflow-x: auto; font-size: 0.875rem; color: #b91c1c; white-space: pre-wrap; word-break: break-all; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>This page didn't load</h1>
      <p>Something went wrong on our end. You can try refreshing or head back home.</p>
      <div class="actions">
        <button class="primary" onclick="location.reload()">Try again</button>
        <a class="secondary" href="/">Go home</a>
        <a class="secondary" href="/contact">Contact support</a>
      </div>
      ${options.development ? `<pre><code>${errorMessage}</code></pre>` : ""}
    </div>
  </body>
</html>`;
}
