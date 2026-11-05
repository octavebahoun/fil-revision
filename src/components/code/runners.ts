"use client";
import type { SqlResult } from "@/lib/code/compare";
import { escapeForScript } from "@/lib/code/compare";

type SqlJs = {
  Database: new () => {
    run(sql: string): void;
    exec(sql: string): { columns: string[]; values: unknown[][] }[];
    close(): void;
  };
};
let sqlPromise: Promise<SqlJs> | null = null;

async function sqlJs(): Promise<SqlJs> {
  if (!sqlPromise) {
    sqlPromise = import("sql.js").then((m) =>
      (m.default as unknown as (cfg: object) => Promise<SqlJs>)({ locateFile: () => "/sql/sql-wasm.wasm" }),
    );
  }
  return sqlPromise;
}

/** Exécute une requête SQL dans une base SQLite en mémoire, dans le navigateur (jamais sur le serveur). */
export async function runSql(setup: string, query: string): Promise<SqlResult> {
  const SQL = await sqlJs();
  const db = new SQL.Database();
  try {
    if (setup.trim()) db.run(setup);
    const res = db.exec(query);
    const last = res.at(-1);
    return { columns: last?.columns ?? [], rows: last?.values ?? [] };
  } finally {
    db.close();
  }
}

/**
 * Exécute du JavaScript dans une iframe isolée (sandbox, origine opaque), elle-même dans un Worker
 * arrêté au bout de 3 s (boucle infinie). Le code n'a accès ni à la page, ni aux cookies.
 */
export function runJs(code: string, nonce: string): Promise<{ lines: string[]; error: string | null }> {
  return new Promise((resolve) => {
    const id = Math.random().toString(36).slice(2);
    const iframe = document.createElement("iframe");
    iframe.setAttribute("sandbox", "allow-scripts");
    iframe.style.display = "none";
    const workerSrc = `const out=[];const fmt=(a)=>a.map(x=>typeof x==="string"?x:JSON.stringify(x)).join(" ");console.log=(...a)=>out.push(fmt(a));console.info=console.log;try{${code}\n;postMessage({lines:out,error:null})}catch(e){postMessage({lines:out,error:String(e&&e.message||e)})}`;
    iframe.srcdoc = `<!doctype html><script nonce="${nonce}">
      const src = ${JSON.stringify(escapeForScript(workerSrc))};
      const w = new Worker(URL.createObjectURL(new Blob([src], { type: "text/javascript" })));
      const t = setTimeout(() => { w.terminate(); parent.postMessage({ id: ${JSON.stringify(id)}, lines: [], error: "Le code a mis plus de 3 secondes (boucle infinie ?)." }, "*"); }, 3000);
      w.onmessage = (e) => { clearTimeout(t); w.terminate(); parent.postMessage({ id: ${JSON.stringify(id)}, ...e.data }, "*"); };
      w.onerror = (e) => { clearTimeout(t); parent.postMessage({ id: ${JSON.stringify(id)}, lines: [], error: e.message || "Erreur" }, "*"); };
    <\/script>`;
    const onMessage = (e: MessageEvent) => {
      if (e.source !== iframe.contentWindow || e.data?.id !== id) return;
      window.removeEventListener("message", onMessage);
      iframe.remove();
      resolve({ lines: e.data.lines ?? [], error: e.data.error ?? null });
    };
    window.addEventListener("message", onMessage);
    document.body.appendChild(iframe);
  });
}

export async function transpileTs(code: string): Promise<string> {
  const { transform } = await import("sucrase");
  return transform(code, { transforms: ["typescript"], disableESTransforms: true }).code;
}
