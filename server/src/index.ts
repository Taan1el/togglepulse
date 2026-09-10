import { createApp } from './app.js';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;

const { app } = createApp();

app.listen(PORT, () => {
  console.log(`[TogglePulse Server] REST API listening on http://localhost:${PORT}`);
  console.log(`[TogglePulse Server] Feature Flag evaluation endpoint ready at /api/flags/:key/evaluate`);
});
