#!/usr/bin/env node
/**
 * fetch-assets.mjs — re-download the low-poly props in public/models.
 *
 * The GLB files are committed, so nobody needs to run this to play the game;
 * it exists so the asset list is reproducible and reviewable. Files come from
 * Polyfork under CC BY 4.0 (see CREDITS.md for the credit lines) — only the
 * GLB mesh files are fetched, because the ES modules are not CC BY.
 *
 * Usage: npm run assets
 */
import { execFileSync } from 'node:child_process';

const MODELS = [
  'tall-pine-tree-ab4108',
  'young-pine-0d7695',
  'medium-rock-e08405',
  'small-rock-db33a7',
  'harbour-master-s-hut-226f34',
  'wooden-rowboat-916981',
  'spirit-lantern-8d1bfc',
  'glowing-bonnet-mushroom-13f518',
];

const bin = 'node_modules/polyfork/bin/polyfork.mjs';

for (const id of MODELS) {
  process.stdout.write(`fetching ${id} ... `);
  try {
    execFileSync(process.execPath, [bin, 'add', id, '--format', 'glb', '--dir', 'public/models', '--force'], {
      stdio: ['ignore', 'ignore', 'ignore'],
    });
    process.stdout.write('ok\n');
  } catch (error) {
    process.stdout.write(`FAILED (${error.message.split('\n')[0]})\n`);
    process.exitCode = 1;
  }
}

process.stdout.write('\nmodels in public/models — credit them in CREDITS.md if the list changes\n');
