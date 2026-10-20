import { authorizePrivateRequest } from "./private-access.js";
import { isJsonRequest } from "./http-body.js";
export function securityHeaders(res) {
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader(
    "Content-Security-Policy",
    "frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
  );
}
export function authorizeRequest(req, { privateAccess, localPort, viewing }) {
  if (privateAccess && req.socket.localPort === privateAccess.port) {
    if (viewing) {
      return [
        privateAccess.host,
        "127.0.0.1:" + privateAccess.port,
        "localhost:" + privateAccess.port,
      ].includes(req.headers.host)
        ? null
        : "Hôte privé non autorisé.";
    }
    return authorizePrivateRequest(req, privateAccess);
  }
  if (
    !["127.0.0.1:" + localPort, "localhost:" + localPort].includes(
      req.headers.host,
    )
  )
    return "Hôte non autorisé.";
  if (
    req.method === "POST" &&
    ((req.headers.origin &&
      req.headers.origin !== "http://" + req.headers.host) ||
      !isJsonRequest(req))
  )
    return "Requête locale JSON requise.";
  return null;
}
