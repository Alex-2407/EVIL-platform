/**
 * BASE_URL per link email (verifica account) — Render + dominio custom
 */
function resolvePublicBaseUrl() {
  for (const raw of [process.env.BASE_URL, process.env.RENDER_EXTERNAL_URL]) {
    if (!raw || !String(raw).trim()) continue;
    let url = String(raw).trim().replace(/\/$/, '');
    if (!/^https?:\/\//i.test(url)) {
      url = `https://${url.replace(/^\/+/, '')}`;
    }
    return url;
  }
  return null;
}

function bootstrapBaseUrlEnv() {
  if (process.env.BASE_URL && String(process.env.BASE_URL).trim()) {
    process.env.BASE_URL = String(process.env.BASE_URL).trim().replace(/\/$/, '');
    return process.env.BASE_URL;
  }
  const resolved = resolvePublicBaseUrl();
  if (resolved) {
    process.env.BASE_URL = resolved;
  }
  return process.env.BASE_URL || null;
}

module.exports = { resolvePublicBaseUrl, bootstrapBaseUrlEnv };
