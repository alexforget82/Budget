import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { validateState } from "./validation.js";
import { openDatabase } from "./database.js";
import { simulate } from "./engine.js";
import { createService, cents } from "./service.js";
import { today, validDate, addDays } from "./dates.js";
import { planSillage, applySillage, hash } from "./import.js";
import { previewCSV } from "./csv.js";
const root = path.dirname(fileURLToPath(import.meta.url)),
  data = path.resolve(process.env.BDL_DATA || path.join(process.cwd(), "data"));
const store = openDatabase(data),
  service = createService(store),
  port = Number(process.env.PORT || 3040);
const privateConfig = (() => {
  try {
    return JSON.parse(
      fs.readFileSync(path.join(data, "private-access.json"), "utf8"),
    );
  } catch {
    return null;
  }
})();
if (
  privateConfig &&
  (!/^https:\/\/[a-z0-9.-]+\.ts\.net(?::8443)?$/.test(privateConfig.origin) ||
    typeof privateConfig.login !== "string" ||
    !privateConfig.login)
)
  throw Error("Configuration privée invalide.");
let backupError = null;
function backupToday() {
  try {
    if (store.setting("configured")) store.daily(today());
    backupError = null;
  } catch (e) {
    backupError =
      "Sauvegarde automatique impossible. Exportez une copie et vérifiez l’espace disque.";
    console.error(backupError + " " + e.message);
  }
}
function currentState() {
  const state = service.snapshot();
  if (backupError) state.simulation.warnings.push(backupError);
  return state;
}
backupToday();
setInterval(backupToday, 3600000).unref();
const same = (a, b) =>
  typeof a === "string" &&
  typeof b === "string" &&
  Buffer.byteLength(a) === Buffer.byteLength(b) &&
  timingSafeEqual(Buffer.from(a), Buffer.from(b));
