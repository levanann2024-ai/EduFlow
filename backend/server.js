require('dotenv').config();

const express = require('express');
const cookieParser = require('cookie-parser');
const aiRoutes = require('./routes/ai.routes');
const schoolRoutes = require('./routes/school.routes');
const { router: authRoutes } = require('./auth/routes');
const { requireAccountReady, requireAuth } = require('./auth/middleware');

const app = express();
const port = Number(process.env.PORT) || 3001;
const trustedProxyHops = process.env.TRUST_PROXY_HOPS === undefined
  ? (process.env.NODE_ENV === 'production' ? 1 : 0)
  : Number(process.env.TRUST_PROXY_HOPS);

if (!Number.isInteger(trustedProxyHops) || trustedProxyHops < 0) {
  throw new Error('TRUST_PROXY_HOPS must be a non-negative integer.');
}
app.set('trust proxy', trustedProxyHops);

if (process.env.NODE_ENV === 'production' && process.env.EDUFLOW_DEMO_MODE === 'true') {
  throw new Error('EDUFLOW_DEMO_MODE cannot be enabled in production.');
}

app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use((error, _req, res, next) => {
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    return res.status(400).json({
      success: false,
      message: 'Request body phải là JSON hợp lệ.',
    });
  }
  return next(error);
});
app.use((req, res, next) => {
  const allowedOrigins = (process.env.AUTH_ALLOWED_ORIGINS || 'http://localhost:5173')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const origin = req.get('origin');
  if (origin && allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Vary', 'Origin');
    res.header('Access-Control-Allow-Credentials', 'true');
  }
  res.header('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use('/api/auth', authRoutes);
app.use('/api', schoolRoutes);
app.use('/api/ai', requireAuth, requireAccountReady, aiRoutes);

app.get('/health', (_req, res) => {
  res.json({ success: true, status: 'ok' });
});

app.use((error, _req, res, _next) => {
  console.error('Unhandled server error:', error);
  const status = Number.isInteger(error.status) ? error.status : (
    error.code === 'AUTH_DATABASE_NOT_CONFIGURED' || error.code === 'AUTH_JWT_SECRET_NOT_CONFIGURED'
      ? 503
      : 500
  );
  res.status(status).json({
    success: false,
    message: status < 500 ? error.message : status === 503 ? error.message : 'Internal server error.',
  });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`EduFlow backend listening on port ${port}`);
});
