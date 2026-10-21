import { chatgptSnapshot } from "./chatgpt-export.js";
export function createReadRoutes({
  createHash,
  dir,
  features,
  globalBudget,
  journey,
  listTransactions,
  monthlyBudget,
  path,
  privateAccess,
  proWorkspace,
  q,
  reply,
  sharedPath,
  snapshot,
  support,
  todayLocal,
}) {
  return function handle(req, res) {
    if (
      req.method === "GET" &&
      (req.url === "/api/chatgpt/export" ||
        req.url.startsWith("/api/chatgpt/export?"))
    ) {
      const history =
        new URL(req.url, "http://localhost").searchParams.get("history") ||
        "90";
      if (!["90", "365", "all"].includes(history))
        return reply(res, 400, { error: "Période invalide." });
      const state = snapshot(),
        today = todayLocal(),
        budgets = [];
      for (let offset = -3; offset <= 3; offset++) {
        const month = new Date(
          Date.UTC(
            Number(today.slice(0, 4)),
            Number(today.slice(5, 7)) - 1 + offset,
            1,
            12,
          ),
        )
          .toISOString()
          .slice(0, 7);
        budgets.push(globalBudget.monthState(month));
      }
      const file = chatgptSnapshot({ state, today, history, budgets });
      res.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="Sillage-pour-ChatGPT-${today}.json"`,
        "Cache-Control": "no-store",
      });
      return res.end(JSON.stringify(file, null, 2));
    }
    if (req.method === "GET" && req.url.startsWith("/api/budget/global?"))
      return reply(
        res,
        200,
        globalBudget.monthState(
          new URL(req.url, "http://localhost").searchParams.get("month"),
        ),
      );
    if (req.method === "GET" && req.url === "/api/sharing")
      return reply(res, 200, {
        path: sharedPath(),
        origin: privateAccess?.origin || null,
      });
    if (req.method === "GET" && req.url === "/api/private/status")
      return reply(res, 200, {
        version: "11.5.0",
        data_key: createHash("sha256").update(path.resolve(dir)).digest("hex"),
        enabled: !!privateAccess,
        origin: privateAccess?.origin || null,
        port: privateAccess?.port || null,
      });
    if (req.method === "GET" && req.url.startsWith("/api/setup/recovery?")) {
      const name = new URL(req.url, "http://localhost").searchParams.get(
          "name",
        ),
        body = journey.recoveryFile(name);
      res.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": 'attachment; filename="' + name + '"',
        "Cache-Control": "no-store",
      });
      return res.end(body);
    }
    if (req.method === "GET" && req.url.startsWith("/api/support/backup?")) {
      const date = new URL(req.url, "http://localhost").searchParams.get(
          "date",
        ),
        body = support.dailyFile(date);
      res.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="budget-${date}.json"`,
        "Cache-Control": "no-store",
      });
      return res.end(body);
    }
    if (req.method === "GET" && req.url.startsWith("/api/support/search?"))
      return reply(
        res,
        200,
        support.search(
          new URL(req.url, "http://localhost").searchParams.get("q"),
        ),
      );
    if (req.method === "GET" && req.url.startsWith("/api/pro/overview?")) {
      const p = new URL(req.url, "http://localhost").searchParams;
      return reply(
        res,
        200,
        proWorkspace.overview(p.get("month"), p.get("account")),
      );
    }
    if (req.method === "GET" && req.url.startsWith("/api/pro/transaction?"))
      return reply(
        res,
        200,
        proWorkspace.transaction(
          new URL(req.url, "http://localhost").searchParams.get("id"),
        ),
      );
    if (req.method === "GET" && req.url.startsWith("/api/monthly?")) {
      const params = new URL(req.url, "http://localhost").searchParams,
        result = features.monthly(params.get("month"), params.get("account")),
        targets = globalBudget.monthState(params.get("month"), true).rows;
      result.budgets = result.budgets
        .filter(
          (b) => targets.find((r) => r.id === b.id)?.direction !== "income",
        )
        .map((b) => ({
          ...b,
          limit_cents: targets.find((r) => r.id === b.id)
            ? targets.find((r) => r.id === b.id).budget_cents
            : b.limit_cents,
        }));
      return reply(res, 200, result);
    }
    if (req.method === "GET" && req.url === "/api/backup/export") {
      const backup = features.exportBackup();
      res.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="mon-budget-${todayLocal()}.json"`,
        "Cache-Control": "no-store",
      });
      return res.end(JSON.stringify(backup, null, 2));
    }
    if (
      req.method === "GET" &&
      req.url.startsWith("/api/transactions/export")
    ) {
      const rows = listTransactions(req.url, true).rows;
      const text = (v) =>
        '"' +
        String(v ?? "")
          .replace(/^[=+\-@\t\r]/, "'$&")
          .replaceAll('"', '""') +
        '"';
      const lines = [
        [
          "Date",
          "Description",
          "Compte",
          "Catégorie",
          "Sous-catégorie",
          "Enveloppe",
          "Montant",
        ]
          .map(text)
          .join(";"),
        ...rows.map(
          (r) =>
            [
              r.happened_on,
              r.description,
              r.account_name,
              r.category_name || "",
              r.subcategory_name || "",
              r.envelope_name || "",
            ]
              .map(text)
              .join(";") +
            ";" +
            (r.amount_cents / 100).toFixed(2),
        ),
      ];
      res.writeHead(200, {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="transactions.csv"',
        "Cache-Control": "no-store",
      });
      return res.end("\uFEFF" + lines.join("\r\n"));
    }
    if (req.method === "GET" && req.url === "/api/reconcile/options")
      return reply(res, 200, {
        actuals: [
          ...q(
            "SELECT id,description,amount_cents,happened_on,account_id,envelope_id,'transaction' actual_type FROM transactions ORDER BY happened_on DESC,id DESC LIMIT 200",
          ),
          ...q(
            "SELECT id,description,amount_cents,happened_on,from_account_id,to_account_id,'transfer' actual_type FROM account_transfers ORDER BY happened_on DESC,id DESC LIMIT 100",
          ),
        ],
        links: q(
          "SELECT * FROM reconciliation_links ORDER BY occurrence_on DESC,id DESC",
        ),
      });
    if (req.method === "GET" && req.url.startsWith("/api/transactions/list"))
      return reply(res, 200, listTransactions(req.url));
    if (req.method === "GET" && req.url.startsWith("/api/budget/occurrences?"))
      return reply(
        res,
        200,
        monthlyBudget.occurrences(
          new URL(req.url, "http://localhost").searchParams.get("month"),
        ),
      );
    if (req.method === "GET" && req.url.startsWith("/api/budget/month?"))
      return reply(
        res,
        200,
        monthlyBudget.monthState(
          new URL(req.url, "http://localhost").searchParams.get("month"),
        ),
      );
    if (req.method === "GET" && req.url === "/api/state")
      return reply(res, 200, snapshot());
  };
}
