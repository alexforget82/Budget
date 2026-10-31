import { cents } from "./service.js";
import { validDate } from "./dates.js";
import { hash } from "./import.js";
export function parseCSV(text) {
  if (typeof text !== "string" || Buffer.byteLength(text) > 4e6)
    throw Error("CSV limité à 4 Mo.");
  text = text.replace(/^\uFEFF/, "");
  const first = text.split(/\r?\n/)[0],
    separator = [";", ",", "\t"].sort(
      (a, b) => first.split(b).length - first.split(a).length,
    )[0];
  const rows = [];
  let row = [],
    cell = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (!quoted && (c === separator || c === "\r" || c === "\n")) {
      row.push(cell);
      cell = "";
      if (c !== separator) {
        if (c === "\r" && text[i + 1] === "\n") i++;
        if (row.some((c) => c.trim())) rows.push(row);
        row = [];
      }
    } else cell += c;
    if (rows.length > 5001 || cell.length > 10000 || row.length > 100)
      throw Error("CSV limité à 5 000 lignes.");
  }
  if (quoted) throw Error("Guillemets CSV non fermés.");
  row.push(cell);
  if (row.some((c) => c.trim())) rows.push(row);
  if (rows.length < 2)
    throw Error("Le CSV doit contenir un en-tête et des opérations.");
  return { headers: rows[0], rows: rows.slice(1) };
}
export function previewCSV(text, options, state, service) {
  const parsed = parseCSV(text),
    normalize = (s) =>
      s
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLowerCase()
        .trim();
  const find = (names) =>
    parsed.headers.findIndex((h) => names.includes(normalize(h)));
  const mapping = options.mapping || {
    date: find(["date", "transaction date", "date de transaction"]),
    description: find(["description", "payee", "beneficiaire", "merchant"]),
    amount: find(["montant", "amount", "total"]),
  };
  if (
    Object.values(mapping).some(
      (n) => !Number.isInteger(n) || n < 0 || n >= parsed.headers.length,
    ) ||
    !["date", "description", "amount"].every((k) => Object.hasOwn(mapping, k))
  )
    return { headers: parsed.headers, mapping, needs_mapping: true, rows: [] };
  service.account(options.account_id);
  const rows = parsed.rows.map((r, index) => {
    try {
      let date = r[mapping.date]?.trim(),
        amount = r[mapping.amount]
          ?.trim()
          .replace(/\$/g, "")
          .replace(/\bCAD\b/gi, "")
          .replace(/\s/g, "");
      if (options.date_format === "DMY" && /^\d{2}\/\d{2}\/\d{4}$/.test(date))
        date = date.slice(6) + "-" + date.slice(3, 5) + "-" + date.slice(0, 2);
      if (!validDate(date) || date > service.clock())
        throw Error("Date à vérifier (format ISO ou JJ/MM/AAAA).");
      if (/^\(.*\)$/.test(amount)) amount = "-" + amount.slice(1, -1);
      if (amount.includes(",") && amount.includes("."))
        amount = amount.replace(/,/g, "");
      const n = cents(amount);
      if (!n) throw Error("Montant nul.");
      const description = service.name(r[mapping.description]),
        fingerprint = hash([Number(options.account_id), date, n, description]);
      const duplicate = state.transactions.some(
        (t) =>
          t.account_id === Number(options.account_id) &&
          t.date === date &&
          t.amount_cents === n &&
          t.description === description,
      );
      const matches = service.matches({
        account_id: options.account_id,
        date,
        amount: n / 100,
        description,
      });
      return {
        row: index,
        date,
        amount_cents: n,
        description,
        fingerprint,
        duplicate,
        matches,
      };
    } catch (e) {
      return { row: index, error: e.message };
    }
  });
  return {
    headers: parsed.headers,
    mapping,
    rows,
    token: hash([text, { ...options, mapping }, state]),
  };
}
