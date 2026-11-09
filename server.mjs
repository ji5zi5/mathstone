import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {createRoomApi} from './src/rooms-server.js';
const root = fileURLToPath(new URL('.', import.meta.url));
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.jpg':'image/jpeg', '.ttf':'font/ttf', '.woff':'font/woff', '.woff2':'font/woff2', '.json': 'application/json' };
const port = Number(process.env.PORT || 4173);
const host=process.env.HOST||'127.0.0.1',roomApi=createRoomApi();
http.createServer(async (req, res) => {
  try {
    const url=new URL(req.url,'http://localhost');if(await roomApi(req,res,url))return;
    const pathname = decodeURIComponent(url.pathname);
    const file = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    const allowed = file === resolve(root, 'index.html') || ['src', 'public'].some(dir => file.startsWith(resolve(root, dir) + sep));
    if (!allowed) { res.writeHead(403).end('Forbidden'); return; }
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' }).end(body);
  } catch { res.writeHead(404).end('Not found'); }
}).listen(port, host, () => console.log(`Mathstone: http://${host}:${port}`));
