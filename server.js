import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
const root = resolve(new URL('.', import.meta.url).pathname);
const types = {'.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.svg':'image/svg+xml', '.json':'application/json'};
const port = Number(process.env.PORT || 5173);
http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root + '/') || /(?:^|\/)\./.test(pathname)) { res.writeHead(403); res.end(); return; }
    if (!['.html','.js','.css','.svg','.json'].includes(extname(file)) || file.endsWith('package.json')) { res.writeHead(404); res.end(); return; }
    const body = await readFile(file);
    res.writeHead(200, {'Content-Type':types[extname(file)], 'Cache-Control':'no-cache'}); res.end(body);
  } catch { res.writeHead(404); res.end('Not found'); }
}).listen(port, '0.0.0.0', () => console.log(`Touchline Twelve running on port ${port}`));
