/** Detects Telugu script or romanized Telugu (Tanglish) so it can be routed to Gemini. */
const TANGLISH = new Set([
  "ela", "unnav", "unnavu", "unnaru", "cheppu", "cheppandi", "enti", "emiti", "nuvvu", "nenu",
  "naku", "neeku", "nee", "naa", "kavali", "ledu", "undi", "chey", "cheyi", "cheyyi", "cheyali",
  "chesi", "choodu", "chudu", "anni", "evaru", "ekkada", "eppudu", "enduku", "ela", "baga",
  "bagundi", "sare", "avunu", "kaadu", "kadu", "vachindi", "ra", "andi", "mari", "inka",
  "konchem", "chala", "emi", "telusu", "teliyadu", "ivvu", "pettu", "chestha", "chesa",
  "ostha", "velli", "vellu", "rendu", "okati", "sangathulu",
]);

export function isTeluguOrTanglish(text: string): boolean {
  if (/[\u0C00-\u0C7F]/.test(text)) return true;
  const words = text.toLowerCase().match(/[a-z]+/g) ?? [];
  let hits = 0;
  for (const w of words) if (TANGLISH.has(w)) hits++;
  return hits >= 2 || (words.length <= 3 && hits >= 1);
}
