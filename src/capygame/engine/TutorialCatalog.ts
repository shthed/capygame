export type TutorialLaunchTarget =
  | 'cosmos'
  | 'sanctuary'
  | 'capytorio'
  | 'genesis_setup';

export interface TutorialStep {
  id: string;
  title: string;
  instruction: string;
  controlHint: string;
}

export interface CapyTutorial {
  id: string;
  title: string;
  badge: string;
  summary: string;
  durationLabel: string;
  launchTarget: TutorialLaunchTarget;
  steps: TutorialStep[];
}

export interface ActiveTutorialState {
  tutorialId: string;
  stepIndex: number;
}

export const CAPYGAME_OVERVIEW_COPY = {
  heading: 'About CapyGame',
  subtitle: 'Help & Game Overview',
  summary:
    'CapyGame 3D is a seamless 3D universe explorer and cozy capybara playground. Fly a time-traveling Chrono-Vessel from galaxies down to subatomic foam, roam a sunny 3D island sanctuary to grow your Capy-Snake trail, or automate belt-fed factories in Capytorio.',
  controlsSummary:
    'Move with WASD or Arrow keys (drag on touch), Space to jump, drag mouse or press M to look around, and scroll or pinch to zoom continuously between ground and deep space.',
} as const;

export const CAPYGAME_TUTORIALS: CapyTutorial[] = [
  {
    id: 'cosmic_tour',
    title: 'Cosmic Scale & Flight Tutorial',
    badge: 'Space',
    summary:
      'Learn how to pilot the Chrono-Vessel from the Multiverse down through galaxies, planets, and tiny micro-worlds.',
    durationLabel: '3 steps · ~1 min',
    launchTarget: 'cosmos',
    steps: [
      {
        id: 'cosmic_speed',
        title: 'Fly Forward & Rewind',
        instruction:
          'Use the Fast Forward, Play/Pause, and Rewind buttons at the bottom-right (or scroll your mouse wheel) to cruise smoothly across scales.',
        controlHint: 'Wheel / Bottom-Right Controls',
      },
      {
        id: 'cosmic_spiral',
        title: 'Switch Between Spiral & Straight',
        instruction:
          'Tap the Spiral / Straight toggle above the speed buttons to orbit 360° around each cosmic band or fly straight through.',
        controlHint: 'Spiral Toggle · Drag or M to Look',
      },
      {
        id: 'cosmic_land',
        title: 'Jump to Any Scale or Switch Games',
        instruction:
          'Open the Scale Scrubber in the top bar to jump straight to any scale (from Multiverse down to Planck), or use the top-bar switcher to jump into Forest Games or Capytorio.',
        controlHint: 'Top Bar: Infinite Zoom · Forest Games · Capytorio',
      },
    ],
  },
  {
    id: 'sanctuary_basics',
    title: 'Forest Games & Capy-Snake Tutorial',
    badge: 'Forest',
    summary:
      'Roam one unified sunny island, match oranges to grow longer, and walk seamlessly into Lagoon, Stampede, and Yuzu Mountain.',
    durationLabel: '3 steps · ~1 min',
    launchTarget: 'sanctuary',
    steps: [
      {
        id: 'sanctuary_move',
        title: 'Walk, Jump & Look Around',
        instruction:
          'Move with WASD or Arrow keys (or drag on touch), tap Space to jump, and drag the screen to orbit the camera behind your Capybara.',
        controlHint: 'WASD · Space Jump · Drag / M Look',
      },
      {
        id: 'sanctuary_oranges',
        title: 'Grow Your Capy-Snake Trail',
        instruction:
          'Check the colored orange resting on your Capybara’s head, then bump citrus trees carrying that same fruit to add segments to your back.',
        controlHint: 'Match Head Orange -> Bump Trees',
      },
      {
        id: 'sanctuary_bridges',
        title: 'Dash, Belly-Flop & Roam the Island',
        instruction:
          'Press Shift or Q to Dash, Ctrl or C mid-air for a Belly-Flop splash, or roam straight across the unified island meadow to reach Lagoon, Stampede, and Yuzu Mountain.',
        controlHint: 'Shift/Q Dash · Ctrl/C Dive · Explore',
      },
    ],
  },
  {
    id: 'capytorio_basics',
    title: 'Capytorio Factory Tutorial',
    badge: 'Factory',
    summary:
      'Mine ore and fresh oranges, lay transport belts, power generators, and automate science packs.',
    durationLabel: '4 steps · ~2 min',
    launchTarget: 'capytorio',
    steps: [
      {
        id: 'capytorio_mine',
        title: 'Harvest Ores & Citrus Trees',
        instruction:
          'Walk near Iron, Copper, Coal, Stone, or Orange trees and press E (or click/tap) to gather starter materials into your pocket.',
        controlHint: 'WASD Move · E / Click Mine',
      },
      {
        id: 'capytorio_build',
        title: 'Place Drills, Belts & Furnaces',
        instruction:
          'Choose a tool from the bottom quickbar (keys 1–0), press R to rotate, and click or drag across the ground to place drills and auto-turning belts.',
        controlHint: '1–0 Select · R Rotate · Click/Drag Build',
      },
      {
        id: 'capytorio_power',
        title: 'Craft, Fuel & Inspect Machines',
        instruction:
          'Press I to open Crafting & Inventory, stand near a Generator and press F to load Coal or Oranges, or click any placed machine to inspect buffers.',
        controlHint: 'I Craft/Bag · F Fuel · V Toggle Camera',
      },
      {
        id: 'capytorio_pedia',
        title: 'Use Capytoriopedia Anytime',
        instruction:
          'Hold Alt + Left-Click on any machine, ore patch, or recipe (or tap the Book icon at top-right) to open the built-in Capytoriopedia guide.',
        controlHint: 'Alt + Click · Tech Drawer',
      },
    ],
  },
  {
    id: 'genesis_setup',
    title: 'Pilot, Ship & Universe Setup',
    badge: 'Setup',
    summary:
      'Customize your Capybara pilot, fur color, hat, Chrono-Vessel trim, and universe physics.',
    durationLabel: '2 steps · Quick',
    launchTarget: 'genesis_setup',
    steps: [
      {
        id: 'genesis_pilot',
        title: 'Choose Your Pilot & Spaceship',
        instruction:
          'Pick a Capybara archetype, fur style, and hat in the Pilot tab, then customize your saucer canopy and Cherenkov thrusters in Spaceship.',
        controlHint: 'Pilot & Spaceship Tabs',
      },
      {
        id: 'genesis_universe',
        title: 'Tune Physics & Launch',
        instruction:
          'Adjust the Fine-Structure Constant in Universe α if you like, then click Launch Chrono-Vessel (or close to keep playing where you left off).',
        controlHint: 'Launch Chrono-Vessel or Close',
      },
    ],
  },
];

export function getTutorialById(tutorialId: string | null | undefined): CapyTutorial | null {
  if (!tutorialId) return null;
  return CAPYGAME_TUTORIALS.find((t) => t.id === tutorialId) ?? null;
}

export function clampTutorialStepIndex(tutorial: CapyTutorial, stepIndex: number): number {
  if (!Number.isFinite(stepIndex) || tutorial.steps.length === 0) return 0;
  return Math.max(0, Math.min(tutorial.steps.length - 1, Math.trunc(stepIndex)));
}

export function stepTutorialState(
  state: ActiveTutorialState | null,
  delta: -1 | 1
): ActiveTutorialState | null {
  if (!state) return null;
  const tutorial = getTutorialById(state.tutorialId);
  if (!tutorial || tutorial.steps.length === 0) return null;
  const nextIndex = state.stepIndex + delta;
  if (nextIndex >= tutorial.steps.length) {
    return null;
  }
  return {
    tutorialId: tutorial.id,
    stepIndex: Math.max(0, nextIndex),
  };
}
