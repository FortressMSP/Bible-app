// API.Bible Fair Use Management System: every time licensed text is displayed, the
// fumsId returned with it must be reported through API.Bible's FUMS script.
declare global {
  interface Window {
    _BAPI?: { t?: (id: string) => void };
  }
}

const DEFAULT_SCRIPT = "https://cdn.scripture.api.bible/fums/fumsv2.min.js";
let loading: Promise<void> | null = null;
const reported = new Set<string>();

function loadScript(src?: string): Promise<void> {
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src ? (/^https?:\/\//.test(src) ? src : `https://${src.replace(/^\/+/, "")}`) : DEFAULT_SCRIPT;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => {
        loading = null;
        reject(new Error("FUMS script failed to load"));
      };
      document.head.appendChild(s);
    });
  }
  return loading;
}

/** Report a view of text served with this fumsId (once per page view of that text). */
export function reportFums(fumsId: string | undefined, script?: string) {
  if (!fumsId || reported.has(fumsId)) return;
  reported.add(fumsId);
  loadScript(script).then(
    () => window._BAPI?.t?.(fumsId),
    () => reported.delete(fumsId),
  );
}
