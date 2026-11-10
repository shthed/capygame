import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { PlayStyle, PlayerStats } from '../types';
import { ProgressionService } from '../services/ProgressionService';
import { AudioService } from '../services/AudioService';
import { PlayStyleManager } from '../engine/PlayStyleManager';
import {
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  ChevronUp,
  ChevronDown,
  Sparkles,
  Trophy,
  Hammer,
  Crown,
  ShoppingBag,
  Zap,
  ArrowLeft,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface CapyGameViewProps {
  onSwitchToPaint: () => void;
}

export const CapyGameView: React.FC<CapyGameViewProps> = ({ onSwitchToPaint }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const managerRef = useRef<PlayStyleManager | null>(null);

  // Persistence State
  const [stats, setStats] = useState<PlayerStats>(() => ProgressionService.loadStats());
  const [activeTab, setActiveTab] = useState<'modes' | 'build' | 'upgrades' | 'wardrobe'>('modes');
  const [isDockCollapsed, setIsDockCollapsed] = useState<boolean>(false);
  const [notification, setNotification] = useState<string>('Welcome to CapyGame 3D!');
  const [isMuted, setIsMuted] = useState<boolean>(() => AudioService.getMuted());
  const [cps, setCps] = useState<number>(() => ProgressionService.calculateTotalCps(stats));

  // Notification timeout
  const notifTimerRef = useRef<number | null>(null);
  const showNotification = useCallback((msg: string) => {
    setNotification(msg);
    if (notifTimerRef.current) window.clearTimeout(notifTimerRef.current);
    notifTimerRef.current = window.setTimeout(() => setNotification(''), 4000);
  }, []);

  // Sync CPS and Idle Coin ticker
  useEffect(() => {
    setCps(ProgressionService.calculateTotalCps(stats));
  }, [stats]);

  // Idle tick generator: earn coins from Sanctuary buildings every second
  useEffect(() => {
    const interval = window.setInterval(() => {
      const earned = ProgressionService.calculateTotalCps(stats);
      if (earned > 0) {
        setStats((prev) => ProgressionService.addCoins(prev, earned));
      }
    }, 1000);
    return () => window.clearInterval(interval);
  }, [stats]);

  // Handle PlayStyle switch
  const handleSelectMode = (mode: PlayStyle) => {
    if (managerRef.current) {
      managerRef.current.switchMode(mode);
    }
    const updated = { ...stats, selectedPlayStyle: mode };
    setStats(updated);
    ProgressionService.saveStats(updated);
  };

  // Keyboard navigation & game input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!managerRef.current) return;
      const key = e.key.toLowerCase();
      if (key === 'a' || key === 'arrowleft') {
        managerRef.current.moveInput.x = -1;
      } else if (key === 'd' || key === 'arrowright') {
        managerRef.current.moveInput.x = 1;
      } else if (key === 'w' || key === 'arrowup') {
        managerRef.current.moveInput.z = -1;
      } else if (key === 's' || key === 'arrowdown') {
        managerRef.current.moveInput.z = 1;
      } else if (key === ' ' || key === 'spacebar') {
        managerRef.current.isJumping = true;
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
  }, []);

  // Three.js Mount & Animation Loop
  useEffect(() => {
    if (!mountRef.current) return;

    const manager = new PlayStyleManager(mountRef.current, stats, {
      onScoreUpdate: (_score, coins) => {
        setStats((prev) => ProgressionService.addCoins(prev, coins));
      },
      onModeNotification: (msg) => {
        showNotification(msg);
      },
      onGameOver: (finalScore) => {
        showNotification(`Game Over! Final Score: ${finalScore}`);
      },
    });
    managerRef.current = manager;

    const clock = new THREE.Clock();
    let frameId = 0;

    const animate = () => {
      const delta = clock.getDelta();
      manager.tick(delta);
      frameId = requestAnimationFrame(animate);
    };
    frameId = requestAnimationFrame(animate);

    // Resize handler
    const handleResize = () => {
      if (mountRef.current) {
        manager.handleResize(
          mountRef.current.clientWidth,
          mountRef.current.clientHeight
        );
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', handleResize);
      manager.dispose();
      if (mountRef.current) {
        mountRef.current.innerHTML = '';
      }
    };
  }, []);

  // Update hat when changed
  const handleSelectHat = (hatId: string) => {
    const updated = { ...stats, activeHat: hatId };
    setStats(updated);
    ProgressionService.saveStats(updated);
    if (managerRef.current) {
      managerRef.current.updateStats(updated);
    }
    showNotification(`Equipped ${hatId.toUpperCase()}!`);
    AudioService.playCoin();
  };

  // Upgrades
  const handleBuyUpgrade = (key: keyof PlayerStats['upgrades']) => {
    const updated = ProgressionService.buyUpgrade(stats, key);
    if (updated) {
      setStats(updated);
      if (managerRef.current) managerRef.current.updateStats(updated);
      showNotification(`Upgraded ${String(key).toUpperCase()}!`);
      AudioService.playCoin();
    } else {
      showNotification('Not enough CapyCoins!');
    }
  };

  // Building placement in Sanctuary
  const handlePlaceBuilding = (
    type: 'hot_spring' | 'yuzu_orchard',
    name: string,
    cost: number,
    baseCps: number,
    desc: string
  ) => {
    const x = (Math.random() - 0.5) * 16;
    const z = (Math.random() - 0.5) * 16;
    const updated = ProgressionService.placeBuilding(
      stats,
      type,
      name,
      cost,
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
      showNotification(`Built ${name}! +${baseCps} Coins/sec`);
      AudioService.playSplash();
    } else {
      showNotification('Need more CapyCoins to build!');
    }
  };

  // Prestige
  const handlePrestige = () => {
    const updated = ProgressionService.prestige(stats);
    if (updated) {
      setStats(updated);
      if (managerRef.current) managerRef.current.updateStats(updated);
      confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
      AudioService.playPrestigeFanfare();
      showNotification(`Prestige Ascended to Level ${updated.prestigeLevel}!`);
    } else {
      showNotification('Earn more lifetime CapyCoins to ascend!');
    }
  };

  // Audio mute
  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    AudioService.setMuted(next);
  };

  return (
    <div className="relative w-full h-full bg-slate-950 overflow-hidden select-none font-sans">
      {/* 1. 3D WebGL Canvas Viewport (100% unobstructed) */}
      <div ref={mountRef} className="absolute inset-0 w-full h-full z-0 cursor-grab active:cursor-grabbing" />

      {/* 2. Top Header HUD */}
      <header className="absolute top-0 inset-x-0 z-20 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-slate-950/80 to-transparent pointer-events-none">
        {/* Left: Switch back to CapyPaint & CapyGame Logo */}
        <div className="flex items-center gap-3 pointer-events-auto">
          <button
            onClick={onSwitchToPaint}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 text-xs font-semibold backdrop-blur-sm transition active:scale-95 shadow-sm"
            title="Return to CapyPaint Color by Number"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>CapyPaint</span>
          </button>

          <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-900/80 border border-slate-700/60 shadow">
            <span className="text-base">🦫</span>
            <span className="font-extrabold text-white text-sm tracking-wide">CapyGame 3D</span>
          </div>
        </div>

        {/* Center: Live Notification Banner */}
        {notification && (
          <div className="pointer-events-none px-4 py-1.5 rounded-full bg-amber-500/90 text-slate-950 text-xs font-bold shadow-lg animate-fade-in border border-amber-300">
            {notification}
          </div>
        )}

        {/* Right: Currency & Prestige Counters */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* CapyCoins & CPS */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/90 border border-amber-500/30 shadow">
            <span className="text-base">🍊</span>
            <div className="flex flex-col">
              <span className="text-xs font-black text-amber-400">
                {stats.coins.toLocaleString()}
              </span>
              <span className="text-[10px] text-amber-300/70 font-medium">
                +{cps}/s
              </span>
            </div>
          </div>

          {/* Prestige Karma */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/90 border border-purple-500/30 shadow">
            <Crown className="w-4 h-4 text-purple-400" />
            <span className="text-xs font-bold text-purple-300">Lvl {stats.prestigeLevel}</span>
          </div>

          {/* Mute button */}
          <button
            onClick={toggleMute}
            className="p-2 rounded-xl bg-slate-900/80 border border-slate-700/60 text-slate-300 hover:text-white transition active:scale-95"
            title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* 3. Mobile Touch On-Screen Controls */}
      <div className="absolute inset-x-4 bottom-28 z-10 flex justify-between pointer-events-none md:hidden">
        {/* Left D-Pad */}
        <div className="flex flex-col items-center gap-1 pointer-events-auto bg-slate-900/60 backdrop-blur-sm p-2 rounded-2xl border border-slate-700/50">
          <button
            onPointerDown={() => { if (managerRef.current) managerRef.current.moveInput.z = -1; }}
            onPointerUp={() => { if (managerRef.current) managerRef.current.moveInput.z = 0; }}
            className="w-10 h-10 rounded-xl bg-slate-800 text-white font-bold flex items-center justify-center active:bg-amber-600"
          >
            ▲
          </button>
          <div className="flex gap-2">
            <button
              onPointerDown={() => { if (managerRef.current) managerRef.current.moveInput.x = -1; }}
              onPointerUp={() => { if (managerRef.current) managerRef.current.moveInput.x = 0; }}
              className="w-10 h-10 rounded-xl bg-slate-800 text-white font-bold flex items-center justify-center active:bg-amber-600"
            >
              ◀
            </button>
            <button
              onPointerDown={() => { if (managerRef.current) managerRef.current.moveInput.x = 1; }}
              onPointerUp={() => { if (managerRef.current) managerRef.current.moveInput.x = 0; }}
              className="w-10 h-10 rounded-xl bg-slate-800 text-white font-bold flex items-center justify-center active:bg-amber-600"
            >
              ▶
            </button>
          </div>
          <button
            onPointerDown={() => { if (managerRef.current) managerRef.current.moveInput.z = 1; }}
            onPointerUp={() => { if (managerRef.current) managerRef.current.moveInput.z = 0; }}
            className="w-10 h-10 rounded-xl bg-slate-800 text-white font-bold flex items-center justify-center active:bg-amber-600"
          >
            ▼
          </button>
        </div>

        {/* Jump Button */}
        <div className="flex items-end pointer-events-auto">
          <button
            onClick={() => { if (managerRef.current) managerRef.current.isJumping = true; }}
            className="w-14 h-14 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm flex items-center justify-center shadow-lg active:scale-95"
          >
            JUMP
          </button>
        </div>
      </div>

      {/* 4. Unified Collapsible Bottom Control Dock (Three.js Skill Standard) */}
      <div
        className={`absolute bottom-3 left-1/2 -translate-x-1/2 z-20 w-[94vw] max-w-3xl transition-transform duration-300 ease-out ${
          isDockCollapsed ? 'translate-y-[calc(100%-2.25rem)]' : 'translate-y-0'
        }`}
      >
        {/* Dock Drawer Header / Collapse Handle */}
        <div className="flex justify-center -mb-px">
          <button
            onClick={() => setIsDockCollapsed((c) => !c)}
            className="flex items-center gap-1 px-4 py-1 rounded-t-xl bg-slate-900/90 border-t border-x border-slate-700 text-slate-300 hover:text-white text-[11px] font-semibold backdrop-blur-md shadow-lg"
          >
            {isDockCollapsed ? (
              <>
                <ChevronUp className="w-3.5 h-3.5 text-amber-400" />
                <span>Show Controls</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5 text-amber-400" />
                <span>Hide Controls</span>
              </>
            )}
          </button>
        </div>

        {/* Main Dock Container */}
        <div className="bg-slate-900/95 border border-slate-700/80 rounded-2xl p-3 shadow-2xl backdrop-blur-lg">
          {/* Top Dock Tabs */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              <button
                onClick={() => setActiveTab('modes')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  activeTab === 'modes'
                    ? 'bg-amber-500 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Play Styles</span>
              </button>

              <button
                onClick={() => setActiveTab('build')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  activeTab === 'build'
                    ? 'bg-amber-500 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Hammer className="w-3.5 h-3.5" />
                <span>Sanctuary</span>
              </button>

              <button
                onClick={() => setActiveTab('upgrades')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  activeTab === 'upgrades'
                    ? 'bg-amber-500 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Upgrades</span>
              </button>

              <button
                onClick={() => setActiveTab('wardrobe')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  activeTab === 'wardrobe'
                    ? 'bg-amber-500 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>Wardrobe</span>
              </button>
            </div>

            {/* Prestige Button */}
            <button
              onClick={handlePrestige}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/50 text-purple-200 text-xs font-bold transition active:scale-95"
              title="Ascend & boost lifetime multiplier"
            >
              <Crown className="w-3.5 h-3.5 text-purple-400" />
              <span>Ascend</span>
            </button>
          </div>

          {/* Sub-Panel Contents */}
          {activeTab === 'modes' && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              <button
                onClick={() => handleSelectMode('sanctuary')}
                className={`p-2.5 rounded-xl border text-left transition ${
                  stats.selectedPlayStyle === 'sanctuary'
                    ? 'bg-emerald-950/60 border-emerald-500 text-emerald-300'
                    : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:border-slate-500'
                }`}
              >
                <div className="font-extrabold text-xs mb-0.5">🏝️ Sanctuary</div>
                <div className="text-[10px] text-slate-400 leading-tight">
                  Spore world builder & onsen relaxation
                </div>
              </button>

              <button
                onClick={() => handleSelectMode('breakout')}
                className={`p-2.5 rounded-xl border text-left transition ${
                  stats.selectedPlayStyle === 'breakout'
                    ? 'bg-blue-950/60 border-blue-500 text-blue-300'
                    : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:border-slate-500'
                }`}
              >
                <div className="font-extrabold text-xs mb-0.5">🧱 Breakout</div>
                <div className="text-[10px] text-slate-400 leading-tight">
                  3D Yuzu citrus melon arcade bumper
                </div>
              </button>

              <button
                onClick={() => handleSelectMode('runner')}
                className={`p-2.5 rounded-xl border text-left transition ${
                  stats.selectedPlayStyle === 'runner'
                    ? 'bg-amber-950/60 border-amber-500 text-amber-300'
                    : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:border-slate-500'
                }`}
              >
                <div className="font-extrabold text-xs mb-0.5">🏃 Stampede</div>
                <div className="text-[10px] text-slate-400 leading-tight">
                  Number gate multiplier math dash
                </div>
              </button>

              <button
                onClick={() => handleSelectMode('fallguys')}
                className={`p-2.5 rounded-xl border text-left transition ${
                  stats.selectedPlayStyle === 'fallguys'
                    ? 'bg-pink-950/60 border-pink-500 text-pink-300'
                    : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:border-slate-500'
                }`}
              >
                <div className="font-extrabold text-xs mb-0.5">🎪 Chaos Parkour</div>
                <div className="text-[10px] text-slate-400 leading-tight">
                  Fall Guys windmill & crown rush
                </div>
              </button>
            </div>
          )}

          {activeTab === 'build' && (
            <div className="flex items-center gap-3 overflow-x-auto py-1">
              <div className="flex-1 min-w-[200px] p-2 rounded-xl bg-slate-800/70 border border-slate-700 flex justify-between items-center">
                <div>
                  <div className="text-xs font-bold text-white">♨️ Cozy Onsen</div>
                  <div className="text-[10px] text-slate-400">+2 Coins/s</div>
                </div>
                <button
                  onClick={() =>
                    handlePlaceBuilding(
                      'hot_spring',
                      'Cozy Onsen',
                      80,
                      2,
                      'Warm bubbling mineral spring'
                    )
                  }
                  className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow active:scale-95"
                >
                  80 🍊
                </button>
              </div>

              <div className="flex-1 min-w-[200px] p-2 rounded-xl bg-slate-800/70 border border-slate-700 flex justify-between items-center">
                <div>
                  <div className="text-xs font-bold text-white">🌳 Yuzu Orchard</div>
                  <div className="text-[10px] text-slate-400">+5 Coins/s</div>
                </div>
                <button
                  onClick={() =>
                    handlePlaceBuilding(
                      'yuzu_orchard',
                      'Yuzu Tree',
                      180,
                      5,
                      'Golden fragrant citrus tree'
                    )
                  }
                  className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow active:scale-95"
                >
                  180 🍊
                </button>
              </div>
            </div>
          )}

          {activeTab === 'upgrades' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 py-1">
              <div className="p-2 rounded-xl bg-slate-800/70 border border-slate-700 flex justify-between items-center">
                <div>
                  <div className="text-xs font-bold text-white">⚡ Speed Boost</div>
                  <div className="text-[10px] text-slate-400">Lvl {stats.upgrades.speedBoost}</div>
                </div>
                <button
                  onClick={() => handleBuyUpgrade('speedBoost')}
                  className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow active:scale-95"
                >
                  {Math.round(100 * Math.pow(1.8, stats.upgrades.speedBoost - 1))} 🍊
                </button>
              </div>

              <div className="p-2 rounded-xl bg-slate-800/70 border border-slate-700 flex justify-between items-center">
                <div>
                  <div className="text-xs font-bold text-white">🧲 Coin Magnet</div>
                  <div className="text-[10px] text-slate-400">Lvl {stats.upgrades.coinMagnet}</div>
                </div>
                <button
                  onClick={() => handleBuyUpgrade('coinMagnet')}
                  className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow active:scale-95"
                >
                  {Math.round(100 * Math.pow(1.8, stats.upgrades.coinMagnet - 1))} 🍊
                </button>
              </div>

              <div className="p-2 rounded-xl bg-slate-800/70 border border-slate-700 flex justify-between items-center">
                <div>
                  <div className="text-xs font-bold text-white">✨ Idle Yield</div>
                  <div className="text-[10px] text-slate-400">Lvl {stats.upgrades.idleMultiplier}</div>
                </div>
                <button
                  onClick={() => handleBuyUpgrade('idleMultiplier')}
                  className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow active:scale-95"
                >
                  {Math.round(100 * Math.pow(1.8, stats.upgrades.idleMultiplier - 1))} 🍊
                </button>
              </div>
            </div>
          )}

          {activeTab === 'wardrobe' && (
            <div className="flex items-center gap-2 overflow-x-auto py-1">
              {[
                { id: 'yuzu', name: 'Onsen Yuzu', icon: '🍊' },
                { id: 'crown', name: 'Golden Crown', icon: '👑' },
                { id: 'flower', name: 'Lotus Flower', icon: '🌸' },
                { id: 'party', name: 'Party Cone', icon: '🎉' },
              ].map((hat) => (
                <button
                  key={hat.id}
                  onClick={() => handleSelectHat(hat.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold transition ${
                    stats.activeHat === hat.id
                      ? 'bg-amber-500/30 border-amber-400 text-amber-200'
                      : 'bg-slate-800/70 border-slate-700 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  <span>{hat.icon}</span>
                  <span>{hat.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
