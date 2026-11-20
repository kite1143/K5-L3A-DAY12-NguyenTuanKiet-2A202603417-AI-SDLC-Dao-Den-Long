import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig } from 'vite';

// esbuild writes a temp file while minifying and then deletes it. On some
// Windows machines deleting files in the platform temp folder is denied
// (security software or a locked-down profile), which fails the build with
// "Access is denied". Pointing TEMP at a project-local folder avoids that
// without changing anything for macOS/Linux graders.
if (process.platform === 'win32') {
  const localTemp = join(process.cwd(), '.tmp');
  mkdirSync(localTemp, { recursive: true });
  process.env.TEMP = localTemp;
  process.env.TMP = localTemp;
}

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist/web',
    emptyOutDir: true,
    target: 'es2022',
  },
  server: { port: 5173 },
  preview: { port: 5173, strictPort: true },
});
