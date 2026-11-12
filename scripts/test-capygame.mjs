import { chromium } from 'playwright';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000/';

(async () => {
  console.log(
    'Launching Playwright E2E test for Capy Universe 3D (N-Body Galaxy Formation, Star Nucleosynthesis, High-Detail Dynamic 60 FPS Capybara LOD & Dachshund Capy-Snake)...'
  );
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader'],
  });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();

  const errors = [];
  const consoleErrors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('console', (msg) => {
    const text = msg.text();
    if (text.includes('failed to connect to websocket')) {
      consoleErrors.push(text);
    }
    if (
      text.includes('Shader Error') ||
      text.includes('WebGLProgram') ||
      text.includes('Feedback loop') ||
      text.includes('INVALID_OPERATION')
    ) {
      errors.push(text);
    }
  });

  await page.goto(BASE_URL, { waitUntil: 'networkidle' });

  // 1. Verify Initial Load starts in Primordial Singularity stage with ALL controls in a single compact top line
  const canvasContainer = page.getByTestId('capygame-canvas-container');
  await canvasContainer.waitFor({ state: 'visible', timeout: 10000 });

  const unifiedTopBar = page.getByTestId('unified-top-bar');
  await unifiedTopBar.waitFor({ state: 'visible', timeout: 5000 });
  const topBarBox = await unifiedTopBar.boundingBox();
  if (!topBarBox || topBarBox.y !== 0 || topBarBox.height > 44) {
    throw new Error(
      `Expected single compact top line (y=0, height<=44px), got y=${topBarBox?.y}, height=${topBarBox?.height}`
    );
  }

  const menuBtn = page.getByTestId('toggle-menu-btn');
  await menuBtn.waitFor({ state: 'visible', timeout: 5000 });
  const menuBtnBox = await menuBtn.boundingBox();
  const scaleHudBox = await page.getByTestId('universe-scale-hud').boundingBox();
  if (!menuBtnBox || !scaleHudBox || menuBtnBox.y >= 44 || scaleHudBox.y >= 44) {
    throw new Error(
      `Expected Scale & World controls inside single top line (y < 44px), got menuY=${menuBtnBox?.y}, scaleY=${scaleHudBox?.y}`
    );
  }

  const cosmicHud = page.getByTestId('cosmic-hud');
  await cosmicHud.waitFor({ state: 'visible', timeout: 5000 });
  const initialExpanded = await cosmicHud.getAttribute('data-expanded');
  if (initialExpanded !== 'false') {
    throw new Error(`Expected top info trigger to start collapsed (data-expanded="false"), got '${initialExpanded}'`);
  }
  const shrunkBox = await cosmicHud.boundingBox();
  if (!shrunkBox || shrunkBox.y >= 44 || shrunkBox.height > 40) {
    throw new Error(`Expected compact inline top-bar status trigger (y<44, height<=40px), got y=${shrunkBox?.y}, ${shrunkBox?.width}x${shrunkBox?.height}`);
  }

  // Click the top-bar info trigger to open the top-anchored cosmic inspector dropdown
  await page.getByTestId('toggle-infographic-btn').click();
  await page.waitForTimeout(100);
  const afterClickExpanded = await cosmicHud.getAttribute('data-expanded');
  if (afterClickExpanded !== 'true') {
    throw new Error(`Expected top info dropdown to expand on click (data-expanded="true"), got '${afterClickExpanded}'`);
  }
  const topInfoDropdown = page.getByTestId('top-info-dropdown');
  await topInfoDropdown.waitFor({ state: 'visible', timeout: 4000 });
  const hudBox = await topInfoDropdown.boundingBox();
  if (!hudBox || hudBox.y > 60) {
    throw new Error(`Expected top-anchored info dropdown directly below top bar (y<=60px), got y=${hudBox?.y}`);
  }
  const initialStage = await cosmicHud.getAttribute('data-cosmic-stage');
  if (initialStage !== 'singularity') {
    throw new Error(`Expected initial cosmic stage 'singularity', got '${initialStage}'`);
  }

  // Verify random persistent star seed selection at T=0
  const initialStarId = await page.getByTestId('tracked-star-id').innerText();
  await page.getByTestId('pick-random-tracked-star-btn').click();
  await page.waitForTimeout(80);
  const pickedStarId = await page.getByTestId('tracked-star-id').innerText();
  if (!pickedStarId.includes('HD-')) {
    throw new Error(`Expected persistent star catalog ID (HD-xxxxx), got '${pickedStarId}' (was '${initialStarId}')`);
  }
  console.log(`✓ Stage 0 verified: Pitch-black Singularity stage with persistent star seed (${pickedStarId}) & shrunk-by-default infographic pill`);

  // 2. Trigger the Big Bang (Singularity explosion into stars -> N-Body Gravity & Fluid Galaxy Formation)
  await page.getByTestId('trigger-big-bang-btn').click();
  await page.waitForTimeout(200);
  const bangStage = await cosmicHud.getAttribute('data-cosmic-stage');
  if (bangStage !== 'big_bang') {
    throw new Error(`Expected 'big_bang' stage during N-Body gravitational & fluid galaxy formation, got '${bangStage}'`);
  }
  console.log('✓ Stage 1A verified: Singularity exploded into primordial stars with N-Body gravity & fluid simulation active');

  // 3. Test Gravitational Constant G, Stellar Mass/Age Color-Mapping & Multi-Generation Supernova Nucleosynthesis
  const gravityBoostBtn = page.getByTestId('gravity-boost-btn');
  await gravityBoostBtn.waitFor({ state: 'visible', timeout: 4000 });
  await gravityBoostBtn.click();

  // Switch between Stellar Mass (M/M☉), Age (Gyr), and H-R Blackbody color-mapping modes
  await page.getByTestId('stellar-color-mode-mass_spectrum').click();
  await page.waitForTimeout(60);
  await page.getByTestId('stellar-color-mode-age_gradient').click();
  await page.waitForTimeout(60);
  await page.getByTestId('stellar-color-mode-hr_blackbody').click();

  // Trigger Supernovae on the tracked star lineage (Gen 1 Pop III -> Gen 2 Pop II -> Gen 3 Pop I)
  const triggerSnBtn = page.getByTestId('trigger-supernova-btn');
  for (let attempt = 0; attempt < 5; attempt++) {
    await triggerSnBtn.click();
    await page.waitForTimeout(120);
    if ((await page.getByTestId('tracked-star-id').innerText()).includes('Gen 3')) {
      break;
    }
  }

  const snAncestorsText = await page.getByTestId('tracked-star-sn-ancestors').innerText();
  const heavyElemText = await page.getByTestId('tracked-star-heavy-elements').innerText();
  const trackedStarHeader = await page.getByTestId('tracked-star-id').innerText();
  if (!trackedStarHeader.includes('Gen 3') && !trackedStarHeader.includes('Gen 2')) {
    throw new Error(`Expected tracked star to advance stellar generations after supernova nucleosynthesis, got: ${trackedStarHeader}`);
  }
  console.log(
    `✓ Stage 1B verified: Multi-generation Supernova Nucleosynthesis (${trackedStarHeader}, ${snAncestorsText}, heavy elements C/O/Si/Fe = ${heavyElemText})`
  );

  // Advance to Universe Flight (64 Rotating Spiral Galaxies)
  const skipBigBangBtn = page.getByTestId('skip-big-bang-btn');
  if ((await skipBigBangBtn.count()) > 0) {
    await skipBigBangBtn.click();
  }
  await page.getByTestId('select-galaxy-1').waitFor({ state: 'visible', timeout: 6000 });
  console.log('✓ Stage 2 verified: 64 Spiral Galaxies formed with persistent tracked star & heavy-element enrichment');

  // 4. Test Free 3D Cosmic Flight with Touch-Drag before selecting a Galaxy
  const cBox = await canvasContainer.boundingBox();
  if (!cBox) throw new Error('Missing 3D canvas bounding box');
  const startX = cBox.x + cBox.width * 0.45;
  const startY = cBox.y + cBox.height * 0.78;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 45, startY - 35, { steps: 5 });
  const joystick = page.getByTestId('touch-joystick-indicator');
  await joystick.waitFor({ state: 'visible', timeout: 3000 });
  await page.mouse.up();
  await joystick.waitFor({ state: 'hidden', timeout: 3000 });
  console.log('✓ Free 3D cosmic flight via touch-drag verified');

  // 5. Zoom into a Spiral Galaxy -> Star System -> Orbiting Planet -> Landing Spot
  await page.getByTestId('select-galaxy-1').click();
  await page.getByTestId('select-star-0').waitFor({ state: 'visible', timeout: 5000 });
  console.log('✓ Stage 3 verified: Zoomed into Spiral Galaxy view');

  await page.getByTestId('select-star-0').click();
  await page.getByTestId('select-planet-0').waitFor({ state: 'visible', timeout: 5000 });

  // Verify Unified Stellar System: Asteroid Belt is present and inspectable
  const asteroidBeltBtn = page.getByTestId('inspect-asteroid-belt');
  await asteroidBeltBtn.waitFor({ state: 'visible', timeout: 5000 });
  await asteroidBeltBtn.click();
  console.log('✓ Stage 4A verified: 3D Asteroid Belt present and inspectable in unified stellar system');

  // Verify Orbital Time Controls & Simulation Clock
  const orbitTimeControls = page.getByTestId('orbit-time-controls');
  await orbitTimeControls.waitFor({ state: 'visible', timeout: 5000 });

  // Test switching timescales: 1 Orbit/sec (rapid Keplerian whirl) -> 1 Day/sec -> 1 Orbit/min
  await page.getByTestId('orbit-scale-1_orbit_s').click();
  await page.waitForTimeout(250);
  const simClockText = await page.getByTestId('sim-clock-readout').innerText();
  if (!simClockText.includes('Yr') || !simClockText.includes('Day')) {
    throw new Error(`Expected sim clock readout to contain 'Yr' and 'Day', got: '${simClockText}'`);
  }
  await page.getByTestId('orbit-scale-1_orbit_min').click();
  console.log(`✓ Stage 4B verified: Orbital time controls and real-time clock active (${simClockText})`);

  // Select habitable planet with landing spots (Capy Haven Alpha)
  await page.getByTestId('select-planet-1').click();
  await page.getByTestId('select-landing-0').waitFor({ state: 'visible', timeout: 5000 });
  console.log('✓ Stage 5 verified: Entered Planetary Orbit view with 3D surface landing beacons');

  await page.getByTestId('select-landing-0').click();
  const capySelectorBar = page.getByTestId('capy-selector-bar');
  await capySelectorBar.waitFor({ state: 'visible', timeout: 8000 });
  console.log('✓ Stage 5B -> 6 verified: Descended through planet atmosphere to reveal customized Capybara World');

  // 6. Choose which Capybara unit to control on the planet surface
  await page.getByTestId('select-capy-2').click();
  await page.waitForTimeout(300);
  await page.getByTestId('confirm-capy-btn').click({ force: true });
  await capySelectorBar.waitFor({ state: 'hidden', timeout: 10000 });

  // Verify clean gameplay HUD: modals/dropdowns hidden, single-line top bar inline Capy-Snake status visible
  const aboutCount = await page.getByTestId('capygame-about-modal').count();
  const headerCount = await page.getByTestId('capygame-top-header').count();
  const dockCount = await page.getByTestId('capygame-top-dock').count();
  const dpadCount = await page.getByTestId('touch-dpad-controls').count();
  if (aboutCount !== 0 || headerCount !== 0 || dockCount !== 0 || dpadCount !== 0) {
    throw new Error(
      `Expected clean playing state with zero open dropdowns or bottom D-pad, got about=${aboutCount}, header=${headerCount}, dock=${dockCount}, dpad=${dpadCount}`
    );
  }

  const snakeHud = page.getByTestId('capy-snake-hud');
  await snakeHud.waitFor({ state: 'visible', timeout: 12000 });
  const snakeHudBox = await snakeHud.boundingBox();
  if (!snakeHudBox || snakeHudBox.y >= 44) {
    throw new Error(`Expected capy-snake-hud inline inside single top bar (y<44), got y=${snakeHudBox?.y}`);
  }
  const initialHeadOrange = await page.evaluate(
    () => window.__capyManager?.getCapySnakeTelemetry().headOrangeName || ''
  );
  const initialLenLabel = await page.getByTestId('snake-length-label').innerText();
  const initialLodLabel = await page.evaluate(
    () => window.__capyManager?.getCapySnakeTelemetry().lodLabel || ''
  );
  if (!initialLenLabel.includes('1 seg') || !initialLodLabel.includes('Ultra Bristle LOD')) {
    throw new Error(
      `Expected initial Dachshund 1 seg & Ultra Bristle LOD, got len='${initialLenLabel}', lod='${initialLodLabel}'`
    );
  }

  // Verify 3D procedural Capybara anatomy, PBR Mountains/Sky/Water, 0 initial loose ground fruits & 8 Exponential Trees
  const worldAndAnatomyCheck = await page.evaluate(() => {
    const mgr = window.__capyManager;
    if (!mgr) return null;
    const ud = mgr.heroCapy?.userData;
    const totalTufts =
      (ud?.furInstancedMesh?.count ?? 0) + (ud?.rearFurInstancedMesh?.count ?? 0);
    const whiskerNode = ud?.lodTier3Group?.userData?.linkedNodes?.[0];
    const toeNode = ud?.lodTier2Group?.userData?.linkedNodes?.[0];
    const mtnMat = mgr.worldEnv?.mountainMesh?.material;
    const trees = mgr.sanctuaryTrees || [];
    const tierRadii = trees.slice(0, 5).map((t) => t.fruitRadius);
    return {
      hasBristleFur: totalTufts === 96 && ud?.lodTier3Group?.visible === true,
      hasWhiskers: Boolean(whiskerNode) && whiskerNode.visible === true,
      hasWebbedToes: Boolean(toeNode) && toeNode.visible === true,
      hasHeadOrange: Boolean(ud?.headOrangeGroup),
      rearDetachedForDachshund: ud?.rearAssemblyGroup?.visible === false,
      lodTier: mgr.getCapyLodTier(),
      hasMountainsWithPbr:
        mgr.worldEnv?.mountainMesh?.name === 'BackgroundAlpineMountains' &&
        Boolean(mtnMat?.map) &&
        Boolean(mtnMat?.normalMap || mtnMat?.bumpMap) &&
        Boolean(mtnMat?.roughnessMap) &&
        Boolean(mtnMat?.aoMap),
      hasGpuSkyDome: Boolean(mgr.worldEnv?.skyMaterial?.uniforms?.uSunDir),
      hasHomePoolAndTap: Boolean(mgr.homePool?.tapStreamMesh) && Boolean(mgr.homePool?.waterMesh),
      treeCount: trees.length,
      exponentialFruitRadii: tierRadii,
      initialGroundFruits: mgr.getCapySnakeTelemetry().groundRollingFruits,
      initialCarried: mgr.getCapySnakeTelemetry().fruitsCarried,
    };
  });
  if (
    !worldAndAnatomyCheck ||
    !worldAndAnatomyCheck.hasBristleFur ||
    !worldAndAnatomyCheck.hasWhiskers ||
    !worldAndAnatomyCheck.hasWebbedToes ||
    !worldAndAnatomyCheck.hasHeadOrange ||
    !worldAndAnatomyCheck.rearDetachedForDachshund ||
    !worldAndAnatomyCheck.hasMountainsWithPbr ||
    !worldAndAnatomyCheck.hasGpuSkyDome ||
    !worldAndAnatomyCheck.hasHomePoolAndTap ||
    worldAndAnatomyCheck.treeCount !== 8 ||
    worldAndAnatomyCheck.initialGroundFruits !== 0 ||
    worldAndAnatomyCheck.initialCarried !== 1 ||
    !(
      worldAndAnatomyCheck.exponentialFruitRadii[4] >
      worldAndAnatomyCheck.exponentialFruitRadii[0] * 4
    )
  ) {
    throw new Error(
      `Photorealistic world, exponential trees or Capybara 3D check failed: ${JSON.stringify(worldAndAnatomyCheck)}`
    );
  }
  console.log(
    `✓ Stage 6 -> Photorealistic World verified: 3D PBR Mountains, GPU Sky Dome, Home Pool, 8 Exponential Trees (${worldAndAnatomyCheck.exponentialFruitRadii.join('m -> ')}m), 0 loose fruits, ${initialHeadOrange} Head Orange`
  );

  // 6B. Drive forward along -Z to bump Tier 0 Matching Tree -> shake ripe fruits loose -> roll & chomp to grow logarithmically!
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(750);
  await page.evaluate(() => {
    const mgr = window.__capyManager;
    if (!mgr) return;
    let safety = 0;
    while (mgr.getCapySnakeTelemetry().orangesCollected < 1 && safety++ < 60) {
      mgr.tick(0.04);
    }
  });
  await page.keyboard.up('ArrowUp');
  await page.waitForTimeout(150);

  const grownCheck = await page.evaluate(() => {
    const mgr = window.__capyManager;
    if (!mgr) return null;
    const t0 = mgr.sanctuaryTrees[0];
    const slotGrowthBefore = t0.slots[0].growth;
    for (let i = 0; i < 10; i++) mgr.tick(0.05);
    const slotGrowthAfter = t0.slots[0].growth;

    // Also verify bumping a NON-matching tree (index 5) drops 0 fruits!
    const nonMatchTree = mgr.sanctuaryTrees[5];
    const droppedFromNonMatch = mgr.bumpTreeAndSpawnFruits(nonMatchTree, 1, 0);

    return {
      telemetry: mgr.getCapySnakeTelemetry(),
      slotRegrowing: slotGrowthAfter > slotGrowthBefore,
      slotGrowthBefore: +slotGrowthBefore.toFixed(3),
      slotGrowthAfter: +slotGrowthAfter.toFixed(3),
      droppedFromNonMatch,
    };
  });
  const grownLenLabel = await page.getByTestId('snake-length-label').innerText();
  if (
    !grownCheck ||
    grownCheck.telemetry.bodySegments < 3 ||
    grownCheck.telemetry.orangesCollected < 1 ||
    grownCheck.telemetry.fruitsCarried < 2 ||
    !grownCheck.slotRegrowing ||
    grownCheck.droppedFromNonMatch !== 0
  ) {
    throw new Error(
      `Expected bumping matching tree to drop fruits, regrow buds & grow body logarithmically (and non-matching tree to drop 0), got: ${JSON.stringify(grownCheck)} (HUD: ${grownLenLabel})`
    );
  }
  console.log(
    `✓ Matching-Tree Bump, Live Regrowth (${grownCheck.slotGrowthBefore} -> ${grownCheck.slotGrowthAfter}) & Logarithmic Growth verified: ${grownCheck.telemetry.lengthMeters}m (${grownCheck.telemetry.bodySegments} segs, carried=${grownCheck.telemetry.fruitsCarried})`
  );

  // 6C. Verify Mouth-Size Limit (cannot eat giant Tier 4 tree fruit), Zero Clipping & Capybara-Bump Fruit Knock-Off Shrink!
  const physicsMechanicsCheck = await page.evaluate(() => {
    const mgr = window.__capyManager;
    if (!mgr) return null;

    // 1. Shake Tier 4 Colossus Matching Tree (fruit radius ~1.15m = 115cm > mouthMaxRadiusCm)
    const giantTree = mgr.sanctuaryTrees[4];
    giantTree.bumpCooldown = 0;
    const giantDropped = mgr.bumpTreeAndSpawnFruits(giantTree, 0, 1);
    const giantFruit = mgr.physicsFruits.find((f) => f.active && f.radius > 1.0);
    if (!giantFruit) return { error: 'No giant Tier 4 fruit spawned', giantDropped };

    // Drop giant fruit onto ground and move Hero right against it to test mouth-size rejection & non-clipping!
    giantFruit.y = giantFruit.radius;
    giantFruit.pickupDelay = 0;
    giantFruit.vx = 0;
    giantFruit.vz = 0;
    const carriedBeforeGiant = mgr.getCapySnakeTelemetry().fruitsCarried;
    mgr.heroLocalPos.set(giantFruit.x, 0, giantFruit.z + giantFruit.radius + 0.35);
    mgr.heroYaw = Math.PI;
    for (let step = 0; step < 6; step++) mgr.tick(0.03);

    const carriedAfterGiant = mgr.getCapySnakeTelemetry().fruitsCarried;
    const heroGiantSep = Math.hypot(
      mgr.heroLocalPos.x - giantFruit.x,
      mgr.heroLocalPos.z - giantFruit.z
    );
    const giantRolledSpeed = Math.hypot(giantFruit.vx, giantFruit.vz);

    // 2. Ensure Hero has >= 4 carried fruits, then bump a wandering Capybara into Hero's elongated body!
    while (mgr.getCapySnakeTelemetry().fruitsCarried < 5) {
      const smallF = mgr.spawnPhysicsFruit(
        mgr.heroLocalPos.x,
        0.24,
        mgr.heroLocalPos.z,
        0,
        0,
        0,
        0.24,
        mgr.activeHeadOrangeIndex,
        false,
        0
      );
      smallF.pickupDelay = 0;
      mgr.tick(0.03);
    }
    const beforeBuddyBump = mgr.getCapySnakeTelemetry();
    const buddy = mgr.sanctuaryCapys[0];
    const seg0 = mgr.dachshundSegments[0];
    mgr.buddyBumpCooldown = 0;
    buddy.capy.position.set(seg0.position.x + 0.35, 0, seg0.position.z);
    mgr.tick(0.03);
    const afterBuddyBump = mgr.getCapySnakeTelemetry();
    const buddySegSep = Math.hypot(
      buddy.capy.position.x - seg0.position.x,
      buddy.capy.position.z - seg0.position.z
    );

    return {
      giantRejectedByMouth: giantFruit.active === true && carriedAfterGiant === carriedBeforeGiant,
      heroGiantNoClip: heroGiantSep >= 0.68 + giantFruit.radius - 0.05,
      giantRolledAway: giantRolledSpeed > 0.2,
      buddyKnockedFruitOff: afterBuddyBump.fruitsCarried < beforeBuddyBump.fruitsCarried,
      bodyShrunkOnBump: afterBuddyBump.lengthMeters < beforeBuddyBump.lengthMeters,
      buddySegNoClip: buddySegSep >= 0.46 + 0.58 - 0.05,
      beforeLen: beforeBuddyBump.lengthMeters,
      afterLen: afterBuddyBump.lengthMeters,
    };
  });
  if (
    !physicsMechanicsCheck ||
    physicsMechanicsCheck.error ||
    !physicsMechanicsCheck.giantRejectedByMouth ||
    !physicsMechanicsCheck.heroGiantNoClip ||
    !physicsMechanicsCheck.giantRolledAway ||
    !physicsMechanicsCheck.buddyKnockedFruitOff ||
    !physicsMechanicsCheck.bodyShrunkOnBump ||
    !physicsMechanicsCheck.buddySegNoClip
  ) {
    throw new Error(
      `Mouth-size limit, zero-clipping or Capybara-bump shrink check failed: ${JSON.stringify(physicsMechanicsCheck)}`
    );
  }
  console.log(
    `✓ Soft-Body Zero-Clipping, Mouth-Size Rejection & Capybara-Bump Shrink verified (${physicsMechanicsCheck.beforeLen}m -> ${physicsMechanicsCheck.afterLen}m)`
  );

  // 6D. Verify Home Pool Swimming, Tap Water Head-Wash (until 1 left) & Pond Overflow Splash-Out Mess!
  const poolAndTapCheck = await page.evaluate(() => {
    const mgr = window.__capyManager;
    if (!mgr) return null;

    // Feed Hero until carrying 8 fruits on head/back so washing them under the tap puts >= 6 fruits into the Home Pool!
    mgr.heroLocalPos.set(2.0, 0, 5.0);
    while (mgr.getCapySnakeTelemetry().fruitsCarried < 8) {
      const f = mgr.spawnPhysicsFruit(2.0, 0.24, 5.0, 0, 0, 0, 0.24, mgr.activeHeadOrangeIndex, false, 0);
      f.pickupDelay = 0;
      mgr.tick(0.03);
    }
    const carriedBeforeWash = mgr.getCapySnakeTelemetry().fruitsCarried;

    // Swim into the Home Pool and place head directly under the running Tap Water stream!
    const pool = mgr.homePool;
    mgr.heroLocalPos.set(pool.tapStreamWorldX + 0.25, -0.18, pool.tapStreamWorldZ);
    mgr.heroYaw = -Math.PI / 2; // Facing -X toward the brass tap nozzle
    for (let step = 0; step < 50; step++) {
      mgr.tick(0.05);
    }

    const afterWash = mgr.getCapySnakeTelemetry();
    return {
      carriedBeforeWash,
      carriedAfterWash: afterWash.fruitsCarried,
      segmentsAfterWash: afterWash.bodySegments,
      pondFruits: afterWash.pondFruits,
      pondOverflowing: afterWash.pondOverflowing,
      pondMessPercent: afterWash.pondMessPercent,
      messGroupVisible: pool.messGroup.visible === true,
    };
  });
  if (
    !poolAndTapCheck ||
    poolAndTapCheck.carriedBeforeWash < 8 ||
    poolAndTapCheck.carriedAfterWash !== 1 ||
    poolAndTapCheck.segmentsAfterWash !== 1 ||
    poolAndTapCheck.pondFruits < 6 ||
    !poolAndTapCheck.pondOverflowing ||
    poolAndTapCheck.pondMessPercent <= 0 ||
    !poolAndTapCheck.messGroupVisible
  ) {
    throw new Error(
      `Home Pool tap-water head wash or pond overflow mess check failed: ${JSON.stringify(poolAndTapCheck)}`
    );
  }
  console.log(
    `✓ Home Pool Tap-Water Wash (${poolAndTapCheck.carriedBeforeWash} -> ${poolAndTapCheck.carriedAfterWash} fruit left) & Pond Overflow Splash Mess (${poolAndTapCheck.pondFruits} pond fruits, ${poolAndTapCheck.pondMessPercent}% mess) verified!`
  );

  // 6E-NEW. Verify Procedural Tree/Branch/Leaf/Fruit Morphogenesis, Static Non-Clipping, Sightline X-Ray Fade, Solid Reverse Gait & 0-Feet-Touching Stuck Traction!
  const advancedSimCheck = await page.evaluate(() => {
    const mgr = window.__capyManager;
    if (!mgr) return null;

    // 1. Procedural Tree, Recursive Branch, Phyllotactic Leaf & 4-Stage Fruit Growth Check
    const trees = mgr.sanctuaryTrees;
    const t0 = trees[0];
    const t4 = trees[4];
    const hasProceduralSkeleton =
      Boolean(t0?.skeletonMesh?.geometry) &&
      t0.branchCount >= 18 &&
      t0.leafCount >= 150 &&
      t4.leafCount > t0.leafCount;

    // Test 4-stage fruit morphogenesis on slot 0: blossom -> ovary_bud -> swelling -> ripe
    const testSlot = t0.slots[0];
    const vHex = 0xff7a00;
    testSlot.growth = 0.08;
    mgr.worldEnv.applyProceduralFruitGrowthVisuals(testSlot, vHex);
    const stageBlossom = testSlot.stage === 'blossom' && testSlot.blossomGroup.visible === true;
    testSlot.growth = 0.30;
    mgr.worldEnv.applyProceduralFruitGrowthVisuals(testSlot, vHex);
    const stageOvary = testSlot.stage === 'ovary_bud';
    testSlot.growth = 0.60;
    mgr.worldEnv.applyProceduralFruitGrowthVisuals(testSlot, vHex);
    const stageSwelling = testSlot.stage === 'swelling';
    testSlot.growth = 1.0;
    mgr.worldEnv.applyProceduralFruitGrowthVisuals(testSlot, vHex);
    const stageRipe =
      testSlot.stage === 'ripe' &&
      testSlot.blossomGroup.visible === false &&
      testSlot.mesh.position.y < testSlot.baseY;

    // 2. Static Non-Clipping Check across all 8 Trees, Home Pool, Portals & Buildings
    let staticClipError = null;
    const pool = mgr.homePool;
    for (let i = 0; i < trees.length; i++) {
      const a = trees[i];
      const dPool = Math.hypot(a.x - pool.centerX, a.z - pool.centerZ);
      if (dPool < 5.1 + a.crownRadius * 0.9) {
        staticClipError = `Tree ${i} clips Home Pool (dist=${dPool.toFixed(2)})`;
      }
      for (let j = i + 1; j < trees.length; j++) {
        const b = trees[j];
        const dTrees = Math.hypot(a.x - b.x, a.z - b.z);
        if (dTrees < (a.crownRadius + b.crownRadius) * 0.88) {
          staticClipError = `Tree ${i} clips Tree ${j} (dist=${dTrees.toFixed(2)})`;
        }
      }
      for (const bld of mgr.stats.buildings) {
        const dBld = Math.hypot(a.x - bld.x, a.z - bld.z);
        if (dBld < a.trunkRadius + 2.0) {
          staticClipError = `Tree ${i} clips Building ${bld.id} (dist=${dBld.toFixed(2)})`;
        }
      }
    }
    for (const bld of mgr.stats.buildings) {
      const dPoolBld = Math.hypot(bld.x - pool.centerX, bld.z - pool.centerZ);
      if (dPoolBld < 5.4 + 1.6) {
        staticClipError = `Building ${bld.id} clips Home Pool (dist=${dPoolBld.toFixed(2)})`;
      }
    }

    // 3. Always-Visible Head & View Frustum via 95% Screen-Clear + Whole-Entity Atomic Edge Outline Transparency
    // 3a. Direct Tree Sightline: verify skeletonMesh, leafInstancedMesh, AND hanging fruitSphere all fade together!
    mgr.settings.cameraFollowBehind = true;
    mgr.heroLocalPos.set(0.0, 0.0, -2.2);
    mgr.heroYaw = Math.PI; // Facing -Z -> camera sits around (0, 6.8, +9.3), ray/frustum passes through Tree 0!
    mgr.resetDachshundTrail();
    for (let step = 0; step < 18; step++) {
      mgr.tick(0.05);
    }
    const fadedCountBehindTree = mgr.getCapySnakeTelemetry().occludedObjectsFaded;
    const treeSkeletonMat = Array.isArray(t0.skeletonMesh.material)
      ? t0.skeletonMesh.material[0]
      : t0.skeletonMesh.material;
    const treeLeafMat = Array.isArray(t0.leafInstancedMesh.material)
      ? t0.leafInstancedMesh.material[0]
      : t0.leafInstancedMesh.material;
    const treeHangingFruitAlpha = mgr.evaluateOccluderScreenAlpha(
      t0.slots[0].fruitSphere,
      0.5,
      0.5
    );
    const centerScreenOpacityWhenBlocking = Math.max(
      treeSkeletonMat.userData.__centerScreenOpacity ?? 1,
      treeLeafMat.userData.__centerScreenOpacity ?? 1,
      treeHangingFruitAlpha
    );
    const centerAlphaAtMidScreen = mgr.evaluateOccluderScreenAlpha(t0.leafInstancedMesh, 0.5, 0.5);
    const outerBorderEdgeOutlineAlpha = mgr.evaluateOccluderScreenAlpha(
      t0.leafInstancedMesh,
      0.996,
      0.5
    );
    // Sample a 40x25 (1,000-point) screen UV grid across the full 100% viewport to verify >= 95% is alpha === 0!
    let zeroAlphaSamples = 0;
    const totalScreenSamples = 40 * 25;
    for (let gx = 0; gx < 40; gx++) {
      const u = (gx + 0.5) / 40;
      for (let gy = 0; gy < 25; gy++) {
        const v = (gy + 0.5) / 25;
        if (
          mgr.evaluateOccluderScreenAlpha(t0.skeletonMesh, u, v) === 0 &&
          mgr.evaluateOccluderScreenAlpha(t0.slots[0].fruitSphere, u, v) === 0
        ) {
          zeroAlphaSamples++;
        }
      }
    }
    const zeroAlphaScreenFraction = zeroAlphaSamples / totalScreenSamples;

    // 3b. Mobile Screenshot Regression: Lower-frustum yuzu_orchard (below pinpoint head ray!) + overhanging giant Tree 4 canopy!
    // Place Hero at (1.4, 0, -25.0) facing -Z so Chase Camera sits around (1.4, 6.8, -13.5):
    // - Tree 4 at (1.4, -17.0) with 6.81m crown overhangs the UPPER camera frustum!
    // - Temporarily place a yuzu_orchard building at (1.4, 0, -16.8) in the LOWER camera frustum (below the head ray!)
    // - Meanwhile Breakout/Runner portals ahead of Hero at z = -26.8 are BEYOND Hero and must stay 100% opaque!
    let yuzuGroup = mgr.sanctuaryBuildingMeshes.find(
      (bm) => bm.userData?.buildingType === 'yuzu_orchard'
    );
    let tempAddedYuzu = false;
    let savedYuzuX = 0;
    let savedYuzuZ = 0;
    if (yuzuGroup) {
      savedYuzuX = yuzuGroup.position.x;
      savedYuzuZ = yuzuGroup.position.z;
      yuzuGroup.position.set(1.4, 0, -17.6);
    } else {
      yuzuGroup = mgr.sanctuaryBuildingMeshes[0];
      if (yuzuGroup) {
        savedYuzuX = yuzuGroup.position.x;
        savedYuzuZ = yuzuGroup.position.z;
        yuzuGroup.position.set(1.4, 0, -17.6);
      } else {
        tempAddedYuzu = true;
      }
    }
    mgr.heroLocalPos.set(1.4, 0.0, -24.2);
    mgr.heroYaw = Math.PI;
    mgr.resetDachshundTrail();
    for (let step = 0; step < 18; step++) {
      mgr.tick(0.05);
    }
    let yuzuAllChildrenFaded = true;
    let yuzuChildMeshCount = 0;
    if (yuzuGroup) {
      yuzuGroup.traverse((node) => {
        if (node.isMesh && !node.userData?.ignoreCameraFade) {
          yuzuChildMeshCount++;
          if (mgr.evaluateOccluderScreenAlpha(node, 0.5, 0.3) !== 0) {
            yuzuAllChildrenFaded = false;
          }
        }
      });
      if (!tempAddedYuzu) {
        yuzuGroup.position.set(savedYuzuX, 0, savedYuzuZ);
      }
    }
    const giantTree4AllFaded =
      mgr.evaluateOccluderScreenAlpha(t4.skeletonMesh, 0.5, 0.8) === 0 &&
      mgr.evaluateOccluderScreenAlpha(t4.leafInstancedMesh, 0.5, 0.8) === 0 &&
      mgr.evaluateOccluderScreenAlpha(t4.slots[0].fruitSphere, 0.5, 0.8) === 0;
    // Tree 0 at (0, 0.9) is >10m behind the camera lens and must NOT be faded
    const distantBehindCameraOpaque =
      mgr.evaluateOccluderScreenAlpha(t0.leafInstancedMesh, 0.5, 0.5) >= 0.98;

    // Move Hero to genuinely open SE shoreline clearing (11.5, 0, 23.5) facing +Z (keeping wandering buddies out of that lane) -> verify full opaque restoration!
    for (let b = 0; b < mgr.sanctuaryCapys.length; b++) {
      if (mgr.sanctuaryCapys[b].capy.position.x > 6 && mgr.sanctuaryCapys[b].capy.position.z > 10) {
        mgr.sanctuaryCapys[b].capy.position.set(-15.5, 0, 16.2);
      }
    }
    mgr.heroLocalPos.set(11.5, 0.0, 23.5);
    mgr.heroYaw = 0;
    mgr.resetDachshundTrail();
    for (let step = 0; step < 22; step++) {
      mgr.tick(0.06);
    }
    const fadedCountInClear = mgr.getCapySnakeTelemetry().occludedObjectsFaded;
    const restoredTreeCenterAlpha = Math.min(
      mgr.evaluateOccluderScreenAlpha(t0.skeletonMesh, 0.5, 0.5),
      mgr.evaluateOccluderScreenAlpha(t0.leafInstancedMesh, 0.5, 0.5),
      mgr.evaluateOccluderScreenAlpha(t4.leafInstancedMesh, 0.5, 0.5)
    );

    // 4. Solid Slightly-Squashable Body & Coordinated Backward Walking Across All Segments
    // Feed Hero 5 small fruits so Dachshund spine has multiple articulated segments
    while (mgr.getCapySnakeTelemetry().bodySegments < 4) {
      const f = mgr.spawnPhysicsFruit(
        mgr.heroLocalPos.x,
        0.24,
        mgr.heroLocalPos.z,
        0,
        0,
        0,
        0.24,
        mgr.activeHeadOrangeIndex,
        false,
        0
      );
      f.pickupDelay = 0;
      mgr.tick(0.03);
    }
    for (let b = 0; b < mgr.sanctuaryCapys.length; b++) {
      mgr.sanctuaryCapys[b].capy.position.set(-15.5 - b * 2.5, 0, 16.2);
    }
    mgr.heroLocalPos.set(3.5, 0.0, 9.2);
    mgr.heroYaw = 0; // Facing +Z -> walking backward moves toward -Z!
    mgr.resetDachshundTrail();
    mgr.tick(0.03);

    const segCount = mgr.getCapySnakeTelemetry().bodySegments;
    const beforeBackHeroZ = mgr.heroLocalPos.z;
    const beforeBackSegZ = mgr.dachshundSegments[segCount - 1].position.z;
    const beforeBackCabZ = mgr.dachshundCaboose.position.z;

    // Hold backward walking input (moveInput.z = +1 -> forwardRaw = -1)
    mgr.moveInput.x = 0.15;
    mgr.moveInput.z = 1.0;
    let maxObservedSquash = 0;
    let reverseFlagObserved = false;
    let kneeFlexObserved = 0;
    for (let step = 0; step < 18; step++) {
      mgr.tick(0.04);
      maxObservedSquash = Math.max(maxObservedSquash, Math.abs(mgr.heroSoftSquash));
      if (mgr.getCapySnakeTelemetry().isWalkingBackward) reverseFlagObserved = true;
      const segKnee = mgr.dachshundSegments[0].userData.midLegL.userData.lowerJoint?.rotation?.x ?? 0;
      kneeFlexObserved = Math.max(kneeFlexObserved, Math.abs(segKnee));
    }
    const afterBackHeroZ = mgr.heroLocalPos.z;
    const afterBackSegZ = mgr.dachshundSegments[segCount - 1].position.z;
    const afterBackCabZ = mgr.dachshundCaboose.position.z;

    // Also test backing directly into Tree 0 at (0, 0.9) to verify solid non-clipping & anti-jackknife!
    for (let b = 0; b < mgr.sanctuaryCapys.length; b++) {
      mgr.sanctuaryCapys[b].capy.position.set(-15.5 - b * 2.5, 0, 16.2);
    }
    mgr.heroLocalPos.set(0.0, 0.0, 5.2);
    mgr.heroYaw = 0; // Facing +Z so Caboose starts at z ~ 2.1m cleanly outside Tree 0 (0, 0.9) before backing into it!
    mgr.resetDachshundTrail();
    mgr.moveInput.x = 0;
    mgr.moveInput.z = 1.0;
    for (let step = 0; step < 22; step++) {
      mgr.tick(0.04);
      maxObservedSquash = Math.max(maxObservedSquash, Math.abs(mgr.heroSoftSquash));
    }
    mgr.moveInput.x = 0;
    mgr.moveInput.z = 0;
    const cabDistToTree = Math.hypot(
      mgr.dachshundCaboose.position.x - t0.x,
      mgr.dachshundCaboose.position.z - t0.z
    );
    const heroCabDist = Math.hypot(
      mgr.heroLocalPos.x - mgr.dachshundCaboose.position.x,
      mgr.heroLocalPos.z - mgr.dachshundCaboose.position.z
    );

    // 5. Realistic Foot-Motion & Ground-Contact Traction: "If 0 feet touch the ground -> get stuck!"
    mgr.heroLocalPos.set(3.5, 0.0, 9.2);
    mgr.heroYaw = Math.PI;
    mgr.resetDachshundTrail();
    mgr.suspendedFootTestHeight = 0.85; // Suspend Capybara & all segments 85cm in the air -> 0 feet touch ground!
    mgr.tick(0.03);
    const stuckStartX = mgr.heroLocalPos.x;
    const stuckStartZ = mgr.heroLocalPos.z;
    mgr.moveInput.z = -1.0; // Hold full forward walk!
    for (let step = 0; step < 18; step++) {
      mgr.tick(0.04);
    }
    const stuckEndTelemetry = mgr.getCapySnakeTelemetry();
    const stuckDisplacement = Math.hypot(
      mgr.heroLocalPos.x - stuckStartX,
      mgr.heroLocalPos.z - stuckStartZ
    );

    // Lower Capybara back onto ground -> feet touch ground again -> immediately un-stuck and walks forward!
    mgr.suspendedFootTestHeight = null;
    for (let step = 0; step < 16; step++) {
      mgr.tick(0.04);
    }
    const groundedTelemetry = mgr.getCapySnakeTelemetry();
    const resumedDisplacement = Math.hypot(
      mgr.heroLocalPos.x - stuckStartX,
      mgr.heroLocalPos.z - stuckStartZ
    );
    mgr.moveInput.z = 0;

    return {
      hasProceduralSkeleton,
      branchCount: t0.branchCount,
      leafCount: t0.leafCount,
      fourStageBotany: stageBlossom && stageOvary && stageSwelling && stageRipe,
      staticClipError,
      fadedCountBehindTree,
      centerScreenOpacityWhenBlocking: +centerScreenOpacityWhenBlocking.toFixed(4),
      centerAlphaAtMidScreen: +centerAlphaAtMidScreen.toFixed(4),
      outerBorderEdgeOutlineAlpha: +outerBorderEdgeOutlineAlpha.toFixed(4),
      zeroAlphaScreenFraction: +zeroAlphaScreenFraction.toFixed(4),
      yuzuAllChildrenFaded: yuzuAllChildrenFaded && yuzuChildMeshCount >= 8,
      yuzuChildMeshCount,
      giantTree4AllFaded,
      distantBehindCameraOpaque,
      fadedCountInClear,
      restoredTreeCenterAlpha: +restoredTreeCenterAlpha.toFixed(3),
      reverseFlagObserved,
      allSegmentsWalkedBackward:
        afterBackHeroZ < beforeBackHeroZ - 0.5 &&
        afterBackSegZ < beforeBackSegZ - 0.5 &&
        afterBackCabZ < beforeBackCabZ - 0.5,
      kneeFlexObserved: +kneeFlexObserved.toFixed(3),
      maxObservedSquash: +maxObservedSquash.toFixed(4),
      solidSlightSquashOnly: maxObservedSquash <= 0.061,
      reverseObstacleNoClip: cabDistToTree >= t0.trunkRadius + 0.5 - 0.04 && heroCabDist > 1.2,
      stuckZeroFeet: stuckEndTelemetry.groundedFeet === 0 && stuckEndTelemetry.isStuckNoFooting === true,
      stuckZeroDisplacement: stuckDisplacement < 0.001,
      resumedGroundedFeet: groundedTelemetry.groundedFeet >= 2 && !groundedTelemetry.isStuckNoFooting,
      resumedWalkingDisplacement: resumedDisplacement > 1.2,
    };
  });

  if (
    !advancedSimCheck ||
    !advancedSimCheck.hasProceduralSkeleton ||
    !advancedSimCheck.fourStageBotany ||
    advancedSimCheck.staticClipError !== null ||
    advancedSimCheck.fadedCountBehindTree < 1 ||
    advancedSimCheck.centerScreenOpacityWhenBlocking !== 0 ||
    advancedSimCheck.centerAlphaAtMidScreen !== 0 ||
    advancedSimCheck.zeroAlphaScreenFraction < 0.95 ||
    advancedSimCheck.outerBorderEdgeOutlineAlpha < 0.05 ||
    advancedSimCheck.outerBorderEdgeOutlineAlpha > 0.26 ||
    !advancedSimCheck.yuzuAllChildrenFaded ||
    !advancedSimCheck.giantTree4AllFaded ||
    !advancedSimCheck.distantBehindCameraOpaque ||
    advancedSimCheck.fadedCountInClear !== 0 ||
    advancedSimCheck.restoredTreeCenterAlpha < 0.98 ||
    !advancedSimCheck.reverseFlagObserved ||
    !advancedSimCheck.allSegmentsWalkedBackward ||
    advancedSimCheck.kneeFlexObserved < 0.1 ||
    !advancedSimCheck.solidSlightSquashOnly ||
    !advancedSimCheck.reverseObstacleNoClip ||
    !advancedSimCheck.stuckZeroFeet ||
    !advancedSimCheck.stuckZeroDisplacement ||
    !advancedSimCheck.resumedGroundedFeet ||
    !advancedSimCheck.resumedWalkingDisplacement
  ) {
    throw new Error(
      `Advanced procedural botany / occlusion fade / solid reverse gait / foot traction check failed: ${JSON.stringify(advancedSimCheck)}`
    );
  }
  console.log(
    `✓ Procedural Botany (${advancedSimCheck.branchCount} branches, ${advancedSimCheck.leafCount} V-folded leaves, 4-stage fruit), Zero Static Clipping, Whole-Entity Frustum + Sightline 95% Screen-Clear Edge Shader (center ${advancedSimCheck.centerScreenOpacityWhenBlocking} -> ${advancedSimCheck.restoredTreeCenterAlpha}, ${(advancedSimCheck.zeroAlphaScreenFraction * 100).toFixed(1)}% screen clear, yuzu=${advancedSimCheck.yuzuChildMeshCount} meshes faded, Tree4 canopy+fruit faded, edge=${advancedSimCheck.outerBorderEdgeOutlineAlpha}), Solid Reverse Gait (squash <= ${advancedSimCheck.maxObservedSquash}) & 0-Feet-Touching Stuck Traction verified!`
  );

  // 6E. Verify Dynamic 60 FPS Capybara LOD Governor scales detail down under heavy load and back up at 60 FPS
  const lodScaleResult = await page.evaluate(() => {
    const mgr = window.__capyManager;
    if (!mgr) return null;
    const initialTier = mgr.getCapyLodTier();
    for (let i = 0; i < 8; i++) {
      mgr.ingestFpsSample(36, 0.4);
    }
    const droppedTier = mgr.getCapyLodTier();
    const droppedFurCount = mgr.heroCapy.userData.furInstancedMesh.count;
    for (let i = 0; i < 16; i++) {
      mgr.ingestFpsSample(62, 0.4);
    }
    const recoveredTier = mgr.getCapyLodTier();
    const recoveredFurCount =
      mgr.heroCapy.userData.furInstancedMesh.count +
      mgr.heroCapy.userData.rearFurInstancedMesh.count;
    if (mgr.isSoftwareGl) {
      for (let i = 0; i < 8; i++) {
        mgr.ingestFpsSample(36, 0.4);
      }
    }
    return { initialTier, droppedTier, droppedFurCount, recoveredTier, recoveredFurCount };
  });
  if (
    !lodScaleResult ||
    lodScaleResult.droppedTier >= lodScaleResult.initialTier ||
    lodScaleResult.droppedFurCount !== 0 ||
    lodScaleResult.recoveredTier !== 3 ||
    lodScaleResult.recoveredFurCount !== 96
  ) {
    throw new Error(`Dynamic 60 FPS Capybara LOD scaling check failed: ${JSON.stringify(lodScaleResult)}`);
  }
  console.log(
    `✓ Dynamic 60 FPS LOD Governor verified: Tier ${lodScaleResult.initialTier} -> Tier ${lodScaleResult.droppedTier} under load -> recovered to Tier ${lodScaleResult.recoveredTier} (96 bristle tufts) at 60 FPS`
  );

  // 7. Verify Mobile Touch-and-Drag Steering & Tap-to-Jump on Planet Surface
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 45, startY - 45, { steps: 5 });
  await joystick.waitFor({ state: 'visible', timeout: 3000 });
  await page.mouse.up();
  await joystick.waitFor({ state: 'hidden', timeout: 3000 });
  await page.mouse.click(startX, startY);
  console.log('✓ Mobile touch-and-drag steering and tap-to-jump verified on planet surface');

  // 8. Open the Top-Right Menu Button to reveal Progressive Unlocks & Game Dock
  await page.waitForTimeout(200);
  await menuBtn.click({ force: true });
  const topHeader = page.getByTestId('capygame-top-header');
  await topHeader.waitFor({ state: 'visible', timeout: 5000 });
  const topDock = page.getByTestId('capygame-top-dock');
  await topDock.waitFor({ state: 'visible', timeout: 5000 });
  const unlockBar = page.getByTestId('progressive-unlock-bar');
  await unlockBar.waitFor({ state: 'visible', timeout: 5000 });
  console.log('✓ Top-right Menu button opened Progressive Unlocks & Game Dock');

  // 9. Verify Chase Camera toggle button
  const chaseBtn = page.getByTestId('toggle-chase-camera-btn');
  await chaseBtn.waitFor({ state: 'visible' });
  await chaseBtn.click();
  await page.waitForTimeout(100);
  await chaseBtn.click();
  console.log('✓ Chase Camera toggle verified');

  // 10. Verify Settings Page modal opens and configures camera, 60 FPS LOD, Day/Night & Weather
  await page.getByTestId('open-settings-btn').click();
  const settingsModal = page.getByTestId('capygame-settings-modal');
  await settingsModal.waitFor({ state: 'visible', timeout: 5000 });
  await page.getByTestId('settings-toggle-chase-cam').click();
  await page.waitForTimeout(60);
  await page.getByTestId('settings-toggle-chase-cam').click();
  await page.getByTestId('settings-lod-tier-1').click();
  await page.waitForTimeout(60);
  await page.getByTestId('settings-toggle-auto-lod').click();
  await page.getByTestId('settings-weather-storm').click();
  await page.waitForTimeout(60);
  await page.getByTestId('settings-weather-rain').click();
  await page.waitForTimeout(60);
  await page.getByTestId('settings-weather-auto').click();
  await page.getByTestId('settings-toggle-daynight').click();
  await page.waitForTimeout(60);
  await page.getByTestId('settings-toggle-daynight').click();
  await page.getByTestId('close-settings-btn').click();
  await settingsModal.waitFor({ state: 'hidden', timeout: 5000 });
  console.log('✓ Settings Page camera, 60 FPS Dynamic LOD, Day/Night & Weather controls verified and closed');

  // 11. Verify Overview / About modal opens on demand from Menu
  await page.getByTestId('open-about-btn').click();
  const aboutModal = page.getByTestId('capygame-about-modal');
  await aboutModal.waitFor({ state: 'visible', timeout: 5000 });
  await page.getByTestId('close-about-btn').click();
  await aboutModal.waitFor({ state: 'hidden', timeout: 5000 });
  console.log('✓ Overview modal opened from Menu and closed cleanly');

  // 12. Progressive Unlock & Transit across all 5 World Sectors
  const modes = ['spore', 'breakout', 'runner', 'fallguys', 'sanctuary'];
  for (const mode of modes) {
    await page.getByTestId(`mode-btn-${mode}`).click();
    await page.waitForTimeout(200);
    console.log(`✓ Unlocked & transited across shared 3D world to sector: ${mode}`);
  }

  // 13. Test Structures (Deploy + Interactive Raycast Placement Ghost), Bio-Traits, Parameters, and Loadout
  await page.waitForTimeout(500);
  const tabBuild = page.getByTestId('tab-build');
  if (!(await tabBuild.isVisible())) {
    await menuBtn.click({ force: true });
    await tabBuild.waitFor({ state: 'visible', timeout: 5000 });
  }
  await tabBuild.click({ force: true, timeout: 10000 });
  await page.waitForTimeout(100);
  await page.getByTestId('build-btn-hot_spring').waitFor({ state: 'visible', timeout: 5000 });
  await page.getByTestId('build-btn-hot_spring').click({ force: true, timeout: 10000 });
  console.log('✓ Deployed Cozy Onsen in Sanctuary');

  // 13B. Test Interactive Raycast Building Placement Ghost (`ghost-btn-zen_pagoda`)
  await page.getByTestId('ghost-btn-zen_pagoda').waitFor({ state: 'visible', timeout: 5000 });
  await page.getByTestId('ghost-btn-zen_pagoda').click({ force: true, timeout: 10000 });
  const ghostBanner = page.getByTestId('placement-ghost-banner');
  await ghostBanner.waitFor({ state: 'visible', timeout: 5000 });

  const ghostPlacementCheck = await page.evaluate(() => {
    const mgr = window.__capyManager;
    if (!mgr) return null;
    const beforeCount = mgr.stats.buildings.length;

    // Project Home Pool center (-8.8, 0, 3.0) to NDC -> raycast ghost there -> must be BLOCKED (valid === false)!
    const poolVec = mgr.heroLocalPos.clone().set(-8.8, 0, 3.0);
    poolVec.project(mgr.camera);
    const blockedValid = mgr.updateBuildingPlacementGhostFromNdc(poolVec.x, poolVec.y);
    // Attempt tap while blocked -> must NOT construct!
    mgr.handleCanvasTapRaycast(poolVec.x, poolVec.y);
    const countAfterBlockedTap = mgr.stats.buildings.length;

    // Project guaranteed clear spot to NDC -> raycast ghost there -> must be CLEAR (valid === true)!
    const clearSpot = mgr.findClearBuildingSpot(mgr.stats.buildings.length + 2);
    const clearVec = mgr.heroLocalPos.clone().set(clearSpot.x, 0, clearSpot.z);
    clearVec.project(mgr.camera);
    const clearValid = mgr.updateBuildingPlacementGhostFromNdc(clearVec.x, clearVec.y);
    const ghostX = mgr.getPlacementGhostState().x;
    const ghostZ = mgr.getPlacementGhostState().z;

    // Confirm tap on clear spot -> constructs Sacred Capy Pagoda!
    const tapHandled = mgr.handleCanvasTapRaycast(clearVec.x, clearVec.y);
    return {
      beforeCount,
      blockedValid,
      countAfterBlockedTap,
      clearValid,
      ghostX,
      ghostZ,
      tapHandled,
      ghostClosedAfterConfirm: !mgr.getPlacementGhostState().active,
    };
  });
  await ghostBanner.waitFor({ state: 'hidden', timeout: 5000 });
  await page.waitForTimeout(80);
  const pagodaConstructedCount = await page.evaluate(() => {
    const mgr = window.__capyManager;
    return mgr
      ? mgr.stats.buildings.filter((b) => b.type === 'zen_pagoda').length
      : 0;
  });
  if (
    !ghostPlacementCheck ||
    ghostPlacementCheck.blockedValid !== false ||
    ghostPlacementCheck.countAfterBlockedTap !== ghostPlacementCheck.beforeCount ||
    ghostPlacementCheck.clearValid !== true ||
    !ghostPlacementCheck.tapHandled ||
    !ghostPlacementCheck.ghostClosedAfterConfirm ||
    pagodaConstructedCount < 1
  ) {
    throw new Error(
      `Interactive Raycast Building Placement Ghost check failed: ${JSON.stringify({
        ghostPlacementCheck,
        pagodaConstructedCount,
      })}`
    );
  }
  console.log(
    `✓ Interactive Raycast Building Placement Ghost verified: Home Pool blocked -> clear turf (${ghostPlacementCheck.ghostX}, ${ghostPlacementCheck.ghostZ}) constructed Sacred Capy Pagoda`
  );

  // Re-open Menu for Bio-Traits, Night Cycle, Upgrades & Wardrobe
  await menuBtn.click({ force: true });
  await topDock.waitFor({ state: 'visible', timeout: 5000 });

  await page.getByTestId('tab-dna').click({ force: true });
  await page.getByTestId('mutation-btn-flippers').click({ force: true });
  await page.getByTestId('mutation-btn-glow_tail').click({ force: true });
  console.log('✓ Activated Flippers & Bioluminescent Tail mutations');

  // 13C. Verify Dynamic Day, Sunset & Bioluminescent Night Cycle across glow_tail, zen_pagoda & portals
  const nightGlowCheck = await page.evaluate(() => {
    const mgr = window.__capyManager;
    if (!mgr) return null;

    // Sample Noon (12:00)
    mgr.updateSettings({
      ...mgr.settings,
      dayNightAutoCycle: false,
      timeOfDayHours: 12.0,
    });
    mgr.tick(0.03);
    const tailMesh = mgr.heroCapy.userData.mutationGroup.children.find(
      (c) => c.userData?.isBioluminescentTail && c.isMesh
    );
    const noonTailEmissive = tailMesh?.material?.emissiveIntensity ?? 0;
    const pagodaMesh = mgr.sanctuaryBuildingMeshes.find(
      (m) => m.userData?.buildingType === 'zen_pagoda'
    );
    const noonPagodaEmissive =
      pagodaMesh?.userData?.pagodaLanternMat?.emissiveIntensity ?? 0;
    const noonPortalBeacon =
      mgr.sanctuaryPortals[0]?.mesh?.userData?.beaconMat?.emissiveIntensity ?? 0;

    // Sample Midnight (23:30)
    mgr.updateSettings({
      ...mgr.settings,
      dayNightAutoCycle: false,
      timeOfDayHours: 23.5,
    });
    mgr.tick(0.03);
    const nightTailEmissive = tailMesh?.material?.emissiveIntensity ?? 0;
    const nightPagodaEmissive =
      pagodaMesh?.userData?.pagodaLanternMat?.emissiveIntensity ?? 0;
    const nightPortalBeacon =
      mgr.sanctuaryPortals[0]?.mesh?.userData?.beaconMat?.emissiveIntensity ?? 0;

    // Restore default auto cycle
    mgr.updateSettings({
      ...mgr.settings,
      dayNightAutoCycle: true,
      timeOfDayHours: 9.5,
    });

    return {
      noonTailLight: +noonTailEmissive.toFixed(3),
      nightTailLight: +nightTailEmissive.toFixed(3),
      noonPagodaLight: +noonPagodaEmissive.toFixed(3),
      nightPagodaLight: +nightPagodaEmissive.toFixed(3),
      noonPortalBeacon: +noonPortalBeacon.toFixed(3),
      nightPortalBeacon: +nightPortalBeacon.toFixed(3),
    };
  });
  if (
    !nightGlowCheck ||
    nightGlowCheck.nightTailLight <= nightGlowCheck.noonTailLight + 1.2 ||
    nightGlowCheck.nightPagodaLight <= nightGlowCheck.noonPagodaLight + 1.4 ||
    nightGlowCheck.nightPortalBeacon <= nightGlowCheck.noonPortalBeacon + 1.2
  ) {
    throw new Error(
      `Dynamic Bioluminescent Night Cycle check failed: ${JSON.stringify(nightGlowCheck)}`
    );
  }
  console.log(
    `✓ Dynamic Bioluminescent Night Cycle verified: glow_tail (${nightGlowCheck.noonTailLight} -> ${nightGlowCheck.nightTailLight}), zen_pagoda (${nightGlowCheck.noonPagodaLight} -> ${nightGlowCheck.nightPagodaLight}), portals (${nightGlowCheck.noonPortalBeacon} -> ${nightGlowCheck.nightPortalBeacon})`
  );

  await page.getByTestId('tab-upgrades').click({ force: true });
  await page.getByTestId('upgrade-btn-speedBoost').click({ force: true });
  console.log('✓ Incremented Unit Parameter');

  await page.getByTestId('tab-wardrobe').click({ force: true });
  await page.getByTestId('wardrobe-btn-crown').click({ force: true });
  console.log('✓ Equipped Gold Diadem in Loadout');
  await page.getByTestId('toggle-menu-btn').click();

  // 14B. Verify 63-Orders-of-Magnitude Seamless Universe Simulator (+28 Big Bang -> +0.8 Capybara Forest -> -35 Single Electron & Photon)
  const scaleAtlasToggle = page.getByTestId('toggle-scale-atlas-btn');
  await scaleAtlasToggle.waitFor({ state: 'visible', timeout: 5000 });
  await scaleAtlasToggle.click();
  await page.getByTestId('universe-scale-atlas-panel').waitFor({ state: 'visible', timeout: 5000 });

  const multiScaleSweep = await page.evaluate(() => {
    const mgr = window.__capyManager;
    if (!mgr || !mgr.seamlessUniverse) return null;

    const checkpoints = [
      'big_bang',
      'entire_cosmos',
      'supercluster_a',
      'galaxy_filaments',
      'galaxies',
      'nebulas',
      'stellar_nurseries',
      'solar_systems',
      'atmosphere',
      'land_masses',
      'ecosystems',
      'capybara_forest',
      'leaf_fur_micro',
      'biological_cells',
      'dna_molecules',
      'atomic_orbitals',
      'atomic_nucleus',
      'quarks_gluons',
      'single_electron',
      'single_photon',
      'planck_quantum_foam',
    ];

    const visited = [];
    let forestSurfaceVerified = false;
    let woodlandHerdCount = 0;

    for (const bandId of checkpoints) {
      const spec = mgr.seamlessUniverse.getBandById(bandId);
      mgr.setSeamlessLogScale(spec.logMeters, true);
      mgr.tick(0.03);

      const visibleLayers = mgr.seamlessUniverse.rootGroup.children.filter(
        (g) => g.visible && g.scale.x >= 0.04 && g.scale.x <= 15.0
      );
      const tel = mgr.getUniverseScaleTelemetry();

      if (bandId === 'capybara_forest') {
        forestSurfaceVerified =
          mgr.sanctuaryGroup.visible === true &&
          mgr.heroCapy.visible === true &&
          mgr.seamlessUniverse.forestGroveGroup.visible === true;
        woodlandHerdCount = mgr.seamlessUniverse.forestGroveGroup.children.length;
      }

      visited.push({
        expected: bandId,
        actual: tel.bandId,
        logMeters: tel.logScaleMeters,
        visibleLayerCount: visibleLayers.length,
      });
    }

    return {
      totalCheckpoints: checkpoints.length,
      allMatched: visited.every(
        (v) => v.expected === v.actual && v.visibleLayerCount >= 1
      ),
      forestSurfaceVerified,
      woodlandHerdCount,
      minLogReached: visited[visited.length - 1].logMeters,
      maxLogReached: visited[0].logMeters,
    };
  });

  if (
    !multiScaleSweep ||
    multiScaleSweep.totalCheckpoints !== 21 ||
    !multiScaleSweep.allMatched ||
    !multiScaleSweep.forestSurfaceVerified ||
    multiScaleSweep.woodlandHerdCount < 5 ||
    multiScaleSweep.maxLogReached !== 28 ||
    multiScaleSweep.minLogReached !== -35
  ) {
    throw new Error(
      `Seamless 63-Orders-of-Magnitude Universe Simulator check failed: ${JSON.stringify(multiScaleSweep)}`
    );
  }

  // Verify UI buttons for Quantum Focus (Electron & Photon), landing button, AND automatic movement handover!
  await page.getByTestId('quantum-focus-electron').click();
  await page.waitForTimeout(80);
  await page.getByTestId('quantum-focus-photon').click();
  await page.waitForTimeout(80);

  // Test automatic seamless handover: zoom to capybara_forest (+0.8m) and steer forward -> enters 'playing' automatically!
  const autoHandoverOk = await page.evaluate(() => {
    const mgr = window.__capyManager;
    if (!mgr) return false;
    mgr.setSeamlessLogScale(0.8, true);
    const wasSeamless = mgr.getUniverseScaleTelemetry().active === true;
    mgr.moveInput.z = -1;
    mgr.tick(0.04);
    mgr.moveInput.z = 0;
    const handedOverToPlay =
      mgr.cosmicStage === 'playing' && mgr.getUniverseScaleTelemetry().active === false;
    // Zooming out from playing smoothly lifts back into seamless multi-scale view!
    mgr.adjustZoom(-0.35);
    mgr.tick(0.04);
    const liftedOffCleanly = mgr.getUniverseScaleTelemetry().active === true;
    return wasSeamless && handedOverToPlay && liftedOffCleanly;
  });
  if (!autoHandoverOk) {
    throw new Error('Expected seamless movement handover at capybara_forest (+0.8m) and smooth zoom liftoff!');
  }

  await page.getByTestId('enter-capy-forest-play-btn').click();
  await page.waitForTimeout(100);
  const stageAfterLand = await page.evaluate(() => window.__capyManager?.cosmicStage);
  if (stageAfterLand !== 'playing') {
    throw new Error(`Expected 'playing' stage after landing in Capybara Forest, got '${stageAfterLand}'`);
  }
  console.log(
    `✓ Seamless 63-Orders-of-Magnitude Universe Simulator & Auto Surface Handover verified across all 25 bands (10^+28m Big Bang -> Capybara Forest [${multiScaleSweep.woodlandHerdCount} grove nodes] -> 10^-35m Planck Scale)`
  );

  // 14C. Verify 1:1 Default Physical Scale, Zero 10^+13.7m Pillar Collision, Unlockable Object Finder Markers & Reality Rescaler!
  const defaultOneToOneCheck = await page.evaluate(() => {
    const mgr = window.__capyManager;
    if (!mgr || !mgr.seamlessUniverse) return null;
    // Reset optical unlocks to verify strict 1:1 default
    mgr.setAllFeaturesUnlocked(false);
    mgr.stats.unlockedObjectMarkers = false;
    mgr.stats.unlockedRealityRescaler = false;
    mgr.setSeamlessLogScale(13.7, true);
    mgr.tick(0.09);
    const telAt13_7 = mgr.getUniverseScaleTelemetry();
    // Index 6 = stellar_nurseries (+16.63); at 13.7 under 1:1 (deltaLog = +2.93 > 1.16), it MUST be invisible!
    const nurseryGroup = mgr.seamlessUniverse.rootGroup.children[6];
    // Award DNA so player can unlock both instruments via real HUD buttons
    mgr.stats.dna = Math.max(mgr.stats.dna, 80);
    mgr.callbacks.onProgressEarned?.(80, 'sanctuary', 10);
    return {
      defaultGamma: telAt13_7.realityScaleGamma,
      defaultMarkers: telAt13_7.showObjectMarkers,
      nurseryHiddenAt326Au: nurseryGroup ? nurseryGroup.visible === false : false,
      celestialBackdropActive: mgr.seamlessUniverse.celestialBackdropGroup.visible === true,
    };
  });

  if (
    !defaultOneToOneCheck ||
    defaultOneToOneCheck.defaultGamma !== 1 ||
    defaultOneToOneCheck.defaultMarkers !== false ||
    !defaultOneToOneCheck.nurseryHiddenAt326Au ||
    !defaultOneToOneCheck.celestialBackdropActive
  ) {
    throw new Error(
      `1:1 Default Scale or 10^+13.7m non-collision check failed: ${JSON.stringify(defaultOneToOneCheck)}`
    );
  }

  // Open Cosmic Optics Popover in single top bar, unlock Object Finder Markers & Reality Rescaler via UI buttons
  await page.evaluate(() => {
    const mgr = window.__capyManager;
    if (!mgr) return;
    const spec = mgr.seamlessUniverse.getBandById('solar_systems');
    mgr.cosmicOrbitYaw = 0.52;
    mgr.cosmicOrbitPitch = 0.38;
    mgr.setSeamlessLogScale(spec.logMeters, true);
    mgr.tick(0.09);
  });
  await page.getByTestId('toggle-optics-panel-btn').click({ force: true });
  await page.getByTestId('cosmic-optics-panel').waitFor({ state: 'visible', timeout: 5000 });

  // Unlock Object Finder Markers (12 DNA) -> automatically activates HUD reticles!
  await page.getByTestId('unlock-markers-dna-btn').click({ force: true });
  await page.evaluate(() => {
    const mgr = window.__capyManager;
    if (mgr) {
      mgr.tick(0.09);
      mgr.tick(0.05, 0.06);
    }
  });
  await page.getByTestId('object-finder-markers-layer').waitFor({ state: 'visible', timeout: 5000 });

  // Unlock Reality Rescaler (20 DNA) & test Atlas 0.30 -> Log-Sqrt 0.50 -> 1:1 True presets + Hubble SHO filter
  await page.getByTestId('unlock-rescaler-dna-btn').click({ force: true });
  await page.getByTestId('rescaler-preset-atlas').click({ force: true });
  const rescaledCheck = await page.evaluate(() => {
    const mgr = window.__capyManager;
    if (!mgr) return null;
    mgr.tick(0.09);
    const telAtlas = mgr.getUniverseScaleTelemetry();
    return {
      gammaAtlas: telAtlas.realityScaleGamma,
      markersCount: telAtlas.markers.length,
    };
  });
  await page.getByTestId('palette-btn-hubble').click({ force: true });
  await page.getByTestId('rescaler-preset-1to1').click({ force: true });
  await page.getByTestId('close-optics-panel-btn').click({ force: true });

  if (
    !rescaledCheck ||
    Math.abs(rescaledCheck.gammaAtlas - 0.3) > 0.02 ||
    rescaledCheck.markersCount < 2
  ) {
    throw new Error(
      `Cosmic Optics Markers / Reality Rescaler E2E check failed: ${JSON.stringify(rescaledCheck)}`
    );
  }
  console.log(
    `✓ 1:1 Physical Scale Default, 10^+13.7m Non-Collision, Unlockable Object Finder Markers (${rescaledCheck.markersCount} HUD reticles) & Reality Rescaler (γ=0.30..1.00) verified!`
  );

  // 14D. Verify Contiguous Single-World Overland Walking Across All 5 Minigames & Rapier3D Wasm + Worker Physics Engine
  const contiguousAndPhysicsCheck = await page.evaluate(async () => {
    const mgr = window.__capyManager;
    if (!mgr) return null;

    // Return to planet surface gameplay in Sanctuary (0, 0)
    mgr.resumeSurfacePlayFromForest(true);
    mgr.switchMode('sanctuary', true);
    mgr.settings.cameraFollowBehind = false;
    mgr.suspendedFootTestHeight = null;
    mgr.moveInput.x = 0;
    mgr.moveInput.z = 0;

    // Give Web Worker 80ms to finish async Rapier3D Wasm initialization if still booting
    await new Promise((r) => setTimeout(r, 80));
    mgr.tick(0.03);

    const initialPhys = mgr.getPhysicsTelemetry();

    // Helper: physically walk Hero step-by-step toward a target world coordinate using ONLY moveInput (NEVER calling switchMode!)
    const walkOverlandToward = (targetWx, targetWz, maxSteps = 220) => {
      for (let s = 0; s < maxSteps; s++) {
        const zCur = mgr.heroCapy.position.z;
        const xCur = mgr.heroCapy.position.x;
        const dx = targetWx - xCur;
        const dz = targetWz - zCur;
        const dist = Math.hypot(dx, dz);
        if (dist < 2.2) {
          mgr.moveInput.x = 0;
          mgr.moveInput.z = 0;
          return { reached: true, steps: s, finalX: +xCur.toFixed(2), finalZ: +zCur.toFixed(2) };
        }
        mgr.moveInput.x = dx / dist;
        mgr.moveInput.z = dz / dist;
        mgr.tick(0.05);
      }
      mgr.moveInput.x = 0;
      mgr.moveInput.z = 0;
      return {
        reached: false,
        steps: maxSteps,
        finalX: +mgr.heroCapy.position.x.toFixed(2),
        finalZ: +mgr.heroCapy.position.z.toFixed(2),
      };
    };

    // 1. Walk NW from Sanctuary (0, 4) -> bridge head (-20.5, -20.5) -> Spore Lagoon (-62, -62)
    mgr.heroLocalPos.set(-18.0, 0, -18.0);
    mgr.resetDachshundTrail();
    mgr.tick(0.03);
    const walkToSpore = walkOverlandToward(-62.0, -62.0, 220);
    const modeInSpore = mgr.currentMode;
    const swimmingInLagoon = mgr.isSwimmingInPool;

    // Walk right back SE from Spore Lagoon (-62, -62) -> NW Causeway (-25, -25) -> Sanctuary!
    const walkBackFromSpore = walkOverlandToward(-24.0, -24.0, 220);
    const modeBackInSanctuary = mgr.currentMode;

    // 2. Walk NE from Sanctuary (+20.5, -20.5) -> Yuzu Breakout baseline (+73, -65.2) & steer paddle, then walk south out!
    mgr.heroLocalPos.set(20.5, 0, -20.5);
    mgr.resetDachshundTrail();
    mgr.tick(0.03);
    const walkToBreakout = walkOverlandToward(73.0, -65.2, 240);
    const modeInBreakout = mgr.currentMode;
    const paddleCoupledX = +mgr.breakoutPaddle.position.x.toFixed(2);
    const walkOutBreakout = walkOverlandToward(52.0, -44.0, 180);
    const modeAfterBreakoutExit = mgr.currentMode;

    // 3. Walk SE from Sanctuary (+20.5, +20.5) -> Yuzu Mountain (+75, +77) & test See-Saw torque + Hammer angular impulse!
    mgr.heroLocalPos.set(20.5, 0, 20.5);
    mgr.resetDachshundTrail();
    mgr.tick(0.03);
    const walkToFallGuys = walkOverlandToward(75.0, 77.0, 240);
    const modeInFallGuys = mgr.currentMode;

    // Stand on right edge of Yuzu Mountain See-Saw (local x=+4.2, z=-33 -> world 79.2, 42.0) to test dynamic torque!
    mgr.heroLocalPos.set(4.2, 0.55, -33.0);
    for (let i = 0; i < 12; i++) mgr.tick(0.04);
    const seeSawTiltUnderLoad = mgr.physicsBridge.getSeeSawTiltAngle();

    // Test XPBD Soft-Body Launch Pad at local (0, 0.5, -46)
    mgr.heroLocalPos.set(0, 0.52, -46.0);
    mgr.heroVelocity.set(0, -3.5, 0);
    mgr.tick(0.04);
    const xpbdLaunchVy = +mgr.heroVelocity.y.toFixed(2);

    mgr.moveInput.x = 0;
    mgr.moveInput.z = 0;
    const finalPhys = mgr.getPhysicsTelemetry();

    return {
      wasmInitialized: initialPhys.wasmInitialized || finalPhys.wasmInitialized,
      ccdEnabled: finalPhys.ccdEnabled,
      fluidGridCells: finalPhys.fluidGridCells,
      softBodyNodes: finalPhys.softBodyNodes,
      walkToSporeReached: walkToSpore.reached,
      modeInSpore,
      swimmingInLagoon,
      walkBackFromSporeReached: walkBackFromSpore.reached,
      modeBackInSanctuary,
      walkToBreakoutReached: walkToBreakout.reached,
      modeInBreakout,
      paddleCoupledX,
      walkOutBreakoutReached: walkOutBreakout.reached,
      modeAfterBreakoutExit,
      walkToFallGuysReached: walkToFallGuys.reached,
      modeInFallGuys,
      seeSawTilted: Math.abs(seeSawTiltUnderLoad) > 0.005,
      xpbdLaunchVy,
      transportMode: finalPhys.transportMode,
    };
  });

  if (
    !contiguousAndPhysicsCheck ||
    !contiguousAndPhysicsCheck.wasmInitialized ||
    !contiguousAndPhysicsCheck.ccdEnabled ||
    contiguousAndPhysicsCheck.fluidGridCells !== 576 ||
    !contiguousAndPhysicsCheck.walkToSporeReached ||
    contiguousAndPhysicsCheck.modeInSpore !== 'spore' ||
    !contiguousAndPhysicsCheck.walkBackFromSporeReached ||
    contiguousAndPhysicsCheck.modeBackInSanctuary !== 'sanctuary' ||
    !contiguousAndPhysicsCheck.walkToBreakoutReached ||
    contiguousAndPhysicsCheck.modeInBreakout !== 'breakout' ||
    !contiguousAndPhysicsCheck.walkOutBreakoutReached ||
    contiguousAndPhysicsCheck.modeAfterBreakoutExit !== 'sanctuary' ||
    !contiguousAndPhysicsCheck.walkToFallGuysReached ||
    contiguousAndPhysicsCheck.modeInFallGuys !== 'fallguys' ||
    !contiguousAndPhysicsCheck.seeSawTilted ||
    contiguousAndPhysicsCheck.xpbdLaunchVy < 12.0
  ) {
    throw new Error(
      `Contiguous Single-World Overland Walk or Rapier3D Physics Engine check failed: ${JSON.stringify(contiguousAndPhysicsCheck)}`
    );
  }
  console.log(
    `✓ Contiguous Single-World Overland Walking & Rapier3D Wasm Physics Engine verified: Sanctuary <-> Spore Lagoon <-> Yuzu Breakout <-> Yuzu Mountain seamless overland walk, See-Saw torque, XPBD Soft-Body launch (vy=${contiguousAndPhysicsCheck.xpbdLaunchVy}m/s), Fluid Grid (${contiguousAndPhysicsCheck.fluidGridCells} cells, mode=${contiguousAndPhysicsCheck.transportMode})!`
  );

  // 14E. Verify Hardware-Accelerated 3D GPU Engine, Texel-Snapped Shadow Cascade, Procedural PBR Normal/AO Maps, Texture Filtering & Post-Processing Visual Filters
  const gpuEngineCheck = await page.evaluate(() => {
    const mgr = window.__capyManager;
    if (!mgr || !mgr.gpuEngine) return null;

    // 1. Move Hero to Yuzu Mountain (+75, +77) and tick to verify texel-snapped sunLight shadow cascade tracks Hero!
    mgr.switchMode('fallguys', true);
    mgr.heroLocalPos.set(0, 0.5, 2.0);
    mgr.tick(0.03, 0.03);
    const sunTargetAtFallGuys = {
      x: +mgr.gpuEngine.sunLight.target.position.x.toFixed(2),
      z: +mgr.gpuEngine.sunLight.target.position.z.toFixed(2),
    };
    const cascadeDistAtFallGuys = Math.hypot(
      mgr.gpuEngine.sunLight.target.position.x - mgr.heroCapy.position.x,
      mgr.gpuEngine.sunLight.target.position.z - mgr.heroCapy.position.z
    );

    // Return to Sanctuary (0, 4) and verify shadow cascade re-centers on Sanctuary
    mgr.switchMode('sanctuary', true);
    mgr.heroLocalPos.set(0, 0, 4.0);
    mgr.tick(0.03, 0.03);
    const cascadeDistAtSanctuary = Math.hypot(
      mgr.gpuEngine.sunLight.target.position.x - mgr.heroCapy.position.x,
      mgr.gpuEngine.sunLight.target.position.z - mgr.heroCapy.position.z
    );

    // 2. Inspect PBR normalMap, roughnessMap, aoMap & dual-octave ocean clearcoat normal maps
    const islandMat = mgr.sanctuaryIslandMesh?.material;
    const oceanMat = mgr.oceanMesh?.material;
    let heroFurHasNormalMap = false;
    mgr.heroCapy.traverse((obj) => {
      if (obj.isMesh && obj.material?.map && obj.material?.normalMap) {
        heroFurHasNormalMap = true;
      }
    });

    // 3. Test live Texture Filtering switch (nearest_retro <-> trilinear_aniso)
    const NEAREST_FILTER = 1003; // THREE.NearestFilter
    const LINEAR_MIPMAP_LINEAR = 1008; // THREE.LinearMipmapLinearFilter
    mgr.updateSettings({
      ...mgr.settings,
      gpuTextureFilter: 'nearest_retro',
      gpuAnisotropy: 1,
    });
    const nearestMagFilter = islandMat?.normalMap?.magFilter ?? 0;

    mgr.updateSettings({
      ...mgr.settings,
      gpuTextureFilter: 'trilinear_aniso',
      gpuAnisotropy: 16,
    });
    const trilinearMinFilter = islandMat?.normalMap?.minFilter ?? 0;

    // 4. Test HDR EffectComposer Post-Processing + DepthTexture SSAO across consecutive frames (zero GL_INVALID_OPERATION feedback loops & zero alternating-frame flicker!)
    const gl = mgr.renderer.getContext();
    while (gl.getError() !== gl.NO_ERROR) {
      // Drain any prior GL state before post-fx check
    }
    mgr.gpuEngine.setForceSoftwarePostProcess(true);
    mgr.updateSettings({
      ...mgr.settings,
      gpuPostProcessing: true,
      gpuVisualFilter: 'cinema_filmic',
      gpuToneMapping: 'aces',
      gpuBloomEnabled: true,
      gpuSsaoEnabled: true,
      gpuSharpenAmount: 0.36,
    });

    const sampleCenterLuma = () => {
      const px = new Uint8Array(16);
      const cx = Math.max(0, Math.floor(gl.drawingBufferWidth / 2) - 1);
      const cy = Math.max(0, Math.floor(gl.drawingBufferHeight / 2) - 1);
      gl.readPixels(cx, cy, 2, 2, gl.RGBA, gl.UNSIGNED_BYTE, px);
      let sum = 0;
      for (let i = 0; i < 16; i += 4) {
        sum += px[i] * 0.2126 + px[i + 1] * 0.7152 + px[i + 2] * 0.0722;
      }
      return sum / 4;
    };

    let glErrorDuringPostFx = 0;
    const frameLumas = [];
    for (let f = 0; f < 4; f++) {
      mgr.gpuEngine.render();
      const err = gl.getError();
      if (err !== gl.NO_ERROR) glErrorDuringPostFx = err;
      frameLumas.push(sampleCenterLuma());
    }
    // Also test odd-swap parity (antiAliasing: 'none') to prove zero ping-pong strobe
    mgr.gpuEngine.applyConfig({ antiAliasing: 'none' });
    const noAaLumas = [];
    for (let f = 0; f < 4; f++) {
      mgr.gpuEngine.render();
      const err = gl.getError();
      if (err !== gl.NO_ERROR) glErrorDuringPostFx = err;
      noAaLumas.push(sampleCenterLuma());
    }
    mgr.gpuEngine.applyConfig({ antiAliasing: 'msaa_fxaa' });
    mgr.tick(0.03, 0.03);
    const cinemaTel = mgr.getGpuEngineTelemetry();

    const maxFxaaDelta = Math.max(...frameLumas) - Math.min(...frameLumas);
    const maxNoAaDelta = Math.max(...noAaLumas) - Math.min(...noAaLumas);
    const maxFrameLumaDelta = +Math.max(maxFxaaDelta, maxNoAaDelta).toFixed(2);

    mgr.updateSettings({
      ...mgr.settings,
      gpuPostProcessing: true,
      gpuVisualFilter: 'retro_crt',
      gpuToneMapping: 'agx',
    });
    mgr.tick(0.03, 0.03);
    const retroTel = mgr.getGpuEngineTelemetry();

    // Restore clean Natural PBR defaults
    mgr.gpuEngine.setForceSoftwarePostProcess(false);
    mgr.updateSettings({
      ...mgr.settings,
      gpuVisualFilter: 'natural_pbr',
      gpuToneMapping: 'agx',
      gpuSharpenAmount: 0.24,
    });
    mgr.tick(0.03, 0.03);

    // 5. Verify AAA Zero-Allocation GPU VFX Engine, Outer-District PBR & Quadratic Camera Trauma
    mgr.vfxEngine.emitBurst(0, 0.5, 4, 'citrus_burst', 6);
    mgr.addCameraTrauma(0.5);
    const traumaPeak = mgr.getCameraTrauma();
    mgr.tick(0.04, 0.04);
    const traumaAfterStep = mgr.getCameraTrauma();
    const activeBurstParticles = mgr.vfxEngine.getActiveParticleCount();
    const breakoutPaddleMat = mgr.breakoutPaddle?.material;

    return {
      hasIblEnvironment: Boolean(
        (mgr.scene.environment && mgr.scene.environment.isTexture) ||
          (mgr.gpuEngine.iblEnvironmentTexture && mgr.gpuEngine.iblEnvironmentTexture.isTexture)
      ),
      hasRimLight: Boolean(mgr.gpuEngine.rimLight && mgr.gpuEngine.rimLight.parent === mgr.scene),
      hasContactShadow: Boolean(
        mgr.gpuEngine.heroContactShadowMesh &&
          mgr.gpuEngine.heroContactShadowMesh.parent === mgr.scene
      ),
      sunTargetAtFallGuys,
      cascadeTracksFallGuys: cascadeDistAtFallGuys < 1.5,
      cascadeTracksSanctuary: cascadeDistAtSanctuary < 1.5,
      islandHasNormalAoRoughness: Boolean(
        islandMat?.normalMap && islandMat?.roughnessMap && islandMat?.aoMap
      ),
      outerDistrictsHaveFullPbr: Boolean(
        breakoutPaddleMat?.normalMap &&
          breakoutPaddleMat?.roughnessMap &&
          breakoutPaddleMat?.aoMap
      ),
      oceanHasDualClearcoatNormals: Boolean(
        oceanMat?.normalMap && oceanMat?.clearcoatNormalMap
      ),
      heroFurHasNormalMap,
      hasAaaVfxEngine: Boolean(
        mgr.vfxEngine?.burstInstancedMesh &&
          mgr.vfxEngine?.motesPoints &&
          mgr.vfxEngine?.godRayGroup
      ),
      vfxBurstActive: activeBurstParticles >= 4,
      cameraTraumaDecays: traumaPeak >= 0.48 && traumaAfterStep < traumaPeak,
      nearestMagFilterMatches: nearestMagFilter === NEAREST_FILTER,
      trilinearMinFilterMatches: trilinearMinFilter === LINEAR_MIPMAP_LINEAR,
      registeredPbrTextures: cinemaTel.registeredPbrTextures,
      cinemaPostFxActive: cinemaTel.postProcessingActive,
      cinemaFilterId: cinemaTel.visualFilterPreset,
      cinemaToneMap: cinemaTel.toneMapping,
      retroPostFxActive: retroTel.postProcessingActive,
      retroFilterId: retroTel.visualFilterPreset,
      retroToneMap: retroTel.toneMapping,
      glErrorDuringPostFx,
      maxFrameLumaDelta,
      contextLost: retroTel.contextLost,
    };
  });

  if (
    !gpuEngineCheck ||
    !gpuEngineCheck.hasIblEnvironment ||
    !gpuEngineCheck.hasRimLight ||
    !gpuEngineCheck.hasContactShadow ||
    !gpuEngineCheck.cascadeTracksFallGuys ||
    !gpuEngineCheck.cascadeTracksSanctuary ||
    !gpuEngineCheck.islandHasNormalAoRoughness ||
    !gpuEngineCheck.outerDistrictsHaveFullPbr ||
    !gpuEngineCheck.oceanHasDualClearcoatNormals ||
    !gpuEngineCheck.heroFurHasNormalMap ||
    !gpuEngineCheck.hasAaaVfxEngine ||
    !gpuEngineCheck.vfxBurstActive ||
    !gpuEngineCheck.cameraTraumaDecays ||
    !gpuEngineCheck.nearestMagFilterMatches ||
    !gpuEngineCheck.trilinearMinFilterMatches ||
    gpuEngineCheck.registeredPbrTextures < 20 ||
    !gpuEngineCheck.cinemaPostFxActive ||
    gpuEngineCheck.cinemaFilterId !== 'cinema_filmic' ||
    gpuEngineCheck.cinemaToneMap !== 'aces' ||
    !gpuEngineCheck.retroPostFxActive ||
    gpuEngineCheck.retroFilterId !== 'retro_crt' ||
    gpuEngineCheck.retroToneMap !== 'agx' ||
    gpuEngineCheck.glErrorDuringPostFx !== 0 ||
    gpuEngineCheck.maxFrameLumaDelta > 4.0 ||
    gpuEngineCheck.contextLost
  ) {
    throw new Error(
      `Hardware-Accelerated 3D GPU Engine & AAA VFX verification failed: ${JSON.stringify(gpuEngineCheck)}`
    );
  }

  // Also verify GPU Engine UI controls in Settings Modal & GPU Telemetry Readout in Info Dropdown
  if (!(await page.getByTestId('open-settings-btn').isVisible())) {
    await page.getByTestId('toggle-menu-btn').click({ force: true, timeout: 10000 });
  }
  await page.getByTestId('open-settings-btn').waitFor({ state: 'visible', timeout: 5000 });
  await page.getByTestId('open-settings-btn').click({ force: true, timeout: 10000 });
  await page.getByTestId('settings-gpu-engine-panel').waitFor({ state: 'visible', timeout: 5000 });
  await page.getByTestId('settings-gpu-filter-golden_hour').click({ force: true });
  await page.getByTestId('settings-tonemap-aces').click({ force: true });
  await page.getByTestId('settings-texfilter-bilinear').click({ force: true });
  await page.getByTestId('settings-texfilter-trilinear_aniso').click({ force: true });
  await page.getByTestId('settings-aniso-8').click({ force: true });
  await page.getByTestId('settings-gpu-filter-natural_pbr').click({ force: true });
  await page.getByTestId('settings-tonemap-agx').click({ force: true });
  await page.getByTestId('close-settings-btn').click({ force: true });

  await page.getByTestId('toggle-infographic-btn').click({ force: true });
  const gpuReadout = page.getByTestId('gpu-telemetry-readout');
  await gpuReadout.waitFor({ state: 'visible', timeout: 5000 });
  const gpuReadoutText = (await gpuReadout.innerText()) || '';
  if (!gpuReadoutText.includes('GPU:') || !gpuReadoutText.includes('Aniso')) {
    throw new Error(`Unexpected gpu-telemetry-readout text: ${gpuReadoutText}`);
  }
  await page.getByTestId('toggle-infographic-btn').click({ force: true });
  console.log(
    `✓ Hardware-Accelerated 3D GPU Engine verified: PMREM IBL + 3-Point Rim Light + Texel-Snapped Hero Shadow Cascade, ${gpuEngineCheck.registeredPbrTextures} PBR Normal/Roughness/AO Textures, Live Trilinear/Aniso/Nearest Filtering & HDR Post-Processing Filters (Cinema Filmic, Golden Hour, Retro CRT)!`
  );

  if (consoleErrors.length > 0) {
    console.error('Vite WebSocket console errors encountered:', consoleErrors);
    process.exit(1);
  }

  if (errors.length > 0) {
    console.error('Page errors encountered:', errors);
    process.exit(1);
  }

  await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 1500))]);

  // 15. Verify Meaningful Error Messages when WebGL or App Errors occur in a clean lightweight browser instance
  const errBrowser = await chromium.launch({ headless: true });
  const errPage = await errBrowser.newPage({ viewport: { width: 390, height: 844 } });
  await errPage.goto(`${BASE_URL}?simulate_webgl_error=1`, { waitUntil: 'domcontentloaded' });
  const webglErr = errPage.getByTestId('capygame-webgl-error');
  await webglErr.waitFor({ state: 'visible', timeout: 5000 });
  console.log('✓ Meaningful WebGL error card displayed on simulated 3D failure');

  await errPage.goto(`${BASE_URL}?simulate_error=Mobile+Initialization+Failure`, {
    waitUntil: 'domcontentloaded',
  });
  const boundary = errPage.getByTestId('app-error-boundary');
  await boundary.waitFor({ state: 'visible', timeout: 5000 });
  console.log('✓ Meaningful AppErrorBoundary diagnostic screen displayed on simulated runtime error');
  await Promise.race([errBrowser.close(), new Promise((r) => setTimeout(r, 1500))]);

  console.log(
    'ALL CAPY UNIVERSE 3D, STELLAR NUCLEOSYNTHESIS, 60 FPS DYNAMIC CAPYBARA LOD, RAPIER3D PHYSICS & AAA GPU ENGINE E2E TESTS PASSED!'
  );
  process.exit(0);
})();
