// Builds a Vercel "Build Output API v3" bundle in .vercel/output:
//   static/                 the web app (vite build)
//   functions/api.func/     one Node function: server/vercel.ts bundled with esbuild
//   config.json             /api/* → the function, everything else → the SPA
// Deploy with: vercel deploy --prebuilt   (see docs/DEPLOY.md)
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const out = path.join(root, '.vercel/output');
fs.rmSync(out, { recursive: true, force: true });

execSync('npx vite build', { cwd: root, stdio: 'inherit' });
fs.cpSync(path.join(root, 'dist'), path.join(out, 'static'), { recursive: true });

const fn = path.join(out, 'functions/api.func');
fs.mkdirSync(fn, { recursive: true });
await build({
  entryPoints: [path.join(root, 'server/vercel.ts')],
  outfile: path.join(fn, 'index.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  external: ['pg-native'],
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
  logLevel: 'info',
});
fs.writeFileSync(
  path.join(fn, '.vc-config.json'),
  JSON.stringify({ runtime: 'nodejs22.x', handler: 'index.mjs', launcherType: 'Nodejs', shouldAddHelpers: false, maxDuration: 30 }, null, 2),
);

fs.writeFileSync(
  path.join(out, 'config.json'),
  JSON.stringify(
    {
      version: 3,
      routes: [
        // Security headers on every response. The app loads no third-party scripts; images
        // come from Google/Unsplash over https; all API calls are same-origin.
        {
          src: '/(.*)',
          headers: {
            'Content-Security-Policy': [
              "default-src 'self'",
              "script-src 'self'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              "connect-src 'self'",
              "manifest-src 'self'",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
            ].join('; '),
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY',
            'Referrer-Policy': 'strict-origin-when-cross-origin',
            'Permissions-Policy': 'geolocation=(self), camera=(), microphone=(), payment=()',
            'Strict-Transport-Security': 'max-age=63072000; includeSubDomains',
          },
          continue: true,
        },
        { src: '^/api(/.*)?$', dest: '/api' },
        { handle: 'filesystem' },
        { src: '/.*', dest: '/index.html' },
      ],
    },
    null,
    2,
  ),
);
console.log(`\nVercel output ready in ${path.relative(root, out)}`);
