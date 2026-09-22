require('dotenv').config();

const express = require('express');
const aiRoutes = require('./routes/ai.routes');

const app = express();
const port = Number(process.env.PORT) || 3001;

app.use(express.json({ limit: '1mb' }));
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
  res.header('Access-Control-Allow-Origin', 'http://localhost:5173');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use('/api/ai', aiRoutes);

app.get('/health', (_req, res) => {
  res.json({ success: true, status: 'ok' });
});

app.use((error, _req, res, _next) => {
  console.error('Unhandled server error:', error);
  res.status(500).json({
    success: false,
    message: 'Internal server error.',
  });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`EduFlow AI backend listening on port ${port}`);
});
