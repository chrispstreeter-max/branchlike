// Minimal static server for dist/: `npm run serve` then open http://localhost:5173
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png' };

export function serve(port = Number(process.env.PORT) || 5173) {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://x');
    let path = normalize(decodeURIComponent(url.pathname)).replace(/^([.][.][/\\])+/, '');
    if (path.endsWith('/')) path += 'index.html';
    try {
      const body = await readFile(join(root, path));
      res.writeHead(200, { 'content-type': types[extname(path)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(body);
    } catch { res.writeHead(404); res.end('Not found'); }
  });
  return new Promise(resolve => server.listen(port, () => resolve(server)));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  serve().then(() => console.log('BRANCHLIKE on http://localhost:' + (Number(process.env.PORT) || 5173)));
}
