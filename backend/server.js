require('dotenv').config();

const express = require('express');
const aiRoutes = require('./routes/ai.routes');

const app = express();
const port = Number(process.env.PORT) || 3001;

app.use(express.json({ limit: '1mb' }));
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

app.listen(port, () => {
  console.log(`EduFlow AI backend listening on port ${port}`);
});
