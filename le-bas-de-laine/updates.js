import fs from "node:fs";
import path from "node:path";
export const UPDATE_SOURCE =
  "https://raw.githubusercontent.com/alexforget82/Budget/main/le-bas-de-laine/latest.json";
const semver = /^(0|[1-9]\d{0,3})\.(0|[1-9]\d{0,3})\.(0|[1-9]\d{0,3})$/;
export function releaseURL(version) {
  if (!semver.test(version)) throw Error("Version invalide.");
  return `https://github.com/alexforget82/Budget/raw/refs/tags/le-bas-de-laine-v${version}/le-bas-de-laine/releases/Le-bas-de-laine-${version}.zip`;
}
export function newerVersion(a, b) {
  if (!semver.test(a) || !semver.test(b)) throw Error("Version invalide.");
  const x = a.split(".").map(Number),
    y = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i];
  return false;
}
export function validateRelease(value) {
  if (
    !value ||
    !semver.test(value.version) ||
    value.url !== releaseURL(value.version) ||
    !/^[a-f0-9]{64}$/.test(value.sha256) ||
    typeof value.notes !== "string" ||
    value.notes.length > 500
  )
    throw Error("Informations de version invalides.");
  return {
    version: value.version,
    url: value.url,
    sha256: value.sha256,
    notes: value.notes,
  };
}
export function createUpdateChecker({
  dir,
  version,
  request = fetch,
  clock = () => new Date(),
}) {
  releaseURL(version);
  const file = path.join(dir, "updates.json");
  let data = {
      automatic: true,
      last_checked_at: null,
      last_success_at: null,
      latest: null,
      error: null,
    },
    busy = null;
  try {
    if (fs.existsSync(file)) {
      const cached = JSON.parse(fs.readFileSync(file, "utf8"));
      if (typeof cached.automatic === "boolean") {
        data = { ...data, ...cached };
        if (data.latest) data.latest = validateRelease(data.latest);
      }
    }
  } catch {
    data = {
      automatic: true,
      last_checked_at: null,
      last_success_at: null,
      latest: null,
      error: "Le cache de mise à jour sera vérifié de nouveau.",
    };
  }
  const save = () => {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    const temp = file + ".next";
    fs.writeFileSync(temp, JSON.stringify(data, null, 2), { mode: 0o600 });
    fs.renameSync(temp, file);
  };
  const status = () => ({
    current_version: version,
    automatic: data.automatic,
    last_checked_at: data.last_checked_at,
    last_success_at: data.last_success_at,
    error: data.error,
    latest: data.latest,
    available: !!data.latest && newerVersion(data.latest.version, version),
  });
  function preferences(input) {
    if (typeof input.automatic !== "boolean")
      throw Error("Préférence de mise à jour invalide.");
    data.automatic = input.automatic;
    save();
    return status();
  }
  async function check({ force = false } = {}) {
    if (busy) return busy;
    const now = clock();
    if (
      !force &&
      (!data.automatic ||
        (data.last_checked_at &&
          now.getTime() - Date.parse(data.last_checked_at) < 86400000))
    )
      return status();
    busy = (async () => {
      data.last_checked_at = now.toISOString();
      try {
        const response = await request(UPDATE_SOURCE, {
          redirect: "error",
          signal: AbortSignal.timeout(8000),
          headers: { Accept: "application/json" },
        });
        if (!response.ok) throw Error("HTTP");
        let text = "";
        const reader = response.body?.getReader();
        if (reader) {
          try {
            let total = 0;
            const decoder = new TextDecoder();
            while (true) {
              const part = await reader.read();
              if (part.done) break;
              total += part.value.byteLength;
              if (total > 16384) throw Error("size");
              text += decoder.decode(part.value, { stream: true });
            }
            text += decoder.decode();
          } finally {
            await reader.cancel().catch(() => {});
          }
        } else {
          text = await response.text();
          if (Buffer.byteLength(text) > 16384) throw Error("size");
        }
        data.latest = validateRelease(JSON.parse(text));
        data.last_success_at = now.toISOString();
        data.error = null;
      } catch {
        data.error =
          "Vérification indisponible. Le budget reste utilisable; réessayez plus tard.";
      }
      try {
        save();
      } catch {
        data.error =
          "Le résultat ne peut pas être mémorisé. Le budget reste utilisable.";
      }
      return status();
    })().finally(() => {
      busy = null;
    });
    return busy;
  }
  return { status, preferences, check };
}
