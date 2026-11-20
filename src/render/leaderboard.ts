/**
 * Local leaderboard client.
 *
 * The Node server (`scripts/play.mjs`) owns data/leaderboard.json so entries
 * survive restarts and can be exported with --export-leaderboard. When the page
 * is opened without that server (vite preview, file://), the same board is kept
 * in localStorage so the game stays playable.
 */
export interface Entry {
  name: string;
  score: number;
  nights_won: number;
  achieved_at: string;
  seed: number;
}

export const NAME_RE = /^[\p{L}\p{N}_]{3,12}$/u;
const FALLBACK_KEY = 'dao-den-long.leaderboard.v1';

function normalise(entries: Entry[]): Entry[] {
  return [...entries]
    .sort((a, b) =>
      b.score - a.score !== 0 ? b.score - a.score : String(a.achieved_at).localeCompare(String(b.achieved_at)),
    )
    .slice(0, 10);
}

function readFallback(): Entry[] {
  try {
    const raw = localStorage.getItem(FALLBACK_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { entries?: Entry[] };
      if (Array.isArray(parsed.entries)) return normalise(parsed.entries);
    }
  } catch {
    // ignore
  }
  return [];
}

function writeFallback(entries: Entry[]): void {
  try {
    localStorage.setItem(FALLBACK_KEY, JSON.stringify({ entries: normalise(entries) }));
  } catch {
    // ignore
  }
}

export async function fetchBoard(): Promise<Entry[]> {
  try {
    const response = await fetch('/api/leaderboard', { cache: 'no-store' });
    if (response.ok) {
      const body = (await response.json()) as { entries?: Entry[] };
      if (Array.isArray(body.entries)) return normalise(body.entries);
    }
  } catch {
    // no server API: fall through to localStorage
  }
  return readFallback();
}

export function isoWithOffset(date = new Date()): string {
  const pad = (n: number): string => String(Math.abs(n)).padStart(2, '0');
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
    `${sign}${pad(Math.floor(Math.abs(offset) / 60))}:${pad(Math.abs(offset) % 60)}`
  );
}

export async function submitScore(entry: {
  name: string;
  score: number;
  nights_won: number;
  seed: number;
}): Promise<Entry[]> {
  const payload = { ...entry, achieved_at: isoWithOffset() };
  try {
    const response = await fetch('/api/leaderboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (response.ok) {
      const body = (await response.json()) as { entries?: Entry[] };
      if (Array.isArray(body.entries)) return normalise(body.entries);
    }
  } catch {
    // offline: keep it locally
  }
  const entries = normalise([...readFallback(), payload]);
  writeFallback(entries);
  return entries;
}

export async function fetchProof(): Promise<{ bench: unknown; soak: unknown } | null> {
  try {
    const response = await fetch('/api/proof', { cache: 'no-store' });
    if (!response.ok) return null;
    return (await response.json()) as { bench: unknown; soak: unknown };
  } catch {
    return null;
  }
}
