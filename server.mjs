import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const PORT = Number(process.env.PORT || 5588);
const AUTH_URL = process.env.SHRE_AUTH_URL || 'http://127.0.0.1:5455';
const app = new Hono();

app.get('/health', (c) => c.json({ service: 'aros-developer-portal', status: 'ok' }));
app.get('/', (c) => c.html(readFileSync(join(process.cwd(), 'aros-developer-portal', 'public', 'index.html'), 'utf-8')));

app.post('/api/*', async (c) => {
  const path = c.req.path.replace(/^\/api/, '');
  const res = await fetch(`${AUTH_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: c.req.header('Authorization') || '' },
    body: await c.req.text(),
  });
  return new Response(res.body, { status: res.status, headers: { 'Content-Type': res.headers.get('content-type') || 'application/json' } });
});

app.get('/api/*', async (c) => {
  const path = c.req.path.replace(/^\/api/, '');
  const qs = new URL(c.req.url).search;
  const res = await fetch(`${AUTH_URL}${path}${qs}`, {
    headers: { Authorization: c.req.header('Authorization') || '' },
  });
  return new Response(res.body, { status: res.status, headers: { 'Content-Type': res.headers.get('content-type') || 'application/json' } });
});

serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`[aros-developer-portal] listening on :${PORT}`);
});
