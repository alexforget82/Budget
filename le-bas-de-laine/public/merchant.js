// Only explicitly labelled location numbers are removed. Meaningful bare numbers survive.
export function normalizeMerchant(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase()
    .replace(
      /\b(?:TERMINAL|SUCCURSALE|SUCC|BRANCH|STORE)\.?\s*(?:NO\.?\s*)?[#:]?\s*\d+\b/g,
      " ",
    )
    .replace(/#\s*\d+\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
