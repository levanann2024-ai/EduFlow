const LAN_FRONTEND_ORIGIN = 'http://192.168.2.2:5173';

function getAllowedOrigins() {
  const configuredOrigins = (process.env.AUTH_ALLOWED_ORIGINS || 'http://localhost:5173')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  return [...new Set([...configuredOrigins, LAN_FRONTEND_ORIGIN])];
}

module.exports = { getAllowedOrigins };
