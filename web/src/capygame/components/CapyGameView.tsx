import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import {
  BUILDING_CATALOG,
  BuildingType,
  LiveModeTelemetry,
  MutationId,
  PlayStyle,
  PlayerStats,
  SPORE_MUTATIONS,
} from '../types';
import { ProgressionService } from '../services/ProgressionService';
import { AudioService } from '../services/AudioService';
import { PlayStyleManager } from '../engine/PlayStyleManager';
import {
  Volume2,
  VolumeX,
  ChevronUp,
  ChevronDown,
  Sparkles,
  Hammer,
  Crown,
  ShoppingBag,
  Zap,
  ArrowLeft,
  Dna,
  Camera,
  X,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface CapyGameViewProps {
  onSwitchToPaint: () => void;
}

export const CapyGameView: React.FC<CapyGameViewProps> = ({ onSwitchToPaint }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const managerRef = useRef<PlayStyleManager | null>(null);
  const isPointerDraggingRef = useRef<boolean>(false);
  const dragStartPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const [stats, setStats] = useState<PlayerStats>(() => ProgressionService.loadStats());
  const [activeTab, setActiveTab] = useState<
    'modes' | 'build' | 'dna' | 'upgrades' | 'wardrobe'
  >('modes');
  const [isDockCollapsed, setIsDockCollapsed] = useState<boolean>(false);
  const [isGalleryOpen, setIsGalleryOpen] = useState<boolean>(false);
  const [notification, setNotification] = useState<string>(
    'Welcome to CapyGame 3D! Walk into any 3D Portal or choose a Play Style below.'
  );
  const [isMuted, setIsMuted] = useState<boolean>(() => AudioService.getMuted());
  const [cps, setCps] = useState<number>(() =>
    ProgressionService.calculateTotalCps(stats)
  );
  const [telemetry, setTelemetry] = useState<LiveModeTelemetry>({
    mode: stats.selectedPlayStyle,
    primaryLabel: 'Structures',
    primaryValue: stats.buildings.length,
    secondaryLabel: 'Portals Active',
    secondaryValue: 4,
    comboMultiplier: 1.0,
  });

  const notifTimerRef = useRef<number | null>(null);
  const showNotification = useCallback((msg: string) => {
    setNotification(msg);
    if (notifTimerRef.current) window.clearTimeout(notifTimerRef.current);
    notifTimerRef.current = window.setTimeout(() => setNotification(''), 4200);
  }, []);

  useEffect(() => {
    setCps(ProgressionService.calculateTotalCps(stats));
  }, [stats]);

  // Passive Sanctuary CPS income every second across all modes
  useEffect(() => {
    const interval = window.setInterval(() => {
      setStats((prev) => {
        const earned = ProgressionService.calculateTotalCps(prev);
        if (earned <= 0) return prev;
        return ProgressionService.addCoins(prev, earned);
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, []);

  const handleSelectMode = useCallback((mode: PlayStyle) => {
    if (managerRef.current) {
      managerRef.current.switchMode(mode);
    }
    setStats((prev) => {
      const updated = { ...prev, selectedPlayStyle: mode };
      ProgressionService.saveStats(updated);
      return updated;
    });
  }, []);

  // Keyboard controls & hotkeys (WASD / Arrows / Space / 1-5 modes / H dock toggle)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!managerRef.current) return;
      const key = e.key.toLowerCase();
      if (key === 'a' || key === 'arrowleft') {
        managerRef.current.pointerTargetX = null;
        managerRef.current.moveInput.x = -1;
      } else if (key === 'd' || key === 'arrowright') {
        managerRef.current.pointerTargetX = null;
        managerRef.current.moveInput.x = 1;
      } else if (key === 'w' || key === 'arrowup') {
        managerRef.current.moveInput.z = -1;
      } else if (key === 's' || key === 'arrowdown') {
        managerRef.current.moveInput.z = 1;
      } else if (key === ' ' || key === 'spacebar') {
        e.preventDefault();
        managerRef.current.isJumping = true;
      } else if (key === 'h') {
        setIsDockCollapsed((c) => !c);
      } else if (key === '1') {
        handleSelectMode('sanctuary');
      } else if (key === '2') {
        handleSelectMode('spore');
      } else if (key === '3') {
        handleSelectMode('breakout');
      } else if (key === '4') {
        handleSelectMode('runner');
      } else if (key === '5') {
        handleSelectMode('fallguys');
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (!managerRef.current) return;
      const key = e.key.toLowerCase();
      if ((key === 'a' || key === 'arrowleft') && managerRef.current.moveInput.x < 0) {
        managerRef.current.moveInput.x = 0;
      }
      if ((key === 'd' || key === 'arrowright') && managerRef.current.moveInput.x > 0) {
        managerRef.current.moveInput.x = 0;
      }
      if ((key === 'w' || key === 'arrowup') && managerRef.current.moveInput.z < 0) {
        managerRef.current.moveInput.z = 0;
      }
      if ((key === 's' || key === 'arrowdown') && managerRef.current.moveInput.z > 0) {
        managerRef.current.moveInput.z = 0;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleSelectMode]);

  // Mount Three.js scene & software-WebGL safe frame loop
  useEffect(() => {
    if (!mountRef.current) return;

    const manager = new PlayStyleManager(mountRef.current, stats, {
      onRewardEarned: (coins, dna, mode, score) => {
        setStats((prev) => {
          const next = ProgressionService.addRewards(prev, coins, dna, mode, score);
          manager.updateStats(next);
          return next;
        });
      },
      onTelemetryUpdate: (t) => {
        setTelemetry(t);
      },
      onModeNotification: (msg) => {
        showNotification(msg);
      },
      onPortalEntered: (targetMode) => {
        handleSelectMode(targetMode);
      },
    });
    managerRef.current = manager;

    const clock = new THREE.Clock();
    let frameId = 0;
    let isDisposed = false;

    const afterDraw = (cb: () => void) => {
      const gl = manager.renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
      gl.flush();
      if (!sync) {
        frameId = window.setTimeout(() => {
          if (!isDisposed) frameId = requestAnimationFrame(cb);
        }, 40);
        return;
      }
      const poll = () => {
        if (isDisposed) return;
        const state = gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          gl.deleteSync(sync);
          frameId = window.setTimeout(() => {
            if (!isDisposed) frameId = requestAnimationFrame(cb);
          }, 40);
        }
      };
      frameId = window.setTimeout(poll, 5);
    };

    const tickLoop = () => {
      if (isDisposed) return;
      const delta = clock.getDelta();
      manager.tick(delta);
      if (manager.isSoftwareGl) {
        afterDraw(tickLoop);
      } else {
        frameId = requestAnimationFrame(tickLoop);
      }
    };
    frameId = requestAnimationFrame(tickLoop);

    const handleResize = () => {
      if (mountRef.current) {
        const w = mountRef.current.clientWidth || window.innerWidth;
        const h = mountRef.current.clientHeight || window.innerHeight;
        if (w > 0 && h > 0) {
          manager.handleResize(w, h);
        }
      }
    };
    window.addEventListener('resize', handleResize);
    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => handleResize())
        : null;
    if (resizeObserver && mountRef.current) {
      resizeObserver.observe(mountRef.current);
    }

    return () => {
      isDisposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', handleResize);
      resizeObserver?.disconnect();
      manager.dispose();
      if (mountRef.current) {
        mountRef.current.innerHTML = '';
      }
    };
  }, []);

  // Pointer / Touch drag steering on the 3D canvas
  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!managerRef.current) return;
    isPointerDraggingRef.current = true;
    dragStartPosRef.current = { x: e.clientX, y: e.clientY };
    const rect = e.currentTarget.getBoundingClientRect();
    const normX = ((e.clientX - rect.left) / rect.width) * 2 - 1;

    if (
      managerRef.current.currentMode === 'breakout' ||
      managerRef.current.currentMode === 'runner'
    ) {
      managerRef.current.pointerTargetX = normX;
    }
  };

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPointerDraggingRef.current || !managerRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const normX = ((e.clientX - rect.left) / rect.width) * 2 - 1;

    if (
      managerRef.current.currentMode === 'breakout' ||
      managerRef.current.currentMode === 'runner'
    ) {
      managerRef.current.pointerTargetX = normX;
    } else {
      // Virtual joystick drag for Sanctuary, Spore, and Fall Guys
      const dx = (e.clientX - dragStartPosRef.current.x) / 60;
      const dz = (e.clientY - dragStartPosRef.current.y) / 60;
      managerRef.current.moveInput.x = THREE.MathUtils.clamp(dx, -1, 1);
      managerRef.current.moveInput.z = THREE.MathUtils.clamp(dz, -1, 1);
    }
  };

  const handleCanvasPointerUp = () => {
    isPointerDraggingRef.current = false;
    if (!managerRef.current) return;
    if (
      managerRef.current.currentMode !== 'breakout' &&
      managerRef.current.currentMode !== 'runner'
    ) {
      managerRef.current.moveInput.x = 0;
      managerRef.current.moveInput.z = 0;
    }
  };

  const handleCanvasWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!managerRef.current) return;
    const delta = e.deltaY < 0 ? 0.08 : -0.08;
    managerRef.current.adjustZoom(delta);
  };

  const handleSelectHat = (hatId: string) => {
    const updated = { ...stats, activeHat: hatId };
    setStats(updated);
    ProgressionService.saveStats(updated);
    if (managerRef.current) managerRef.current.updateStats(updated);
    showNotification(`Equipped ${hatId.toUpperCase()} hat!`);
    AudioService.playCoin();
  };

  const handleSelectSkin = (skinId: string) => {
    const updated = { ...stats, activeSkin: skinId };
    setStats(updated);
    ProgressionService.saveStats(updated);
    if (managerRef.current) managerRef.current.updateStats(updated);
    showNotification(`Applied ${skinId.toUpperCase()} fur coat!`);
    AudioService.playCoin();
  };

  const handleToggleMutation = (mutationId: MutationId) => {
    const res = ProgressionService.unlockOrToggleMutation(stats, mutationId);
    if (res) {
      setStats(res.stats);
      if (managerRef.current) managerRef.current.updateStats(res.stats);
      AudioService.playPrestigeFanfare();
      showNotification(
        res.action === 'unlocked'
          ? `Evolved ${mutationId.toUpperCase()}! Stage ${res.stats.evolutionStage}`
          : `Toggled ${mutationId.toUpperCase()}`
      );
    } else {
      showNotification('Harvest more DNA (🧬) in Spore Lagoon or mini-games!');
    }
  };

  const handleBuyUpgrade = (key: keyof PlayerStats['upgrades']) => {
    const updated = ProgressionService.buyUpgrade(stats, key);
    if (updated) {
      setStats(updated);
      if (managerRef.current) managerRef.current.updateStats(updated);
      showNotification(`Upgraded ${String(key)} to Lvl ${updated.upgrades[key]}!`);
      AudioService.playCoin();
    } else {
      showNotification('Not enough CapyCoins!');
    }
  };

  const handlePlaceBuilding = (
    type: BuildingType,
    name: string,
    baseCost: number,
    baseCps: number,
    desc: string
  ) => {
    const angle = Math.random() * Math.PI * 2;
    const radius = 3.5 + Math.random() * 11.5;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * (radius * 0.75) + 2;
    const updated = ProgressionService.placeBuilding(
      stats,
      type,
      name,
      baseCost,
      baseCps,
      x,
      z,
      desc
    );
    if (updated) {
      setStats(updated);
      if (managerRef.current) {
        managerRef.current.updateStats(updated);
        managerRef.current.refreshSanctuaryBuildings();
      }
      showNotification(`Built ${name} on Sanctuary Island! (+${baseCps} CPS)`);
      AudioService.playSplash();
    } else {
      showNotification('Need more CapyCoins to construct this structure!');
    }
  };

  const handleUpgradeExistingBuilding = (buildingId: string, name: string) => {
    const updated = ProgressionService.upgradeBuilding(stats, buildingId);
    if (updated) {
      setStats(updated);
      if (managerRef.current) {
        managerRef.current.updateStats(updated);
        managerRef.current.refreshSanctuaryBuildings();
      }
      AudioService.playCoin();
      showNotification(`Upgraded ${name}!`);
    } else {
      showNotification('Not enough CapyCoins to upgrade!');
    }
  };

  const handlePrestige = () => {
    const req = ProgressionService.getPrestigeRequirement(stats);
    const updated = ProgressionService.prestige(stats);
    if (updated) {
      setStats(updated);
      if (managerRef.current) managerRef.current.updateStats(updated);
      confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
      AudioService.playPrestigeFanfare();
      showNotification(
        `Ascended to Prestige Level ${updated.prestigeLevel}! Global Multiplier Boosted!`
      );
    } else {
      showNotification(
        `Need ${req.toLocaleString()} lifetime CapyCoins to Ascend (Current: ${stats.totalCoinsEarned.toLocaleString()})`
      );
    }
  };

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    AudioService.setMuted(next);
  };

  const modeMeta: Record<PlayStyle, { title: string; hint: string; badge: string }> = {
    sanctuary: {
      title: 'Capy Sanctuary',
      hint: 'WASD / Drag to roam • Walk into 3D Portals',
      badge: '🏝️',
    },
    spore: {
      title: 'Spore Lagoon',
      hint: 'Eat smaller critters & DNA • Space to Dash',
      badge: '🧬',
    },
    breakout: {
      title: 'Yuzu Breakout',
      hint: 'Slide pointer / A-D to bounce Yuzu balls',
      badge: '🧱',
    },
    runner: {
      title: 'Number Stampede',
      hint: 'Steer herd through + and × Math Gates',
      badge: '🏃',
    },
    fallguys: {
      title: 'Yuzu Mountain',
      hint: 'Dodge hammers & leap to the Golden Crown',
      badge: '🎪',
    },
  };
  const currentModeInfo = modeMeta[stats.selectedPlayStyle];

  return (
    <div className="relative w-full h-full bg-slate-950 overflow-hidden select-none font-sans">
      {/* 1. 3D WebGL Canvas Viewport (100% Unobstructed Center) */}
      <div
        ref={mountRef}
        onPointerDown={handleCanvasPointerDown}
        onPointerMove={handleCanvasPointerMove}
        onPointerUp={handleCanvasPointerUp}
        onPointerCancel={handleCanvasPointerUp}
        onWheel={handleCanvasWheel}
        className="absolute inset-0 w-full h-full z-0 cursor-grab active:cursor-grabbing"
      />

      {/* 2. Top Header HUD (Solid/RGBA surfaces without backdrop-filter for WebGL speed) */}
      <header className="absolute top-0 inset-x-0 z-20 flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 bg-slate-950/90 border-b border-slate-800/80 pointer-events-none">
        {/* Left: Switch to CapyPaint & CapyGame Title + Active Mode Banner + Live Mode Telemetry */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            onClick={onSwitchToPaint}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 text-xs font-bold transition active:scale-95"
            title="Switch to CapyPaint Color by Number"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>CapyPaint</span>
          </button>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-700">
            <span className="text-sm">{currentModeInfo.badge}</span>
            <div className="flex flex-col leading-tight">
              <span className="font-extrabold text-white text-xs tracking-wide">
                {currentModeInfo.title}
              </span>
              <span className="text-[10px] text-slate-400 hidden md:inline">
                {currentModeInfo.hint}
              </span>
            </div>
          </div>

          {/* Live Mode Telemetry Badge */}
          <div className="hidden sm:flex items-center gap-3 px-3 py-1 rounded-xl bg-slate-900 border border-slate-700/80 text-xs">
            <div>
              <span className="text-slate-400 mr-1">{telemetry.primaryLabel}:</span>
              <span className="font-black text-emerald-400">{telemetry.primaryValue}</span>
            </div>
            <span className="text-slate-700">|</span>
            <div>
              <span className="text-slate-400 mr-1">{telemetry.secondaryLabel}:</span>
              <span className="font-bold text-sky-300">{telemetry.secondaryValue}</span>
            </div>
            <span className="text-slate-700">|</span>
            <div className="text-amber-300 font-bold">×{telemetry.comboMultiplier} Mult</div>
          </div>
        </div>

        {/* Center Notification Toast */}
        {notification && (
          <div className="pointer-events-none px-3.5 py-1 rounded-full bg-amber-400 text-slate-950 text-xs font-extrabold shadow-md border border-amber-200 max-w-md truncate">
            {notification}
          </div>
        )}

        {/* Right: Unified Currencies (CapyCoins, Spore DNA, Prestige Karma) & Audio */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* CapyCoins & CPS */}
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-900 border border-amber-500/40"
            title="CapyCoins & Passive Sanctuary Income"
          >
            <span className="text-sm">🍊</span>
            <div className="flex flex-col leading-none">
              <span className="text-xs font-black text-amber-400">
                {Math.floor(stats.coins).toLocaleString()}
              </span>
              <span className="text-[10px] text-amber-200/80 font-semibold">
                +{cps}/s
              </span>
            </div>
          </div>

          {/* Spore DNA Helix Counter */}
          <div
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-900 border border-cyan-500/40"
            title="Spore Evolutionary DNA"
          >
            <Dna className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-xs font-black text-cyan-300">{stats.dna}</span>
          </div>

          {/* Prestige Level */}
          <div
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-900 border border-purple-500/40"
            title="Prestige Level & Global Multiplier"
          >
            <Crown className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-xs font-bold text-purple-300">
              Lvl {stats.prestigeLevel}
            </span>
          </div>

          {/* Gallery & Screenshots Button */}
          <button
            onClick={() => setIsGalleryOpen(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-amber-200 text-xs font-bold transition active:scale-95"
            title="Open Screenshot Showcase Gallery"
          >
            <Camera className="w-3.5 h-3.5 text-amber-300" />
            <span className="hidden sm:inline">Gallery</span>
          </button>

          {/* Mute Toggle */}
          <button
            onClick={toggleMute}
            className="p-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 hover:text-white transition active:scale-95"
            title={isMuted ? 'Unmute Synthesized Audio' : 'Mute Synthesized Audio'}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* 3. Mobile & Touch Action Controls */}
      <div className="absolute inset-x-4 bottom-32 z-10 flex justify-between pointer-events-none md:hidden">
        <div className="flex flex-col items-center gap-1 pointer-events-auto bg-slate-900/90 p-2 rounded-2xl border border-slate-700">
          <button
            onPointerDown={() => {
              if (managerRef.current) managerRef.current.moveInput.z = -1;
            }}
            onPointerUp={() => {
              if (managerRef.current) managerRef.current.moveInput.z = 0;
            }}
            className="w-10 h-10 rounded-xl bg-slate-800 text-white font-bold flex items-center justify-center active:bg-amber-500"
          >
            ▲
          </button>
          <div className="flex gap-2">
            <button
              onPointerDown={() => {
                if (managerRef.current) {
                  managerRef.current.pointerTargetX = null;
                  managerRef.current.moveInput.x = -1;
                }
              }}
              onPointerUp={() => {
                if (managerRef.current) managerRef.current.moveInput.x = 0;
              }}
              className="w-10 h-10 rounded-xl bg-slate-800 text-white font-bold flex items-center justify-center active:bg-amber-500"
            >
              ◀
            </button>
            <button
              onPointerDown={() => {
                if (managerRef.current) {
                  managerRef.current.pointerTargetX = null;
                  managerRef.current.moveInput.x = 1;
                }
              }}
              onPointerUp={() => {
                if (managerRef.current) managerRef.current.moveInput.x = 0;
              }}
              className="w-10 h-10 rounded-xl bg-slate-800 text-white font-bold flex items-center justify-center active:bg-amber-500"
            >
              ▶
            </button>
          </div>
          <button
            onPointerDown={() => {
              if (managerRef.current) managerRef.current.moveInput.z = 1;
            }}
            onPointerUp={() => {
              if (managerRef.current) managerRef.current.moveInput.z = 0;
            }}
            className="w-10 h-10 rounded-xl bg-slate-800 text-white font-bold flex items-center justify-center active:bg-amber-500"
          >
            ▼
          </button>
        </div>

        <div className="flex items-end pointer-events-auto">
          <button
            onClick={() => {
              if (managerRef.current) managerRef.current.isJumping = true;
            }}
            className="w-16 h-16 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex flex-col items-center justify-center shadow-lg active:scale-95"
          >
            <span>JUMP</span>
            <span className="text-[9px] font-bold opacity-80">/ DASH</span>
          </button>
        </div>
      </div>

      {/* 4. Unified Collapsible Bottom Control Dock (Zero Viewport Occlusion) */}
      <div
        className={`absolute bottom-3 left-1/2 -translate-x-1/2 z-20 w-[95vw] max-w-4xl transition-transform duration-300 ease-out ${
          isDockCollapsed ? 'translate-y-[calc(100%-2.1rem)]' : 'translate-y-0'
        }`}
      >
        {/* Collapse / Expand Handle */}
        <div className="flex justify-center -mb-px">
          <button
            onClick={() => setIsDockCollapsed((c) => !c)}
            className="flex items-center gap-1.5 px-4 py-1 rounded-t-xl bg-slate-900 border-t border-x border-slate-700 text-slate-300 hover:text-white text-[11px] font-bold shadow-lg"
          >
            {isDockCollapsed ? (
              <>
                <ChevronUp className="w-3.5 h-3.5 text-amber-400" />
                <span>Show Game Dock (H)</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5 text-amber-400" />
                <span>Hide Controls (H)</span>
              </>
            )}
          </button>
        </div>

        {/* Main Dock Panel */}
        <div className="bg-slate-900/95 border border-slate-700 rounded-2xl p-3 shadow-2xl">
          {/* Dock Navigation Bar */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2.5 gap-2">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              <button
                onClick={() => setActiveTab('modes')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                  activeTab === 'modes'
                    ? 'bg-amber-500 text-slate-950 shadow'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Play Styles (1-5)</span>
              </button>

              <button
                onClick={() => setActiveTab('build')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                  activeTab === 'build'
                    ? 'bg-amber-500 text-slate-950 shadow'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Hammer className="w-3.5 h-3.5" />
                <span>World Builder ({stats.buildings.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('dna')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                  activeTab === 'dna'
                    ? 'bg-cyan-400 text-slate-950 shadow'
                    : 'text-cyan-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Dna className="w-3.5 h-3.5" />
                <span>Spore DNA Lab ({stats.activeMutations.length}/6)</span>
              </button>

              <button
                onClick={() => setActiveTab('upgrades')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                  activeTab === 'upgrades'
                    ? 'bg-amber-500 text-slate-950 shadow'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Meta Upgrades</span>
              </button>

              <button
                onClick={() => setActiveTab('wardrobe')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                  activeTab === 'wardrobe'
                    ? 'bg-amber-500 text-slate-950 shadow'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>Wardrobe</span>
              </button>
            </div>

            <button
              onClick={handlePrestige}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-purple-600/30 hover:bg-purple-600/50 border border-purple-400/50 text-purple-200 text-xs font-bold transition active:scale-95 whitespace-nowrap"
              title="Ascend Prestige Level for permanent global reward multiplier"
            >
              <Crown className="w-3.5 h-3.5 text-purple-300" />
              <span>Ascend</span>
            </button>
          </div>

          {/* TAB 1: 5 SEAMLESS PLAY STYLES */}
          {activeTab === 'modes' && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <button
                onClick={() => handleSelectMode('sanctuary')}
                className={`p-2.5 rounded-xl border text-left transition ${
                  stats.selectedPlayStyle === 'sanctuary'
                    ? 'bg-emerald-950 border-emerald-400 text-emerald-200'
                    : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:border-slate-500'
                }`}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="font-extrabold text-xs">🏝️ Sanctuary</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                    Key 1
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 leading-tight">
                  3D Hub, Portals & Idle Builder (+{cps}/s)
                </div>
              </button>

              <button
                onClick={() => handleSelectMode('spore')}
                className={`p-2.5 rounded-xl border text-left transition ${
                  stats.selectedPlayStyle === 'spore'
                    ? 'bg-cyan-950 border-cyan-400 text-cyan-200'
                    : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:border-slate-500'
                }`}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="font-extrabold text-xs">🧬 Spore Evo</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-bold">
                    Key 2
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 leading-tight">
                  Eat, Grow & Mutate • Best: {stats.highScoreSpore}kg
                </div>
              </button>

              <button
                onClick={() => handleSelectMode('breakout')}
                className={`p-2.5 rounded-xl border text-left transition ${
                  stats.selectedPlayStyle === 'breakout'
                    ? 'bg-blue-950 border-blue-400 text-blue-200'
                    : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:border-slate-500'
                }`}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="font-extrabold text-xs">🧱 Breakout</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-bold">
                    Key 3
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 leading-tight">
                  Yuzu Multiball • Best: {stats.highScoreBreakout.toLocaleString()}
                </div>
              </button>

              <button
                onClick={() => handleSelectMode('runner')}
                className={`p-2.5 rounded-xl border text-left transition ${
                  stats.selectedPlayStyle === 'runner'
                    ? 'bg-amber-950 border-amber-400 text-amber-200'
                    : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:border-slate-500'
                }`}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="font-extrabold text-xs">🏃 Stampede</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">
                    Key 4
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 leading-tight">
                  Math Gate Herd • Best: {stats.highScoreRunner.toLocaleString()}
                </div>
              </button>

              <button
                onClick={() => handleSelectMode('fallguys')}
                className={`p-2.5 rounded-xl border text-left transition col-span-2 sm:col-span-1 ${
                  stats.selectedPlayStyle === 'fallguys'
                    ? 'bg-pink-950 border-pink-400 text-pink-200'
                    : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:border-slate-500'
                }`}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="font-extrabold text-xs">🎪 Parkour</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-pink-500/20 text-pink-300 font-bold">
                    Key 5
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 leading-tight">
                  Fall Guys Chaos • Crowns: {stats.highScoreFallGuys}
                </div>
              </button>
            </div>
          )}

          {/* TAB 2: SANCTUARY WORLD BUILDER & UPGRADES */}
          {activeTab === 'build' && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                {BUILDING_CATALOG.map((item) => {
                  const count = stats.buildings.filter((b) => b.type === item.type).length;
                  const nextCost = Math.round(item.baseCost * Math.pow(1.35, count));
                  return (
                    <div
                      key={item.type}
                      className="min-w-[210px] p-2 rounded-xl bg-slate-800/90 border border-slate-700 flex items-center justify-between gap-2"
                    >
                      <div>
                        <div className="text-xs font-bold text-white flex items-center gap-1">
                          <span>{item.icon}</span>
                          <span>{item.name}</span>
                          <span className="text-[10px] text-emerald-400">({count})</span>
                        </div>
                        <div className="text-[10px] text-slate-400">
                          +{item.baseCps} Coins/s
                        </div>
                      </div>
                      <button
                        onClick={() =>
                          handlePlaceBuilding(
                            item.type,
                            item.name,
                            item.baseCost,
                            item.baseCps,
                            item.description
                          )
                        }
                        className="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow active:scale-95 whitespace-nowrap"
                      >
                        {nextCost} 🍊
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Existing Buildings Quick-Upgrade Row */}
              {stats.buildings.length > 0 && (
                <div className="flex items-center gap-2 overflow-x-auto pt-1 border-t border-slate-800 no-scrollbar">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                    Upgrade Built:
                  </span>
                  {stats.buildings.map((b) => {
                    const upgCost = Math.round(b.cost * Math.pow(1.55, b.level));
                    return (
                      <button
                        key={b.id}
                        onClick={() => handleUpgradeExistingBuilding(b.id, b.name)}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-[11px] text-slate-200 font-semibold whitespace-nowrap transition active:scale-95"
                      >
                        {b.name} Lvl {b.level} → {upgCost} 🍊
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: SPORE EVOLUTION DNA MUTATION LAB */}
          {activeTab === 'dna' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {SPORE_MUTATIONS.map((mut) => {
                const isEquipped = stats.activeMutations.includes(mut.id);
                return (
                  <div
                    key={mut.id}
                    className={`p-2 rounded-xl border flex items-center justify-between gap-2 ${
                      isEquipped
                        ? 'bg-cyan-950/80 border-cyan-400'
                        : 'bg-slate-800/80 border-slate-700'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white truncate">
                        {mut.name}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">
                        {mut.description}
                      </div>
                    </div>
                    <button
                      onClick={() => handleToggleMutation(mut.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-extrabold whitespace-nowrap transition active:scale-95 ${
                        isEquipped
                          ? 'bg-emerald-400 text-slate-950'
                          : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950'
                      }`}
                    >
                      {isEquipped ? 'Active ✓' : `${mut.costDna} 🧬`}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 4: UNIFIED META UPGRADES */}
          {activeTab === 'upgrades' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(
                [
                  { key: 'speedBoost', label: '⚡ Speed & Agility' },
                  { key: 'coinMagnet', label: '🧲 Yuzu & DNA Magnet' },
                  { key: 'herdSize', label: '🦫 Starting Herd Size' },
                  { key: 'paddleSize', label: '🧱 Breakout Paddle Size' },
                  { key: 'bounciness', label: '🎪 Jump & Spring Power' },
                  { key: 'idleMultiplier', label: '✨ Sanctuary Yield' },
                ] as const
              ).map((u) => {
                const lvl = stats.upgrades[u.key];
                const cost = Math.round(90 * Math.pow(1.7, lvl - 1));
                return (
                  <div
                    key={u.key}
                    className="p-2 rounded-xl bg-slate-800/80 border border-slate-700 flex justify-between items-center gap-2"
                  >
                    <div>
                      <div className="text-xs font-bold text-white">{u.label}</div>
                      <div className="text-[10px] text-slate-400">Level {lvl}</div>
                    </div>
                    <button
                      onClick={() => handleBuyUpgrade(u.key)}
                      className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow active:scale-95 whitespace-nowrap"
                    >
                      {cost} 🍊
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 5: WARDROBE (HATS & FUR COAT SKINS) */}
          {activeTab === 'wardrobe' && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Hats:
                </span>
                {[
                  { id: 'yuzu', name: 'Onsen Yuzu', icon: '🍊' },
                  { id: 'crown', name: 'Royal Crown', icon: '👑' },
                  { id: 'flower', name: 'Lotus Blossom', icon: '🌸' },
                  { id: 'party', name: 'Party Cone', icon: '🎉' },
                  { id: 'wizard', name: 'Star Wizard', icon: '🧙' },
                  { id: 'halo', name: 'Angel Halo', icon: '😇' },
                ].map((hat) => (
                  <button
                    key={hat.id}
                    onClick={() => handleSelectHat(hat.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold whitespace-nowrap transition ${
                      stats.activeHat === hat.id
                        ? 'bg-amber-500/30 border-amber-400 text-amber-200'
                        : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    <span>{hat.icon}</span>
                    <span>{hat.name}</span>
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 overflow-x-auto pt-1 border-t border-slate-800 no-scrollbar">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Fur Coat:
                </span>
                {[
                  { id: 'classic', name: 'Warm Cocoa', dot: 'bg-amber-700' },
                  { id: 'golden', name: 'Golden Sun', dot: 'bg-yellow-400' },
                  { id: 'sakura', name: 'Sakura Pink', dot: 'bg-pink-400' },
                  { id: 'matcha', name: 'Zen Matcha', dot: 'bg-emerald-400' },
                  { id: 'cosmic', name: 'Cosmic Indigo', dot: 'bg-indigo-500' },
                ].map((skin) => (
                  <button
                    key={skin.id}
                    onClick={() => handleSelectSkin(skin.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold whitespace-nowrap transition ${
                      stats.activeSkin === skin.id
                        ? 'bg-amber-500/30 border-amber-400 text-amber-200'
                        : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    <span className={`w-2.5 h-2.5 rounded-full ${skin.dot}`} />
                    <span>{skin.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 5. Interactive Screenshot & Play Style Showcase Modal */}
      {isGalleryOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-5xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800">
              <div>
                <h2 className="text-base sm:text-lg font-extrabold text-white flex items-center gap-2">
                  <Camera className="w-5 h-5 text-amber-400" />
                  <span>Capy Suite Visual Showcase & Screenshots</span>
                </h2>
                <p className="text-xs text-slate-400">
                  Live WebGL captures across all 5 endless Play Styles, Spore DNA Lab, and CapyPaint Studio
                </p>
              </div>
              <button
                onClick={() => setIsGalleryOpen(false)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                {
                  src: './gallery/capygame_sanctuary.png',
                  title: '1. Capy Sanctuary (3D World Builder Hub)',
                  desc: 'Tropical island hub with 4 physical 3D World Portals, Cozy Onsens, Yuzu Orchards, Bouncy Mushroom Pads, and Sacred Capy Pagodas.',
                  mode: 'sanctuary' as PlayStyle,
                },
                {
                  src: './gallery/capygame_spore.png',
                  title: '2. Spore Lagoon (Evolution Simulator)',
                  desc: 'Swim, eat glowing plankton and DNA helixes, chomp smaller AI critters, and dynamically grow your Capybara in 3D.',
                  mode: 'spore' as PlayStyle,
                },
                {
                  src: './gallery/capygame_dna_lab.png',
                  title: '3. Spore DNA Mutation Lab',
                  desc: 'Equip 6 visible 3D body mutations: Aqua Flippers, Mighty Chomp Tusks, Armored Yuzu Shell, Celestial Glide Wings, Unicorn Prism Horn, and Bioluminescent Tail.',
                  mode: 'spore' as PlayStyle,
                },
                {
                  src: './gallery/capygame_breakout.png',
                  title: '4. Yuzu Breakout (3D Arcade Bumper)',
                  desc: 'Ricochet Golden Yuzu balls across endless 3D brick waves with Multi-Yuzu and Wide-Capy powerup capsules.',
                  mode: 'breakout' as PlayStyle,
                },
                {
                  src: './gallery/capygame_runner.png',
                  title: '5. Number Stampede (Math Gate Herd Runner)',
                  desc: 'Steer your visible 3D Capybara herd through + and x math gates and smash obstacle barrels.',
                  mode: 'runner' as PlayStyle,
                },
                {
                  src: './gallery/capygame_fallguys.png',
                  title: '6. Yuzu Mountain (Fall Guys Chaos Parkour)',
                  desc: 'Dodge spinning wipeout hammers, cross tilting see-saw bridges, and race AI rivals to the Golden Crown.',
                  mode: 'fallguys' as PlayStyle,
                },
              ].map((item) => (
                <div
                  key={item.src}
                  className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden flex flex-col"
                >
                  <img
                    src={item.src}
                    alt={item.title}
                    className="w-full h-48 object-cover bg-slate-900"
                  />
                  <div className="p-3 flex-1 flex flex-col justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-extrabold text-white">{item.title}</h3>
                      <p className="text-xs text-slate-400 mt-0.5">{item.desc}</p>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => {
                          handleSelectMode(item.mode);
                          setIsGalleryOpen(false);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold transition"
                      >
                        Launch Mode
                      </button>
                      <a
                        href={item.src}
                        download
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
                      >
                        Download PNG
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
