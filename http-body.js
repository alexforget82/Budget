// Shared byte limits for owner routes and the restricted consultation view.
export const isJsonRequest = (req) =>
  String(req.headers["content-type"] || "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase() === "application/json";
export async function readJson(req, limit) {
  const chunks = [];
  let size = 0;
  const stream =
    typeof req.iterator === "function"
      ? req.iterator({ destroyOnReturn: false })
      : req;
  for await (const chunk of stream) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += bytes.length;
    if (size > limit) {
      req.resume?.();
      const error = Error("Requête trop grande");
      error.httpStatus = 413;
      throw error;
    }
    chunks.push(bytes);
  }
  let result;
  try {
    result = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    const error = Error("Requête JSON invalide.");
    error.httpStatus = 400;
    throw error;
  }
  if (!result || Array.isArray(result) || typeof result !== "object") {
    const error = Error("Un objet JSON est requis.");
    error.httpStatus = 400;
    throw error;
  }
  return result;
}
