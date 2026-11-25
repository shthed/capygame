import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { CAPYGAME_VERSION, formatAppVersionLabel } from '../config/appVersion';
import {
  CAPYGAME_OVERVIEW_COPY,
  CAPYGAME_TUTORIALS,
  clampTutorialStepIndex,
  getTutorialById,
  stepTutorialState,
} from './TutorialCatalog';

test('TutorialCatalog: provides valid tutorials, unique IDs, and deterministic step transitions', () => {
  assert.ok(CAPYGAME_OVERVIEW_COPY.heading === 'About CapyGame');
  assert.ok(
    CAPYGAME_OVERVIEW_COPY.summary.includes('CapyGame 3D'),
    'About overview should retain CapyGame 3D branding'
  );
  assert.ok(CAPYGAME_TUTORIALS.length >= 4, 'Expected at least 4 interactive tutorials');

  const seenIds = new Set<string>();
  for (const tutorial of CAPYGAME_TUTORIALS) {
    assert.ok(tutorial.id.length > 0);
    assert.ok(!seenIds.has(tutorial.id), `Duplicate tutorial id: ${tutorial.id}`);
    seenIds.add(tutorial.id);
    assert.ok(tutorial.steps.length >= 2, `Tutorial ${tutorial.id} should have >=2 steps`);
    for (const step of tutorial.steps) {
      assert.ok(step.title.trim().length > 0);
      assert.ok(step.instruction.trim().length > 0);
      assert.ok(step.controlHint.trim().length > 0);
    }
  }

  const capytorio = getTutorialById('capytorio_basics');
  assert.ok(capytorio);
  assert.equal(capytorio.launchTarget, 'capytorio');
  assert.equal(getTutorialById('nonexistent'), null);

  assert.equal(clampTutorialStepIndex(capytorio, -5), 0);
  assert.equal(clampTutorialStepIndex(capytorio, 999), capytorio.steps.length - 1);

  let state = { tutorialId: capytorio.id, stepIndex: 0 };
  // Stepping back at 0 stays at 0
  state = stepTutorialState(state, -1)!;
  assert.equal(state.stepIndex, 0);

  // Advance through all steps and verify completion returns null
  for (let i = 1; i < capytorio.steps.length; i++) {
    const next = stepTutorialState(state, 1);
    assert.ok(next);
    assert.equal(next.stepIndex, i);
    state = next;
  }
  assert.equal(stepTutorialState(state, 1), null);
});

test('About CapyGame version and SemVer sync across package.json, package-lock.json, appVersion.ts, and CHANGELOG.md', () => {
  const root = process.cwd();
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) as {
    version: string;
  };
  const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8')) as {
    version: string;
    packages?: Record<string, { version?: string }>;
  };
  const changelog = fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8');
  const agents = fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8');
  const viewSrc = fs.readFileSync(
    path.join(root, 'src/capygame/components/CapyGameView.tsx'),
    'utf8'
  );

  assert.match(pkg.version, /^\d+\.\d+\.\d+$/, 'package.json version must follow SemVer');
  assert.equal(lock.version, pkg.version, 'package-lock.json version must match package.json');
  assert.equal(
    lock.packages?.['']?.version,
    pkg.version,
    'package-lock.json packages[""].version must match package.json'
  );
  assert.equal(
    CAPYGAME_VERSION,
    pkg.version,
    'appVersion fallback must match package.json version'
  );
  assert.equal(formatAppVersionLabel(pkg.version), `v${pkg.version}`);

  const topEntryMatch = changelog.match(/^## \[(\d+\.\d+\.\d+)\] - \d{4}-\d{2}-\d{2}/m);
  assert.ok(topEntryMatch, 'CHANGELOG.md must contain a ## [X.Y.Z] - YYYY-MM-DD heading');
  assert.equal(
    topEntryMatch[1],
    pkg.version,
    'Top CHANGELOG.md version must match package.json version'
  );
  assert.ok(
    agents.includes('CHANGELOG.md') && agents.includes('SemVer'),
    'AGENTS.md must document the SemVer + CHANGELOG.md invariant'
  );

  // Verify System Architecture and Surface Sectors were removed from About CapyGame modal
  const aboutModalStart = viewSrc.indexOf('data-testid="capygame-about-modal"');
  const aboutModalEnd = viewSrc.indexOf('SETTINGS MODAL', aboutModalStart);
  assert.ok(aboutModalStart > 0 && aboutModalEnd > aboutModalStart);
  const aboutSection = viewSrc.slice(aboutModalStart, aboutModalEnd);
  assert.ok(aboutSection.includes('CAPYGAME_OVERVIEW_COPY.heading'));
  assert.ok(!aboutSection.includes('System Architecture'));
  assert.ok(!aboutSection.includes('Surface Sectors'));
  assert.ok(aboutSection.includes('formatAppVersionLabel'));
  assert.ok(aboutSection.includes('CAPYGAME_TUTORIALS'));
});
