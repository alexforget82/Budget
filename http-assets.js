export const staticFiles = new Map([
  ["/sillage-v13.js", "sillage-v13.js"],
  ["/styles-v13.css", "styles-v13.css"],
  ["/sillage-2026.js", "sillage-2026.js"],
  ["/sillage-2026.css", "sillage-2026.css"],
  ["/sillage-v10.js", "sillage-v10.js"],
  ["/sillage-icon.png", "sillage-icon.png"],
  ["/sillage.webmanifest", "sillage.webmanifest"],
  ["/sillage.js", "sillage.js"],
  ["/sillage.css", "sillage.css"],
  ["/sillage-logo.svg", "sillage-logo.svg"],
  ["/budget-v81.js", "budget-v81.js"],
  ["/budget-v81.css", "budget-v81.css"],
  ["/budget-v80.js", "budget-v80.js"],
  ["/budget-v80.css", "budget-v80.css"],
  ["/budget-v73.js", "budget-v73.js"],
  ["/", "index.html"],
  ["/app.css", "app.css"],
  ["/app.js", "app.js"],
  ["/features.js", "features.js"],
  ["/planner.js", "planner.js"],
  ["/transactions.js", "transactions.js"],
  ["/forecast-ui.js", "forecast-ui.js"],
  ["/planning-workflow.js", "planning-workflow.js"],
  ["/card-payments-ui.js", "card-payments-ui.js"],
  ["/planning-v4.js", "planning-v4.js"],
  ["/planning-v4.css", "planning-v4.css"],
  ["/budget-v41.js", "budget-v41.js"],
  ["/budget-v41.css", "budget-v41.css"],
  ["/free-budgets-ui.js", "free-budgets-ui.js"],
  ["/free-budgets.css", "free-budgets.css"],
  ["/envelope-v44.js", "envelope-v44.js"],
  ["/envelope-v44.css", "envelope-v44.css"],
  ["/categories-v46.js", "categories-v46.js"],
  ["/categories-v46.css", "categories-v46.css"],
  ["/dashboard-v47.js", "dashboard-v47.js"],
  ["/dashboard-v47.css", "dashboard-v47.css"],
]);
staticFiles.set("/budget-v71.js", "budget-v71.js");
staticFiles.set("/budget-v70.js", "budget-v70.js");
staticFiles.set("/budget-v70.css", "budget-v70.css");
staticFiles.set("/budget-v60.js", "budget-v60.js");
staticFiles.set("/budget-v60.css", "budget-v60.css");
staticFiles.set("/budget-v50.js", "budget-v50.js");
staticFiles.set("/budget-v50.css", "budget-v50.css");
export const mime = {
  "sillage-v13.js": "text/javascript; charset=utf-8",
  "styles-v13.css": "text/css; charset=utf-8",
  "sillage-2026.js": "text/javascript; charset=utf-8",
  "sillage-2026.css": "text/css; charset=utf-8",
  "sillage-v10.js": "text/javascript; charset=utf-8",
  "sillage-icon.png": "image/png",
  "sillage.webmanifest": "application/manifest+json; charset=utf-8",
  "sillage.js": "text/javascript; charset=utf-8",
  "sillage.css": "text/css; charset=utf-8",
  "sillage-logo.svg": "image/svg+xml",
  "budget-v81.js": "text/javascript; charset=utf-8",
  "budget-v81.css": "text/css; charset=utf-8",
  "budget-v80.js": "text/javascript; charset=utf-8",
  "budget-v80.css": "text/css; charset=utf-8",
  "budget-v73.js": "text/javascript; charset=utf-8",
  "budget-v71.js": "text/javascript; charset=utf-8",
  "budget-v70.js": "text/javascript; charset=utf-8",
  "budget-v70.css": "text/css; charset=utf-8",
  "budget-v60.js": "text/javascript; charset=utf-8",
  "budget-v60.css": "text/css; charset=utf-8",
  "budget-v50.js": "text/javascript; charset=utf-8",
  "budget-v50.css": "text/css; charset=utf-8",
  "index.html": "text/html; charset=utf-8",
  "app.css": "text/css; charset=utf-8",
  "app.js": "text/javascript; charset=utf-8",
  "features.js": "text/javascript; charset=utf-8",
  "planner.js": "text/javascript; charset=utf-8",
  "transactions.js": "text/javascript; charset=utf-8",
  "forecast-ui.js": "text/javascript; charset=utf-8",
  "planning-workflow.js": "text/javascript; charset=utf-8",
  "card-payments-ui.js": "text/javascript; charset=utf-8",
  "planning-v4.js": "text/javascript; charset=utf-8",
  "planning-v4.css": "text/css; charset=utf-8",
  "budget-v41.js": "text/javascript; charset=utf-8",
  "budget-v41.css": "text/css; charset=utf-8",
  "free-budgets-ui.js": "text/javascript; charset=utf-8",
  "free-budgets.css": "text/css; charset=utf-8",
  "envelope-v44.js": "text/javascript; charset=utf-8",
  "envelope-v44.css": "text/css; charset=utf-8",
  "categories-v46.js": "text/javascript; charset=utf-8",
  "categories-v46.css": "text/css; charset=utf-8",
  "dashboard-v47.js": "text/javascript; charset=utf-8",
  "dashboard-v47.css": "text/css; charset=utf-8",
};

// Only release-version query strings are accepted, against the fixed asset allowlist.
staticFiles.set("/ui-entry.js", "ui-entry.js");
staticFiles.set("/mobile-ui.js", "mobile-ui.js");
mime["mobile-ui.js"] = "text/javascript; charset=utf-8";
mime["ui-entry.js"] = "text/javascript; charset=utf-8";
export function assetName(url) {
  if (!/^\/(?:[A-Za-z0-9][A-Za-z0-9._-]*)?(?:\?v=\d+\.\d+\.\d+)?$/.test(url))
    return null;
  return staticFiles.get(url.split("?")[0]) || null;
}

for (const file of [
  "styles.css",
  "styles-foundation.css",
  "styles-domains.css",
  "styles-sillage.css",
  "styles-tokens.css",
  "styles-mobile.css",
]) {
  staticFiles.set("/" + file, file);
  mime[file] = "text/css; charset=utf-8";
}
