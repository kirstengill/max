import express from 'express';
import { createServer as createViteServer } from 'vite';

const app = express();
const port = Number(process.env.PORT || 3000);

async function start() {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });

  app.use(vite.middlewares);

  app.listen(port, () => {
    console.log(`Vite server listening on http://localhost:${port}`);
  });
}

start().catch((error) => {
  console.error('Failed to start Vite server:', error);
  process.exitCode = 1;
});