const headers = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Content-Security-Policy":
    "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
};
function reply(res, code, body, type = "application/json; charset=utf-8") {
  res.writeHead(code, { ...headers, "Content-Type": type });
  res.end(type.startsWith("application/json") ? JSON.stringify(body) : body);
}
async function body(req) {
  let text = "";
  for await (const part of req) {
    text += part;
    if (Buffer.byteLength(text) > 8e6) {
      const e = Error("Requête limitée à 8 Mo.");
      e.status = 413;
      throw e;
    }
  }
  return JSON.parse(text || "{}");
}
function handler(isPrivate) {
  return async (req, res) => {
    try {
      const host = req.headers.host || "",
        origin = isPrivate ? privateConfig.origin : "http://" + host;
      if (
        isPrivate
          ? host !== new URL(privateConfig.origin).host
          : ![
              "127.0.0.1:" + port,
              "localhost:" + port,
              "[::1]:" + port,
            ].includes(host)
      )
        return reply(res, 403, { error: "Hôte refusé." });
      const url = new URL(req.url, origin),
        shared = url.pathname.match(
          /^\/s\/([^/]+)(\/data|\/manifest.webmanifest)?$/,
        ),
        token = store.setting("share_token");
      const sharedRequest =
        shared && same(shared[1], token) && req.method === "GET";
      if (
        isPrivate &&
        !sharedRequest &&
        ![
          "/app.js",
          "/view.js",
          "/styles.css",
          "/logo.svg",
          "/manifest.webmanifest",
        ].includes(url.pathname) &&
        req.headers["tailscale-user-login"]?.toLowerCase() !==
          privateConfig.login.toLowerCase()
      )
        return reply(res, 403, {
          error: "Accès privé réservé à votre compte Tailscale.",
        });
      if (isPrivate && !req.headers["tailscale-user-login"])
        return reply(res, 403, { error: "Connectez Tailscale." });
      if (shared) {
        if (!sharedRequest)
          return reply(res, 404, { error: "Lien indisponible." });
        if (shared[2] === "/data")
          return reply(res, 200, {
            version: "0.4.0",
            simulation: currentState().simulation,
          });
        const sharePath = "/s/" + shared[1];
        if (shared[2] === "/manifest.webmanifest") {
          const manifest = JSON.parse(
            fs.readFileSync(
              path.join(root, "public/manifest.webmanifest"),
              "utf8",
            ),
          );
          return reply(
            res,
            200,
            JSON.stringify({
              ...manifest,
              start_url: sharePath,
              scope: sharePath,
            }),
            "application/manifest+json",
          );
        }
        return reply(
          res,
          200,
          fs
            .readFileSync(path.join(root, "public/index.html"), "utf8")
            .replace(
              'href="/manifest.webmanifest"',
              'href="' + sharePath + '/manifest.webmanifest"',
            ),
          "text/html; charset=utf-8",
        );
      }
      if (req.method === "GET" && url.pathname === "/api/state")
        return reply(res, 200, currentState());
      if (req.method === "GET" && url.pathname === "/api/matches")
        return reply(
          res,
          200,
          service.matches(Object.fromEntries(url.searchParams)),
        );
      if (req.method === "GET" && url.pathname === "/api/export") {
        res.setHeader(
          "Content-Disposition",
          'attachment; filename="Le-bas-de-laine-' + today() + '.json"',
        );
        return reply(res, 200, store.exportData());
      }
      if (req.method === "GET" && url.pathname === "/api/share")
        return reply(res, 200, {
          path: token ? "/s/" + token : null,
          origin: privateConfig?.origin || null,
        });
      if (req.method === "POST" && url.pathname.startsWith("/api/")) {
        if (
          !req.headers["content-type"]?.startsWith("application/json") ||
          (req.headers.origin && req.headers.origin !== origin) ||
          req.headers["sec-fetch-site"] === "cross-site"
        )
          return reply(res, 403, { error: "Origine ou format refusé." });
        const x = await body(req);
        let result;
        if (url.pathname === "/api/reset") {
          if (x.confirm !== "EFFACER")
            throw Error(
              "Écrivez EFFACER pour réinitialiser Le bas de laine seulement.",
            );
          store.backup("avant-reinitialisation-" + Date.now());
          store.atomic(() => {
            for (const table of [...store.tables].reverse())
              store.run("DELETE FROM " + table);
            store.put("sequence", 0);
          });
          return reply(res, 200, currentState());
        }
        if (url.pathname === "/api/purchase/preview") {
          const data = store.state();
          const amount = cents(x.amount);
          if (
            amount <= 0 ||
            !validDate(x.date) ||
            x.date < today() ||
            x.date > addDays(today(), 60)
          )
            throw Error(
              "Montant positif et date au plus 60 jours après aujourd’hui requis, pour vérifier 30 jours complets.",
            );
          const account = data.accounts.find(
            (a) => a.id === Number(x.account_id),
          );
          if (!account || !(account.is_main || account.kind === "card"))
            throw Error("Choisissez le compte principal ou une carte.");
          const category_id = x.category_id ? Number(x.category_id) : null;
          if (category_id && !data.categories.some((c) => c.id === category_id))
            throw Error("Catégorie introuvable.");
          const baseline = simulate(data, today());
          const result = simulate(data, today(), 90, {
            amount_cents: amount,
            date: x.date,
            account_id: account.id,
            category_id,
            period_on: null,
          });
          const window = result.daily.filter(
            (d) => d.date >= x.date && d.date <= addDays(x.date, 29),
          );
          const min = window.reduce((a, b) =>
            a.safe_cents < b.safe_cents ? a : b,
          );
          const provisional = currentState().simulation.provisional;
          return reply(res, 200, {
            allowed: !provisional && min.safe_cents >= 0,
            provisional,
            minimum_cents: min.safe_cents,
            minimum_on: min.date,
            maximum_cents: Math.max(...window.map((d) => d.safe_cents)),
            days: window.length,
            available_cents: result.available_cents,
            baseline_available_cents: baseline.available_cents,
          });
        }
        if (url.pathname === "/api/recurrence/preview")
          return reply(res, 200, service.previewRecurrence(x));
        if (url.pathname === "/api/restore") {
          if (x.confirm !== "REMPLACER")
            throw Error("Confirmation REMPLACER requise.");
          store.restore(x.backup);
          return reply(res, 200, currentState());
        }
        if (url.pathname === "/api/import/preview") {
          const plan = planSillage(
            x.backup,
            x.reference || today(),
            store.state(),
          );
          if (!validDate(plan.reference) || plan.reference > today())
            throw Error("Date de référence invalide.");
          return reply(res, 200, {
            ...plan,
            source: undefined,
            rows: undefined,
          });
        }
        if (url.pathname === "/api/import/apply") {
          const plan = planSillage(
            x.backup,
            x.reference || today(),
            store.state(),
          );
          if (x.token !== plan.token)
            throw Error("L’aperçu a changé. Recommencez.");
          store.backup("avant-import-" + Date.now());
          result = store.atomic(() => {
            const result = applySillage(store, plan);
            validateState(store.state());
            service.snapshot();
            return result;
          });
        } else if (url.pathname === "/api/csv/preview")
          return reply(
            res,
            200,
            previewCSV(x.csv, x.options, store.state(), service),
          );
        else if (url.pathname === "/api/csv/apply") {
          const preview = previewCSV(x.csv, x.options, store.state(), service);
          if (preview.token !== x.token || preview.needs_mapping)
            throw Error("L’aperçu a changé.");
          result = store.atomic(() => {
            let count = 0;
            const seen = new Set();
            for (const choice of x.selected || []) {
              if (seen.has(choice.row))
                throw Error("Une ligne a été sélectionnée deux fois.");
              seen.add(choice.row);
              const row = preview.rows.find((r) => r.row === choice.row);
              if (!row || row.error || row.duplicate) continue;
              const occurrence = choice.occurrence;
              if (
                occurrence &&
                !row.matches.some(
                  (m) =>
                    m.rule_id === Number(occurrence.rule_id) &&
                    m.original_on === occurrence.original_on,
                )
              )
                throw Error("Suggestion de facture invalide.");
              service.transaction({
                account_id: x.options.account_id,
                category_id: x.options.category_id,
                description: row.description,
                amount: row.amount_cents / 100,
                date: row.date,
                included: x.options.included !== false,
                card_settled: x.options.card_settled === true,
                occurrence,
              });
              count++;
            }
            return { imported: count };
          });
        } else if (url.pathname === "/api/setup")
          store.atomic(() => service.setup(x));
        else if (url.pathname === "/api/transaction")
          store.atomic(() => service.transaction(x));
        else if (url.pathname === "/api/transfer")
          store.atomic(() => service.transfer(x));
        else if (url.pathname === "/api/checkpoint")
          result = store.atomic(() => service.checkpoint(x));
        else if (url.pathname === "/api/category")
          store.atomic(() => service.category(x));
        else if (url.pathname === "/api/recurrence")
          store.atomic(() => service.recurrence(x));
        else if (url.pathname === "/api/occurrence")
          store.atomic(() => service.occurrence(x));
        else if (url.pathname === "/api/account") {
          if (
            !String(x.name || "").trim() ||
            String(x.name).length > 100 ||
            (x.kind !== undefined && !["card", "bank"].includes(x.kind))
          )
            throw Error("Nom du moyen de paiement requis.");
          store.atomic(() =>
            store.run(
              "INSERT INTO accounts(name,kind) VALUES(?,?)",
              String(x.name).trim(),
              x.kind === "bank" ? "bank" : "card",
            ),
          );
        } else if (url.pathname === "/api/theme") {
          if (x.theme !== "system")
            throw Error(
              "L’apparence suit automatiquement le réglage de votre appareil.",
            );
          store.put("theme", x.theme);
        } else if (url.pathname === "/api/share") {
          if (x.action === "revoke") store.put("share_token", null);
          else if (x.action === "create")
            store.put("share_token", randomBytes(32).toString("hex"));
          else throw Error("Action inconnue.");
          result = {
            path: store.setting("share_token")
              ? "/s/" + store.setting("share_token")
              : null,
            origin: privateConfig?.origin || null,
          };
        } else if (
          !["/api/import/apply", "/api/csv/apply"].includes(url.pathname)
        )
          return reply(res, 404, { error: "Action inconnue." });
        backupToday();
        return reply(res, 200, { ...currentState(), result });
      }
      if (req.method !== "GET")
        return reply(res, 405, { error: "Méthode refusée." });
      const files = {
        "/": "index.html",
        "/app.js": "app.js",
        "/view.js": "view.js",
        "/demo.json": "demo.json",
        "/styles.css": "styles.css",
        "/logo.svg": "logo.svg",
        "/manifest.webmanifest": "manifest.webmanifest",
        "/maquettes": "maquettes.html",
        "/maquettes.js": "maquettes.js",
      };
      const file = files[url.pathname];
      if (!file) return reply(res, 404, { error: "Introuvable." });
      const type = file.endsWith(".html")
        ? "text/html; charset=utf-8"
        : file.endsWith(".js")
          ? "text/javascript; charset=utf-8"
          : file.endsWith(".css")
            ? "text/css; charset=utf-8"
            : file.endsWith(".svg")
              ? "image/svg+xml"
              : file.endsWith(".json")
                ? "application/json; charset=utf-8"
                : "application/manifest+json";
      return reply(
        res,
        200,
        file.endsWith(".json")
          ? JSON.parse(fs.readFileSync(path.join(root, "public", file), "utf8"))
          : fs.readFileSync(path.join(root, "public", file)),
        type,
      );
    } catch (e) {
      return reply(res, e.status || 400, { error: e.message });
    }
  };
}
const local = http.createServer(handler(false));
local.on("error", (e) => {
  console.error(
    e.code === "EADDRINUSE"
      ? "Le bas de laine tourne déjà sur le port " + port + "."
      : e.message,
  );
  process.exitCode = 1;
});
local.listen(port, "127.0.0.1", () =>
  console.log("Le bas de laine : http://localhost:" + port),
);
let privateServer;
if (privateConfig) {
  privateServer = http.createServer(handler(true));
  privateServer.listen(3041, "127.0.0.1", () =>
    console.log("Accès privé prêt sur 3041."),
  );
}
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => {
    privateServer?.close();
    local.close(() => {
      store.db.close();
      process.exit();
    });
  });
