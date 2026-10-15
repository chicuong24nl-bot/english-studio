import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
const root = process.cwd();
const types = { '.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.pdf':'application/pdf' };
createServer(async (req,res) => {
  const pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const appRoute = pathname === '/phase' || pathname.startsWith('/phase/');
  const file = normalize(join(root, pathname === '/' || appRoute ? 'index.html' : pathname));
  if (!file.startsWith(root)) { res.writeHead(403).end('Forbidden'); return; }
  try { const body = await readFile(file); res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream'});res.end(body); }
  catch { res.writeHead(404).end('Not found'); }
}).listen(Number(process.env.PORT)||4173, () => console.log(`English Studio: http://localhost:${Number(process.env.PORT)||4173}`));
