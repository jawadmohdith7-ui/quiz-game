const STATS_BASE_URL =
  import.meta.env.VITE_STATS_BASE_URL ||
  (import.meta.env.DEV ? "http://localhost:3012" : "/stats-api");

async function request(path, token = "") {
  const response = await fetch(`${STATS_BASE_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.error || "No s'han pogut carregar les estadístiques.");
  }

  return payload;
}

export function getRanking(limit = 10) {
  return request(`/stats/ranking?limit=${limit}`);
}

export function getMyStats(token) {
  return request("/stats/me", token);
}
