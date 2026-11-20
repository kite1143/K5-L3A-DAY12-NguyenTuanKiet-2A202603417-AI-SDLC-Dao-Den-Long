#!/usr/bin/env node
/**
 * play.mjs — run_cmd for the game (contract v1.3).
 *
 *   node scripts/play.mjs                        # serve dist/web on :5173
 *   node scripts/play.mjs --export-leaderboard out.json
 *
 * The leaderboard lives on disk in data/leaderboard.json (top 10, score desc,
 * ties by earlier achieved_at), so it survives restarts and can be exported.
 */
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';

const root = resolve('.');
const dataDir = join(root, 'data');
const boardFile = join(dataDir, 'leaderboard.json');
const PORT = Number(process.env.PORT ?? 5173);
const NAME_RE = /^[\p{L}\p{N}_]{3,12}$/u;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.glb': 'model/gltf-binary',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.svg': 'image/svg+xml',
};

function loadBoard() {
  try {
    const parsed = JSON.parse(readFileSync(boardFile, 'utf8'));
    if (parsed && Array.isArray(parsed.entries)) return parsed;
  } catch {
    // no board yet
  }
  return { entries: [] };
}

function normalise(entries) {
  return [...entries]
    .filter((e) => e && typeof e.name === 'string' && Number.isFinite(e.score))
    .sort((a, b) => (b.score - a.score !== 0 ? b.score - a.score : String(a.achieved_at).localeCompare(String(b.achieved_at))))
    .slice(0, 10);
}

function saveBoard(board) {
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(boardFile, `${JSON.stringify({ entries: normalise(board.entries) }, null, 2)}\n`);
  return normalise(board.entries);
}

function isoWithOffset(date = new Date()) {
  const pad = (n) => String(Math.abs(n)).padStart(2, '0');
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
    `${sign}${pad(Math.floor(Math.abs(offset) / 60))}:${pad(Math.abs(offset) % 60)}`
  );
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
}

function serveStatic(req, res, pathname) {
  let file = join(root, 'dist', 'web', decodeURIComponent(pathname));
  try {
    if (statSync(file).isDirectory()) file = join(file, 'index.html');
  } catch {
    file = join(root, 'dist', 'web', 'index.html');
  }
  if (!file.startsWith(join(root, 'dist', 'web'))) return send(res, 403, 'forbidden', 'text/plain');
  if (!existsSync(file)) return send(res, 404, 'not found', 'text/plain');
  send(res, 200, readFileSync(file), MIME[extname(file)] ?? 'application/octet-stream');
}

const args = process.argv.slice(2);
const exportIndex = args.indexOf('--export-leaderboard');
if (exportIndex >= 0) {
  const out = args[exportIndex + 1];
  if (!out) {
    process.stderr.write('usage: node scripts/play.mjs --export-leaderboard <file>\n');
    process.exit(1);
  }
  const board = { entries: normalise(loadBoard().entries) };
  writeFileSync(resolve(out), `${JSON.stringify(board, null, 2)}\n`);
  process.stdout.write(`leaderboard: ${board.entries.length} entries → ${out}\n`);
  process.exit(0);
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const path = url.pathname;

  if (path === '/api/leaderboard' && req.method === 'GET') {
    return send(res, 200, JSON.stringify({ entries: normalise(loadBoard().entries) }));
  }

  if (path === '/api/leaderboard' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 4096) req.destroy();
    });
    req.on('end', () => {
      let payload;
      try {
        payload = JSON.parse(body);
      } catch {
        return send(res, 400, JSON.stringify({ error: 'bad json' }));
      }
      const name = String(payload.name ?? '').trim();
      if (!NAME_RE.test(name)) {
        return send(res, 400, JSON.stringify({ error: 'name must be 3-12 letters, digits or _' }));
      }
      const entry = {
        name,
        score: Math.max(0, Math.round(Number(payload.score) || 0)),
        nights_won: Math.min(3, Math.max(0, Math.round(Number(payload.nights_won) || 0))),
        achieved_at: typeof payload.achieved_at === 'string' ? payload.achieved_at : isoWithOffset(),
        seed: Math.round(Number(payload.seed) || 0),
      };
      const board = loadBoard();
      const entries = saveBoard({ entries: [...board.entries, entry] });
      return send(res, 200, JSON.stringify({ entries }));
    });
    return undefined;
  }

  if (path === '/api/proof') {
    return send(
      res,
      200,
      JSON.stringify({
        bench: readJson(join(root, 'docs', 'proof', 'phase-4', 'bench.json')),
        soak: readJson(join(root, 'docs', 'proof', 'phase-4', 'soak.json')),
      }),
    );
  }

  return serveStatic(req, res, path);
});

server.listen(PORT, () => {
  process.stdout.write(`Đảo Đèn Lồng: http://localhost:${PORT}\n`);
});
