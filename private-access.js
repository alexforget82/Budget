import { isJsonRequest } from "./http-body.js";
import fs from "node:fs";
import path from "node:path";

// Tailscale Serve is the authentication proxy. Its backend has a dedicated,
// loopback-only listener: absence of identity can never fall back to local access.
export function loadPrivateAccess(dir, localPort) {
  const file = path.join(dir, "private-access.json");
  if (!fs.existsSync(file)) return null;
  const config = JSON.parse(fs.readFileSync(file, "utf8")),
    url = new URL(config.origin);
  if (
    url.protocol !== "https:" ||
    !url.hostname.endsWith(".ts.net") ||
    url.port ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    typeof config.login !== "string" ||
    !config.login ||
    config.login.length > 254 ||
    /[\r\n\0]/.test(config.login) ||
    !Number.isInteger(config.port) ||
    config.port < 1024 ||
    config.port > 65535 ||
    config.port === localPort
  )
    throw Error("Configuration d’accès privé invalide.");
  return {
    origin: url.origin,
    login: config.login.toLowerCase(),
    port: config.port,
    host: url.host,
  };
}
export function authorizePrivateRequest(req, config) {
  const hosts = [
    config.host,
    "127.0.0.1:" + config.port,
    "localhost:" + config.port,
  ];
  if (!hosts.includes(req.headers.host)) return "Hôte privé non autorisé.";
  let login = req.headers["tailscale-user-login"];
  if (typeof login !== "string")
    return "Connexion Tailscale personnelle requise.";
  try {
    login = decodeURIComponent(login);
  } catch {
    return "Identité Tailscale invalide.";
  }
  if (login.toLowerCase() !== config.login)
    return "Cet accès est réservé au propriétaire du budget.";
  if (
    req.method === "POST" &&
    (req.headers.origin !== config.origin || !isJsonRequest(req))
  )
    return "Origine HTTPS privée et requête JSON requises.";
  return null;
}
