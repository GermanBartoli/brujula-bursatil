// Se ejecuta únicamente desde un entorno autenticado; no registra valores secretos.
const names = [
  "CLOUDFLARE_API_TOKEN",
  "CLOUDFLARE_ACCOUNT_ID",
  "MARKETAUX_API_KEY",
  "MARKETAUX_API_KEY_BACKUP",
];
for (const name of names)
  if (!process.env[name]) throw new Error(`Falta configurar ${name}.`);
const endpoint = `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/pages/projects/brujula-bursatil`;
const env_vars = Object.fromEntries(
  names
    .filter((n) => n.startsWith("MARKETAUX"))
    .map((n) => [n, { type: "secret_text", value: process.env[n] }]),
);
const response = await fetch(endpoint, {
  method: "PATCH",
  headers: {
    Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ deployment_configs: { production: { env_vars } } }),
});
const result = await response.json();
if (!response.ok || !result.success)
  throw new Error(
    `No se pudieron sincronizar los secretos de Pages (HTTP ${response.status}).`,
  );
console.log("Secretos de Marketaux sincronizados con Pages.");
