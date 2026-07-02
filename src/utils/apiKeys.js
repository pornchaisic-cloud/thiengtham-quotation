export const OPENROUTER_BUILTIN_KEY = "";

export function getUserApiKeys() {
  try { return JSON.parse(localStorage.getItem("tt_api_keys") || "[]").filter(k => k && k.trim()); } catch { return []; }
}

export function getAllApiKeys() {
  return getUserApiKeys();
}

export function getAnthropicApiKeys() {
  try { return JSON.parse(localStorage.getItem("tt_anthropic_keys") || "[]"); } catch { return []; }
}

export function getOpenRouterKeys() {
  try { return JSON.parse(localStorage.getItem("tt_openrouter_keys") || "[]").filter(k => k); } catch { return []; }
}
