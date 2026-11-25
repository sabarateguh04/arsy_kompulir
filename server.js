require('dotenv').config();

const path = require('path');
const express = require('express');
const api = require('./src/routes/kompulir');

const app = express();
const port = Number(process.env.PORT || 4010);

app.disable('x-powered-by');

app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

app.use('/api', api);

app.get('/vendor/chart.umd.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'node_modules', 'chart.js', 'dist', 'chart.umd.js'));
});

app.get('/vendor/html2canvas.min.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'node_modules', 'html2canvas', 'dist', 'html2canvas.min.js'));
});

app.use(express.static(path.join(__dirname, 'public')));

app.use((err, req, res, next) => {
  console.error('[server]', err.message);
  res.status(500).json({
    error: 'Terjadi kesalahan pada server',
    detail: err.message,
  });
});

const server = app.listen(port, () => {
  console.log(`Dashboard kompulir: http://localhost:${port}`);
});

server.requestTimeout = 180000;
server.headersTimeout = 185000;
server.setTimeout(180000);
