import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { simulate } from "./engine.js";
import {
  generatePushKeys,
  validatePushKeys,
  validateSubscription,
  sendWebPush,
} from "./web-push.js";
export function torontoTime(now) {
  const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Toronto",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now),
    p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  return {
    date: p.year + "-" + p.month + "-" + p.day,
    hour: Number(p.hour),
    minute: Number(p.minute),
  };
}
const money = (n) =>
  new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(
    n / 100,
  );
export function morningSummary(state, date, details = false) {
  if (!details)
    return {
      title: "Le bas de laine",
      body: "Votre résumé du matin est prêt. Ouvrez Le bas de laine pour consulter votre budget.",
      tag: "bdl-morning-" + date,
    };
  const sim = simulate(state, date),
    events = sim.daily[0].events.filter((e) => !e.overdue),
    income = events
      .filter((e) => e.kind === "income")
      .reduce((n, e) => n + e.amount_cents, 0),
    bank = state.accounts.find((a) => a.is_main),
    payments = events
      .filter(
        (e) =>
          e.kind === "expense" ||
          (e.kind === "transfer" && e.account_id === bank?.id),
      )
      .reduce((n, e) => n + e.amount_cents, 0),
    renewals = sim.categories
      .filter((c) => c.periods.some((p) => p.date === date))
      .map((c) => c.name),
    near = sim.categories
      .filter(
        (c) =>
          c.current?.date <= date &&
          c.current.end >= date &&
          c.current.budget_cents !== 0 &&
          c.limit_cents > 0 &&
          Math.max(0, c.current.spent_cents) >=
            (c.current.budget_cents ?? c.limit_cents) * 0.8,
      )
      .map(
        (c) =>
          c.name +
          " " +
          Math.round(
            (Math.max(0, c.current.spent_cents) /
              (c.current.budget_cents ?? c.limit_cents)) *
              100,
          ) +
          " %",
      ),
    overdue = sim.daily[0].events.filter((e) => e.overdue).length;
  const parts = [
    income ? "Revenus prévus : " + money(income) + "." : "Aucun revenu prévu.",
    payments
      ? "Paiements prévus : " + money(payments) + "."
      : "Aucun paiement prévu.",
  ];
  if (renewals.length)
    parts.push(
      "Renouvellement automatique : " +
        renewals.slice(0, 3).join(", ") +
        (renewals.length > 3 ? "…" : "") +
        ".",
    );
  if (near.length)
    parts.push(
      "Limites à surveiller : " +
        near.slice(0, 3).join(", ") +
        (near.length > 3 ? "…" : "") +
        ".",
    );
  if (overdue) parts.push(overdue + " échéance(s) en retard.");
  return {
    title: "Le bas de laine",
    body: [...parts.join(" ")].slice(0, 500).join(""),
    tag: "bdl-morning-" + date,
  };
}
export function createNotifications({
  dir,
  state,
  configured,
  origin,
  owner = "owner",
  send = sendWebPush,
  clock = () => new Date(),
}) {
  const file = path.join(dir, "web-push.json");
  let config = { version: 1, keys: null, devices: [] },
    error = null,
    busy = false;
  const currentOwner = () =>
    String(typeof owner === "function" ? owner() : owner)
      .trim()
      .toLowerCase();
  const currentOrigin = () => {
    const value = typeof origin === "function" ? origin() : origin;
    return typeof value === "string" &&
      /^https:\/\/[a-z0-9.-]+\.ts\.net(?::8443)?$/.test(value)
      ? value
      : null;
  };
  try {
    if (fs.existsSync(file)) {
      if (fs.statSync(file).size > 128 * 1024) throw Error("size");
      const saved = JSON.parse(fs.readFileSync(file, "utf8"));
      if (
        saved.version !== 1 ||
        !Array.isArray(saved.devices) ||
        saved.devices.length > 10
      )
        throw Error("format");
      if (saved.keys) validatePushKeys(saved.keys);
      else if (saved.devices.length) throw Error("keys");
      for (const d of saved.devices) {
        validateSubscription(d.subscription);
        if (
          !/^[a-f0-9]{32}$/.test(d.id) ||
          typeof d.enabled !== "boolean" ||
          typeof d.details !== "boolean" ||
          typeof d.origin !== "string" ||
          typeof d.owner !== "string" ||
          !d.owner
        )
          throw Error("device");
      }
      config = saved;
    }
  } catch {
    error =
      "Configuration des notifications illisible. Le budget reste utilisable.";
  }
  const save = () => {
    if (error) throw Error(error);
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    const temp = file + ".next";
    fs.writeFileSync(temp, JSON.stringify(config, null, 2), { mode: 0o600 });
    fs.chmodSync(temp, 0o600);
    fs.renameSync(temp, file);
  };
  const find = (endpoint) =>
    config.devices.find(
      (d) =>
        d.subscription.endpoint === endpoint &&
        d.origin === currentOrigin() &&
        d.owner === currentOwner(),
    );
  const status = (endpoint = null) => {
    const d = endpoint ? find(endpoint) : null;
    return {
      hour: 7,
      time_zone: "America/Toronto",
      threshold_percent: 80,
      can_activate: !!currentOrigin() && !!currentOwner() && !error,
      devices_count: config.devices.filter(
        (d) =>
          d.enabled &&
          d.origin === currentOrigin() &&
          d.owner === currentOwner(),
      ).length,
      error,
      device: d
        ? {
            enabled: d.enabled,
            details: d.details,
            last_sent_at: d.last_sent_at || null,
            last_status: d.last_status || null,
            last_error: d.last_error || null,
          }
        : null,
    };
  };
  function prepare() {
    if (error) throw Error(error);
    if (!currentOrigin() || !currentOwner())
      throw Error("Configurez l’accès privé iPhone avant les notifications.");
    if (!config.keys) {
      config.keys = generatePushKeys();
      save();
    }
    return { public_key: config.keys.public_key };
  }
  function subscribe(input) {
    prepare();
    const subscription = validateSubscription(input.subscription),
      old = find(subscription.endpoint);
    config.devices = config.devices.filter(
      (d) =>
        d === old ||
        (d.enabled &&
          d.origin === currentOrigin() &&
          d.owner === currentOwner() &&
          d.last_status !== "expired"),
    );
    if (!old && config.devices.length >= 10)
      throw Error("Dix appareils maximum. Suspendez les anciens rappels.");
    const device = old || {
      id: randomBytes(16).toString("hex"),
      last_day: null,
    };
    Object.assign(device, {
      subscription,
      origin: currentOrigin(),
      owner: currentOwner(),
      enabled: true,
      details: input.details === true,
    });
    if (!old) config.devices.push(device);
    save();
    return status(subscription.endpoint);
  }
  function preferences(input) {
    const d = find(input.endpoint);
    if (!d) throw Error("Activez les notifications sur cet appareil.");
    d.details = input.details === true;
    save();
    return status(input.endpoint);
  }
  function unsubscribe(input) {
    config.devices = config.devices.filter(
      (d) => d.subscription.endpoint !== input.endpoint,
    );
    save();
    return status();
  }
  function disableAll() {
    if (error) return;
    for (const d of config.devices) d.enabled = false;
    if (fs.existsSync(file)) save();
  }
  async function deliver(d, payload, now) {
    try {
      const code = await send(
        d.subscription,
        payload,
        config.keys,
        currentOrigin(),
        { now },
      );
      if (code >= 200 && code < 300) return { ok: true };
      return {
        ok: false,
        expired: code === 404 || code === 410,
        message:
          "Envoi refusé par le service de notifications (HTTP " + code + ").",
      };
    } catch {
      return {
        ok: false,
        message:
          "Envoi impossible : vérifiez la connexion Internet du Chromebook.",
      };
    }
  }
  async function test(input) {
    const d = find(input.endpoint);
    if (!d?.enabled) throw Error("Activez les notifications sur cet appareil.");
    const result = await deliver(
      d,
      {
        title: "Le bas de laine",
        body: "Les notifications du Bas de laine fonctionnent sur cet appareil.",
        tag: "bdl-test",
      },
      clock(),
    );
    if (!result.ok) {
      if (result.expired) {
        d.enabled = false;
        d.last_status = "expired";
      }
      d.last_error = result.message;
      save();
      throw Error(result.message);
    }
    d.last_error = null;
    save();
    return status(input.endpoint);
  }
  async function tick(now = clock()) {
    const local = torontoTime(now);
    if (error || busy || local.hour !== 7 || !currentOrigin() || !configured())
      return;
    busy = true;
    const started = performance.now();
    try {
      for (const d of config.devices.filter(
        (d) =>
          d.enabled &&
          d.origin === currentOrigin() &&
          d.owner === currentOwner(),
      )) {
        if (
          torontoTime(new Date(now.getTime() + performance.now() - started))
            .hour !== 7
        )
          break;
        if (
          !d.enabled ||
          !config.devices.includes(d) ||
          d.last_day === local.date
        )
          continue;
        if (
          d.attempt_day === local.date &&
          (d.attempts >= 3 ||
            (d.retry_after && Date.parse(d.retry_after) > now.getTime()))
        )
          continue;
        if (d.attempt_day !== local.date) {
          d.attempt_day = local.date;
          d.attempts = 0;
        }
        // Reserve durably before awaiting the provider. Restarting an in-flight send never duplicates it.
        d.last_day = local.date;
        d.attempts++;
        d.last_status = "sending";
        save();
        let result;
        try {
          result = await deliver(
            d,
            morningSummary(state(), local.date, d.details),
            now,
          );
        } catch {
          result = {
            ok: false,
            message: "Résumé indisponible. Vérifiez les données du budget.",
          };
        }
        if (result.ok) {
          d.last_status = "sent";
          d.last_sent_at = now.toISOString();
          d.last_error = null;
          d.retry_after = null;
        } else {
          d.last_error = result.message;
          d.last_status = result.expired ? "expired" : "error";
          if (result.expired) d.enabled = false;
          else if (d.attempts < 3) {
            d.last_day = null;
            d.retry_after = new Date(now.getTime() + 5 * 60000).toISOString();
          }
        }
        save();
      }
    } finally {
      busy = false;
    }
  }
  return {
    status,
    prepare,
    subscribe,
    preferences,
    unsubscribe,
    disableAll,
    test,
    tick,
  };
}
