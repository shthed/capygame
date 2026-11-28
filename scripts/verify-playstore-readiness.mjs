import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const errors = [];
const warnings = [];

function assertCond(cond, message) {
  if (!cond) {
    errors.push(message);
  }
}

function readJson(relPath) {
  const full = path.join(ROOT, relPath);
  if (!fs.existsSync(full)) {
    errors.push(`Missing required file: ${relPath}`);
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(full, 'utf8'));
  } catch (err) {
    errors.push(`Invalid JSON in ${relPath}: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

const pkg = readJson('package.json');
const manifest = readJson('public/manifest.webmanifest');
const twa = readJson('twa-manifest.json');
const assetlinks = readJson('public/.well-known/assetlinks.json');

// 1. Validate Web App Manifest
if (manifest) {
  assertCond(manifest.name === 'CapyGame', 'manifest.webmanifest name must be "CapyGame"');
  assertCond(manifest.display === 'standalone', 'manifest.webmanifest display must be "standalone"');
  assertCond(manifest.start_url === './', 'manifest.webmanifest start_url must stay relative "./"');
  assertCond(Array.isArray(manifest.icons) && manifest.icons.length >= 3, 'manifest.webmanifest must declare at least 3 icons');
  assertCond(
    manifest.icons.some((i) => i.purpose === 'maskable' && i.sizes === '512x512'),
    'manifest.webmanifest must include a 512x512 maskable icon'
  );
  assertCond(
    Array.isArray(manifest.screenshots) && manifest.screenshots.length >= 4,
    'manifest.webmanifest must include wide and narrow screenshots'
  );
  assertCond(
    Array.isArray(manifest.shortcuts) && manifest.shortcuts.length >= 3,
    'manifest.webmanifest must include 3 mode shortcuts'
  );

  for (const icon of manifest.icons || []) {
    const p = path.join(ROOT, 'public', icon.src);
    assertCond(fs.existsSync(p), `Missing manifest icon file: public/${icon.src}`);
  }
  for (const shot of manifest.screenshots || []) {
    const p = path.join(ROOT, 'public', shot.src);
    assertCond(fs.existsSync(p), `Missing manifest screenshot file: public/${shot.src}`);
  }
}

// 2. Validate TWA Manifest
if (twa && pkg) {
  assertCond(twa.packageId === 'com.capyboop.capygame', 'twa-manifest.json packageId mismatch');
  assertCond(
    twa.appVersionName === pkg.version,
    `twa-manifest.json appVersionName (${twa.appVersionName}) does not match package.json version (${pkg.version})`
  );
  assertCond(
    typeof twa.appVersionCode === 'number' && twa.appVersionCode >= 100,
    'twa-manifest.json appVersionCode must be a positive integer >= 100'
  );
  assertCond(twa.minSdkVersion >= 24, 'twa-manifest.json minSdkVersion must be >= 24');
}

// 3. Validate Digital Asset Links
if (Array.isArray(assetlinks)) {
  const entry = assetlinks[0];
  assertCond(
    entry?.target?.package_name === 'com.capyboop.capygame',
    'assetlinks.json package_name must be com.capyboop.capygame'
  );
  const fps = entry?.target?.sha256_cert_fingerprints || [];
  assertCond(Array.isArray(fps) && fps.length > 0, 'assetlinks.json must contain sha256_cert_fingerprints');
  if (fps.some((fp) => String(fp).includes('REPLACE_WITH'))) {
    warnings.push(
      'public/.well-known/assetlinks.json still contains placeholder SHA-256 fingerprint (replace with Play App Signing SHA-256 before Play Store launch).'
    );
  }
}

// 4. Validate Privacy Policy, Terms of Service & Store Feature Graphic
assertCond(fs.existsSync(path.join(ROOT, 'public/privacy.html')), 'Missing public/privacy.html');
assertCond(fs.existsSync(path.join(ROOT, 'public/terms.html')), 'Missing public/terms.html');
assertCond(
  fs.existsSync(path.join(ROOT, 'public/assets/feature-graphic-1024x500.png')),
  'Missing public/assets/feature-graphic-1024x500.png'
);
assertCond(fs.existsSync(path.join(ROOT, '.env.example')), 'Missing .env.example');

// 5. Validate Built dist/ Artifacts & Cold-Boot Preload Diet (if dist/ exists)
const distIndexPath = path.join(ROOT, 'dist/index.html');
if (fs.existsSync(distIndexPath)) {
  const html = fs.readFileSync(distIndexPath, 'utf8');
  assertCond(
    !html.includes('vendor-three'),
    'Cold-boot regression: dist/index.html eagerly preloads vendor-three'
  );
  assertCond(
    !html.includes('feature-universe'),
    'Cold-boot regression: dist/index.html eagerly preloads feature-universe'
  );
  assertCond(
    !html.includes('feature-capytorio'),
    'Cold-boot regression: dist/index.html eagerly preloads feature-capytorio'
  );
  assertCond(
    !html.includes('vendor-firebase'),
    'Cold-boot regression: dist/index.html eagerly preloads vendor-firebase'
  );
  assertCond(
    !html.includes('accounts.google.com/gsi/client'),
    'Cold-boot regression: dist/index.html eagerly loads Google Identity Services script'
  );
  assertCond(
    fs.existsSync(path.join(ROOT, 'dist/.well-known/assetlinks.json')),
    'Missing dist/.well-known/assetlinks.json in production build output'
  );
  assertCond(
    fs.existsSync(path.join(ROOT, 'dist/privacy.html')),
    'Missing dist/privacy.html in production build output'
  );
  assertCond(
    fs.existsSync(path.join(ROOT, 'dist/terms.html')),
    'Missing dist/terms.html in production build output'
  );
  assertCond(
    fs.existsSync(path.join(ROOT, 'dist/manifest.webmanifest')),
    'Missing dist/manifest.webmanifest in production build output'
  );
  const distAssetsDir = path.join(ROOT, 'dist/assets');
  if (fs.existsSync(distAssetsDir)) {
    const assetFiles = fs.readdirSync(distAssetsDir).filter((f) => f.endsWith('.js'));
    for (const file of assetFiles) {
      if (file.startsWith('vendor-') || file.startsWith('physics.worker')) continue;
      const bytes = fs.statSync(path.join(distAssetsDir, file)).size;
      assertCond(
        bytes <= 500 * 1024,
        `Feature chunk budget exceeded (>500 KB): dist/assets/${file} is ${(bytes / 1024).toFixed(1)} KB`
      );
    }
  }
} else {
  warnings.push('dist/index.html not found yet; run npm run build to validate production bundle output.');
}

if (warnings.length > 0) {
  console.log('[PlayStore Preflight] Warnings:');
  for (const w of warnings) {
    console.log(`  - ${w}`);
  }
}

if (errors.length > 0) {
  console.error('[PlayStore Preflight] FAILED:');
  for (const e of errors) {
    console.error(`  - ${e}`);
  }
  process.exit(1);
}

console.log('[PlayStore Preflight] PASSED all Play Store packaging and cold-boot checks.');
