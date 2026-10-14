// AURA Shield: masks private user data before anything leaves for an AI provider.
const RULES: Array<[RegExp, string]> = [
  [/\b(?:sk|pk|rk|nvapi|hf|gsk|cfut|AIza)[-_A-Za-z0-9]{16,}\b/g, "[KEY]"],
  [/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}\b/g, "[TOKEN]"],
  [/((?:password|passwd|pwd|pin|otp|cvv|పాస్‌వర్డ్)\s*(?:is|=|:|-)?\s*)\S+/gi, "$1[HIDDEN]"],
  [/\b(?:\d[ -]?){13,19}\b/g, "[CARD]"],
  [/\b\d{4}\s?\d{4}\s?\d{4}\b/g, "[ID]"],
  [/(?:\+91[\s-]?)?\b[6-9]\d{9}\b/g, "[PHONE]"],
  [/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, "[EMAIL]"],
];

export function shield(text: string): string {
  let t = String(text ?? "");
  for (const [re, rep] of RULES) t = t.replace(re, rep);
  return t;
}

export const SHIELD_NOTE =
  "Privacy: values like [KEY] [TOKEN] [HIDDEN] [CARD] [ID] [PHONE] [EMAIL] were masked by AURA Shield. Never ask the user to reveal them.";
