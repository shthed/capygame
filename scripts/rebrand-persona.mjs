#!/usr/bin/env node
/**
 * Clean-room public persona exporter for `capyboop/capygame`.
 *
 * Exports a clean, standalone copy of the repository where `capyboop` is the sole
 * author and owner with zero trace of `shthed`, dev-only mirror workflows, or
 * rebrand scripts anywhere in the exported tree.
 *
 * Usage:
 *   node scripts/rebrand-persona.mjs --stage-dir /tmp/capyboop-stage
 *   node scripts/rebrand-persona.mjs --dry-run
 *   node scripts/rebrand-persona.mjs --verify-clean /tmp/capyboop-stage
 *   git log -1 --format=%s | node scripts/rebrand-persona.mjs --sanitize-message
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

export const DEV_ONLY_RELATIVE_PATHS = new Set([
  'scripts/rebrand-persona.mjs',
  '.github/workflows/publish-capyboop.yml',
  'docs/sync',
]);

export const SKIP_COPY_DIR_NAMES = new Set([
  '.git',
  '.agents',
  '.kotlin',
  '.artifacts',
  '.idea',
  '.vscode',
  'inspect',
  'project',
  'node_modules',
  'dist',
  '.wrangler',
  '.gradle',
  'build',
]);

const TEXT_EXTENSIONS = new Set([
  '.md',
  '.html',
  '.ts',
  '.tsx',
  '.js',
  '.mjs',
  '.cjs',
  '.json',
  '.jsonc',
  '.yml',
  '.yaml',
  '.css',
  '.svg',
  '.txt',
  '.webmanifest',
]);

const TEXT_FILENAMES = new Set([
  '.gitignore',
  'LICENSE',
  '_redirects',
  '_headers',
]);

export const FORBIDDEN_PERSONA_REGEX =
  /shthed|hairy[\s_-]*dog[\s_-]*trumpet|381055\+|CAPYBOOP_SYNC_TOKEN|capyboop@gmail\.com|rebrand-persona|publish-capyboop|persona:capyboop|capy-dev-only/i;

export function stripDevOnlyBlocks(content) {
  return content
    .replace(/\n?<!-- capy-dev-only:start -->[\s\S]*?<!-- capy-dev-only:end -->\n?/g, '\n')
    .replace(/\n?\/\* capy-dev-only:start \*\/[\s\S]*?\/\* capy-dev-only:end \*\/\n?/g, '\n');
}

export function transformPersonaContent(content) {
  return stripDevOnlyBlocks(content)
    .replace(
      /\[([^\[\]\r\n]+)\]\(https:\/\/github\.com\/(?:shthed|capyboop)\/capygame\/(?:pull|issues|milestone)\/\d+(?:[/?#][^\s)]*)?\)/g,
      '$1'
    )
    .replace(
      /https:\/\/(?:shthed|capyboop)\.github\.io\/capygame\/(?:PR|pull)\/\d+\/?/g,
      'https://capyboop.com/'
    )
    .replace(/381055\+shthed@users\.noreply\.github\.com/gi, '354866242+capyboop@users.noreply.github.com')
    .replace(/shthed@gmail\.com/gi, '354866242+capyboop@users.noreply.github.com')
    .replaceAll('https://shthed.github.io/capygame/', 'https://capyboop.com/')
    .replaceAll('https://shthed.github.io/capygame', 'https://capyboop.com')
    .replaceAll('https://github.com/shthed/capygame', 'https://github.com/capyboop/capygame')
    .replaceAll('github.com/shthed/capygame', 'github.com/capyboop/capygame')
    .replaceAll('github.com/shthed', 'github.com/capyboop')
    .replace(/shthed\.github\.io\/capygame/gi, 'capyboop.com')
    .replaceAll('shthed.github.io', 'capyboop.github.io')
    .replaceAll('shthed/capygame', 'capyboop/capygame')
    .replace(/hairy[\s_-]*dog[\s_-]*trumpet/gi, 'capyboop')
    .replace(/shthed/gi, (match) => (match === match.toUpperCase() ? 'CAPYBOOP' : 'capyboop'));
}

export function sanitizeCommitMessage(rawMessage) {
  const firstLine =
    String(rawMessage || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.length > 0) || 'Update CapyGame';

  const withoutPrSuffix = firstLine.replace(/\s*\(#\d+\)\s*$/, '').trim();
  const sanitized = transformPersonaContent(withoutPrSuffix).replace(/\s+/g, ' ').trim();
  const result = sanitized.length > 0 ? sanitized : 'Update CapyGame';

  if (FORBIDDEN_PERSONA_REGEX.test(result)) {
    throw new Error(`Sanitized commit message still contains forbidden persona identifier: ${result}`);
  }
  return result;
}

function isTextFile(filePath) {
  const base = path.basename(filePath);
  if (TEXT_FILENAMES.has(base)) return true;
  return TEXT_EXTENSIONS.has(path.extname(base).toLowerCase());
}

export function assertZeroSourcePersonaLeak(stageDir) {
  if (!stageDir) {
    throw new Error('assertZeroSourcePersonaLeak requires a target stageDir');
  }
  const resolvedStage = path.resolve(stageDir);
  if (!fs.existsSync(resolvedStage)) {
    throw new Error(`Stage directory does not exist: ${resolvedStage}`);
  }
  if (!fs.statSync(resolvedStage).isDirectory()) {
    throw new Error(`Stage path is not a directory: ${resolvedStage}`);
  }

  for (const devOnlyRel of DEV_ONLY_RELATIVE_PATHS) {
    const devOnlyAbs = path.join(resolvedStage, devOnlyRel);
    if (fs.existsSync(devOnlyAbs)) {
      throw new Error(`Dev-only path must not exist in clean public export: ${devOnlyRel}`);
    }
  }

  let scannedFiles = 0;
  function walk(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      if (SKIP_COPY_DIR_NAMES.has(entry.name)) continue;
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (!entry.isFile()) continue;

      scannedFiles++;
      const rawBytes = fs.readFileSync(fullPath);
      const latin1 = rawBytes.toString('latin1');
      const match = latin1.match(FORBIDDEN_PERSONA_REGEX);
      if (match) {
        const rel = path.relative(resolvedStage, fullPath).replace(/\\/g, '/');
        throw new Error(`Forbidden persona token "${match[0]}" leaked in ${rel}`);
      }
    }
  }

  walk(resolvedStage);
  return scannedFiles;
}

export function exportCleanPersonaStage({ repoRoot = REPO_ROOT, stageDir }) {
  if (!stageDir) {
    throw new Error('exportCleanPersonaStage requires a target stageDir');
  }
  const resolvedRoot = path.resolve(repoRoot);
  const resolvedStage = path.resolve(stageDir);
  if (resolvedStage === resolvedRoot || resolvedStage.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error('stageDir must be outside repoRoot');
  }
  const forbiddenStageRoots = new Set([
    path.parse(resolvedStage).root,
    path.resolve(os.tmpdir()),
    path.resolve(os.homedir()),
  ]);
  if (forbiddenStageRoots.has(resolvedStage) || resolvedRoot.startsWith(`${resolvedStage}${path.sep}`)) {
    throw new Error(`Refusing destructive stageDir target: ${resolvedStage}`);
  }

  fs.rmSync(resolvedStage, { recursive: true, force: true });
  fs.mkdirSync(resolvedStage, { recursive: true });

  let filesCopied = 0;
  let filesTransformed = 0;

  function copyWalk(srcDir, dstDir) {
    fs.mkdirSync(dstDir, { recursive: true });
    const entries = fs.readdirSync(srcDir, { withFileTypes: true });
    for (const entry of entries) {
      if (SKIP_COPY_DIR_NAMES.has(entry.name)) continue;
      const srcPath = path.join(srcDir, entry.name);
      const relPath = path.relative(resolvedRoot, srcPath).replace(/\\/g, '/');
      if (DEV_ONLY_RELATIVE_PATHS.has(relPath)) continue;

      const dstPath = path.join(dstDir, entry.name);
      if (entry.isDirectory()) {
        copyWalk(srcPath, dstPath);
        continue;
      }
      if (!entry.isFile()) continue;

      filesCopied++;
      if (relPath === 'package.json') {
        const beforePkg = fs.readFileSync(srcPath, 'utf8');
        const pkg = JSON.parse(beforePkg);
        if (pkg.scripts && 'persona:capyboop' in pkg.scripts) {
          delete pkg.scripts['persona:capyboop'];
        }
        const serialized = transformPersonaContent(`${JSON.stringify(pkg, null, 2)}\n`);
        fs.writeFileSync(dstPath, serialized, { encoding: 'utf8', mode: fs.statSync(srcPath).mode });
        if (serialized !== beforePkg) filesTransformed++;
        continue;
      }

      if (isTextFile(srcPath)) {
        const before = fs.readFileSync(srcPath, 'utf8');
        const after = transformPersonaContent(before);
        fs.writeFileSync(dstPath, after, { encoding: 'utf8', mode: fs.statSync(srcPath).mode });
        if (after !== before) filesTransformed++;
      } else {
        fs.copyFileSync(srcPath, dstPath);
      }
    }
  }

  copyWalk(resolvedRoot, resolvedStage);
  const verifiedFiles = assertZeroSourcePersonaLeak(resolvedStage);
  return { filesCopied, filesTransformed, verifiedFiles };
}

export function parseCliArgs(argv) {
  let mode = null;
  let dir = null;

  function setMode(nextMode, flagName) {
    if (mode !== null) {
      throw new Error(`Conflicting or duplicate mode flag: ${flagName} (already set to --${mode})`);
    }
    mode = nextMode;
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      setMode('help', arg);
    } else if (arg === '--dry-run') {
      setMode('dry-run', arg);
    } else if (arg === '--sanitize-message') {
      setMode('sanitize-message', arg);
    } else if (arg === '--verify-clean' || arg === '--stage-dir') {
      const flagMode = arg.slice(2);
      setMode(flagMode, arg);
      const nextArg = argv[i + 1];
      if (!nextArg || nextArg.startsWith('-')) {
        throw new Error(`${arg} requires a directory path`);
      }
      dir = nextArg;
      i++;
    } else if (arg.startsWith('--verify-clean=') || arg.startsWith('--stage-dir=')) {
      const eqIdx = arg.indexOf('=');
      const flagName = arg.slice(0, eqIdx);
      const value = arg.slice(eqIdx + 1);
      setMode(flagName.slice(2), flagName);
      if (!value) {
        throw new Error(`${flagName} requires a non-empty directory path`);
      }
      dir = value;
    } else if (arg.startsWith('-')) {
      throw new Error(`Unknown flag: ${arg}`);
    } else {
      throw new Error(`Unexpected positional argument: ${arg}`);
    }
  }

  return { mode: mode ?? 'dry-run', dir };
}

function printUsage() {
  console.log(`Usage: node scripts/rebrand-persona.mjs [MODE]

Modes:
  --dry-run               Run clean-room export to a temporary directory and verify zero leaks (default)
  --stage-dir <dir>       Export clean-room repository to <dir> and verify zero leaks (also supports --stage-dir=<dir>)
  --verify-clean <dir>    Verify existing directory <dir> has zero source-persona leaks (also supports --verify-clean=<dir>)
  --sanitize-message      Read commit message from stdin and output sanitized single-line message
  -h, --help              Show this help message`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let parsed;
  try {
    parsed = parseCliArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    printUsage();
    process.exit(1);
  }

  try {
    if (parsed.mode === 'help') {
      printUsage();
      process.exit(0);
    }

    if (parsed.mode === 'sanitize-message') {
      const stdinText = fs.readFileSync(0, 'utf8');
      process.stdout.write(`${sanitizeCommitMessage(stdinText)}\n`);
      process.exit(0);
    }

    if (parsed.mode === 'verify-clean') {
      const count = assertZeroSourcePersonaLeak(path.resolve(parsed.dir));
      console.log(`Verified ${count} clean files with zero source-persona leaks.`);
      process.exit(0);
    }

    if (parsed.mode === 'stage-dir') {
      const targetDir = path.resolve(parsed.dir);
      const stats = exportCleanPersonaStage({ stageDir: targetDir });
      console.log(
        `Exported clean capyboop repository to ${targetDir} (${stats.filesCopied} files copied, ${stats.filesTransformed} transformed, ${stats.verifiedFiles} verified zero-leak).`
      );
      process.exit(0);
    }

    const tmpStage = fs.mkdtempSync(path.join(os.tmpdir(), 'capyboop-dryrun-'));
    try {
      const stats = exportCleanPersonaStage({ stageDir: tmpStage });
      console.log(
        `[dry-run] Clean capyboop export verified (${stats.filesCopied} files copied, ${stats.filesTransformed} transformed, ${stats.verifiedFiles} verified zero-leak).`
      );
    } finally {
      fs.rmSync(tmpStage, { recursive: true, force: true });
    }
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
