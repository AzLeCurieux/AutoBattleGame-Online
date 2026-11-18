import {
  BOSSES,
  eliteBoss,
  PALIERS,
  RULES,
  bossRerollPrice,
  computeStats,
  forgePrice,
  healCost,
  runMode,
  silencedIndex,
  stageKind,
  type BossId,
  type EnemyInfo,
  type GameMode,
  type InventoryCase,
  type LeaderboardSnapshot,
  type ProfileStats,
  type PublicRunState,
  type PublicUser,
  type RunAction,
} from '@autobattle/shared';
import {
  Crown,
  FastForward,
  LogOut,
  Mountain,
  Pause,
  Play,
  RotateCcw,
  ScrollText,
  Skull,
  SkipForward,
  Swords,
  Tent,
  Trophy,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError, type ActResponse } from '../../common/api';
import { audio } from '../../common/audio';
import { avatarUrl } from '../../common/avatar';
import { caseMeta, cardMeta } from '../../common/catalog';
import { Navbar } from '../../common/Navbar';
import { logout } from '../../common/session';
import { DEFAULT_FX, levelPalette, type ShaderBackground } from '../../common/shader';
import { BOSS_THEME } from './bossTheme';
import { useSocketEvent } from '../../common/socket';
import { Tabs, useToast } from '../../ui/components';
import { ActTrack, BOSS_ICON, VictoryModal } from './acts';
import { JokerBar } from './jokers';
import { countProcs } from '../../common/procs';
import { Arena } from './arena';
import { useSoundtrack } from '../../common/MusicControl';
import { PackView, PACK_META, PerksPanel, PERK_META, ShopView } from './shop';
import {
  CampModal,
  CasesPanel,
  CharacterPanel,
  DefeatModal,
  HistoryModal,
  LeaderboardPanel,
  LogLine,
  MODE_INFO,
  NewRunModal,
  OnlinePanel,
  PassivesPanel,
  ProfileModal,
  UpgradeModal,
  upgradeInfo,
  type HistoryEntry,
  type HistoryKind,
} from './panels';

type ModalName = 'victory' | 'camp' | 'upgrade' | 'shop' | 'pack' | 'history' | 'profile' | 'newRun' | 'defeat' | null;
type Speed = '1' | '2' | '4';
const MAX_HISTORY = 150;
const pad = (n: number) => String(n).padStart(2, '0');
const fmt = (n: number) => n.toLocaleString('fr-FR');
const readSpeed = (): Speed => {
  try {
    const v = localStorage.getItem('ab:speed');
    return v === '2' || v === '4' ? v : '1';
  } catch {
    return '1';
  }
};

export function GamePage({ initialUser, shader }: { initialUser: PublicUser; shader: ShaderBackground }) {
  const toast = useToast();
  const [user, setUser] = useState(initialUser);
  const [run, setRun] = useState<PublicRunState | null>(null);
  const [cases, setCases] = useState<InventoryCase[]>([]);
  const [snapshot, setSnapshot] = useState<LeaderboardSnapshot | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [modal, setModal] = useState<ModalName>(null);
  const [fighting, setFighting] = useState(false);
  const [paused, setPaused] = useState(false);
  const [busy, setBusy] = useState(false);
  const [enemy, setEnemy] = useState<EnemyInfo | null>(null);
  const [shownLevel, setShownLevel] = useState(0);
  const [speed, setSpeed] = useState<Speed>(readSpeed);
  const [muted, setMuted] = useState(!audio.enabled);
  const [profileStats, setProfileStats] = useState<ProfileStats | null>(null);
  const [unlockedPalier, setUnlockedPalier] = useState<number | null>(null);
  const [bests, setBests] = useState<Record<GameMode, number>>({ deck: initialUser.bestLevel, classic: 0 });

  const arenaRef = useRef<Arena | null>(null);
  const runRef = useRef(run);
  runRef.current = run;
  const busyRef = useRef(false);
  const el = {
    arena: useRef<HTMLDivElement>(null),
    fx: useRef<HTMLDivElement>(null),
    player: useRef<HTMLDivElement>(null),
    enemy: useRef<HTMLDivElement>(null),
    playerFill: useRef<HTMLSpanElement>(null),
    playerText: useRef<HTMLDivElement>(null),
    enemyFill: useRef<HTMLSpanElement>(null),
    enemyText: useRef<HTMLDivElement>(null),
    jokers: useRef<HTMLDivElement>(null),
  };

  const log = useCallback((kind: HistoryKind, message: string) => {
    const time = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setHistory((h) => [...h, { kind, message, time }].slice(-MAX_HISTORY));
  }, []);

  const paintPlayer = useCallback((state: PublicRunState) => {
    arenaRef.current?.setPlayerHealth(state.hp, computeStats(state).maxHp);
  }, []);

  /**
   * Background + arena border follow the level (getLevelBackgroundColors of v1),
   * or the boss's own theme (colours and swirl) when one is involved.
   */
  const tintForLevel = useCallback(
    (level: number, bossId: BossId | null = null) => {
      const theme = bossId ? BOSS_THEME[bossId] : null;
      const palette = theme?.palette ?? levelPalette(level);
      shader.setColors(...palette);
      shader.setFx(theme?.fx ?? DEFAULT_FX);
      const arena = el.arena.current;
      if (arena) {
        const edge = theme ? palette[0] : palette[1];
        const [r, g, b] = [edge.r, edge.g, edge.b].map((v) => Math.round(v * 255));
        arena.style.setProperty('--arena-border', `rgba(${r}, ${g}, ${b}, 0.45)`);
        arena.style.setProperty('--arena-glow', `rgba(${r}, ${g}, ${b}, 0.18)`);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refs are stable
    [shader],
  );

  // ------------------------------------------------------------------ boot

  useEffect(() => {
    const r = el;
    const arena = new Arena({
      arena: r.arena.current!,
      fx: r.fx.current!,
      player: r.player.current!,
      enemy: r.enemy.current!,
      playerFill: r.playerFill.current!,
      playerText: r.playerText.current!,
      enemyFill: r.enemyFill.current!,
      enemyText: r.enemyText.current!,
      jokers: () => r.jokers.current,
    });
    arena.speed = Number(readSpeed());
    arenaRef.current = arena;
    arena.enemyIdle();

    void api.run().then((state) => {
      setRun(state);
      setShownLevel(state.level);
      paintPlayer(state);
      if (state.phase === 'upgrade') setModal('upgrade');
      else if (state.phase === 'shop') setModal('shop');
      else if (state.phase === 'pack') setModal('pack');
      else if (state.phase === 'dead') arena.playerDie();
    });
    void api.inventory().then((inv) => setCases(inv.cases));
    void api.leaderboard().then(setSnapshot);
    void api.stats().then((s) => {
      setProfileStats(s);
      setBests({ deck: s.bestLevel, classic: s.bestLevelClassic });
    });
    log('start', 'Session démarrée');
    return () => arena.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useSocketEvent('leaderboard:update', setSnapshot);
  useSocketEvent('inventory:sync', () => void api.inventory().then((inv) => setCases(inv.cases)));
  useSocketEvent('run:sync', () => {
    const arena = arenaRef.current;
    if (arena?.isFighting || arena?.isPaused || busyRef.current) return;
    void api.run().then((state) => {
      setRun(state);
      setShownLevel(state.level);
      paintPlayer(state);
    });
  });

  // --------------------------------------------------------------- actions

  const act = useCallback(
    async (action: RunAction): Promise<ActResponse | null> => {
      busyRef.current = true;
      setBusy(true);
      try {
        return await api.act(action);
      } catch (err) {
        toast({ title: 'Action impossible', text: err instanceof ApiError ? err.message : 'Erreur de connexion', icon: Skull, color: 'var(--danger)' });
        return null;
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [toast],
  );

  const onVictory = useCallback(
    (res: ActResponse) => {
      const state = res.state;
      const reward = res.fight?.reward;
      arenaRef.current?.enemyDie();
      setFighting(false);
      setRun(state);
      paintPlayer(state);
      if (reward) log('gold', `Victoire · +${reward.gold} or (total ${fmt(state.gold)})`);
      if (reward && reward.healed > 0) log('heal', `Soin après victoire · +${fmt(reward.healed)} PV`);

      const mode = runMode(state);
      if (res.newBest) {
        setBests((b) => ({ ...b, [mode]: state.level }));
        log('record', `Nouveau record (${MODE_INFO[mode].label}) · niveau ${state.level + 1}`);
        toast({ title: 'Nouveau record', text: `Niveau ${state.level + 1} en mode ${MODE_INFO[mode].label}`, icon: Trophy, color: '#fbbf24' });
      }
      if (reward && reward.cases.length > 0) {
        const groups = new Map<string, number>();
        for (const c of reward.cases) groups.set(c.caseId, (groups.get(c.caseId) ?? 0) + 1);
        for (const [caseId, n] of groups) {
          const meta = caseMeta(caseId);
          log('case', `${meta.name} ×${n}`);
          toast({ title: `${meta.name} ×${n}`, text: 'Ajoutée à ton inventaire', image: meta.image, color: meta.color, duration: 5000 });
        }
      }
      if (reward?.actCleared) {
        log('boss', `Acte ${reward.actCleared} terminé`);
        if (!reward.victory) toast({ title: `Acte ${reward.actCleared} terminé`, text: 'Un nouveau boss t’attend au bout du prochain acte.', icon: Crown, color: '#fbbf24' });
      }
      if (reward?.victory) log('record', 'Partie gagnée · mode infini débloqué');
      const unlocked = res.palierUnlocked ?? null;
      setUnlockedPalier(unlocked);
      if (unlocked) {
        setProfileStats((s) => (s ? { ...s, palierUnlocked: Math.max(s.palierUnlocked, unlocked) } : s));
        log('record', `Palier ${unlocked} débloqué`);
      }
      setTimeout(() => setModal(reward?.victory ? 'victory' : 'upgrade'), reward?.victory ? 900 : 450);
    },
    [log, paintPlayer, toast],
  );

  const onDefeat = useCallback(
    (res: ActResponse) => {
      arenaRef.current?.playerDie();
      setFighting(false);
      setRun(res.state);
      shader.reset();
      shader.disableAnimation();
      log('death', `Défaite au niveau ${res.state.level + 1}`);
      setTimeout(() => setModal('defeat'), 700);
    },
    [log, shader],
  );

  const fight = useCallback(async () => {
    const arena = arenaRef.current;
    const state = runRef.current;
    if (!arena || !state || arena.isFighting || busyRef.current) return;
    if (arena.isPaused) {
      arena.resume();
      setPaused(false);
      setFighting(true);
      shader.enableAnimation();
      return;
    }
    if (state.phase === 'dead') return setModal('newRun');
    if (state.phase === 'upgrade') return setModal('upgrade');
    if (state.phase === 'shop') return setModal('shop');
    if (state.phase === 'pack') return setModal('pack');

    const res = await act({ type: 'fight' });
    if (!res?.fight) return;
    const stage = state.level + 1;
    setEnemy(res.fight.enemy);
    setShownLevel(stage);
    const kind = res.fight.enemy.kind;
    const bossName = res.fight.enemy.bossId ? BOSSES[res.fight.enemy.bossId].name : 'boss';
    log(kind === 'normal' ? 'level' : 'boss', `Niveau ${pad(stage)}${kind === 'boss' ? ` · ${bossName}` : kind === 'elite' ? ' · élite' : ''}`);
    if (res.fight.restHp > 0) log('heal', `Repos avant le boss · +${res.fight.restHp.toLocaleString('fr-FR')} PV`);
    const clutch = res.fight.events.some((e) => e.type === 'clutch');
    // One history line per fight: which cards triggered and how often.
    const logProcs = () => {
      const counts = countProcs(res.fight!.events, res.fight!.reward);
      if (counts.size === 0) return;
      const parts = [...counts]
        .sort((a, b) => a[0] - b[0])
        .map(([slot, n]) => `${cardMeta(state.deck[slot]?.cardId ?? '')?.name ?? 'Carte'} ×${n}`);
      log('card', `Déclenchements · ${parts.join(' · ')}`);
    };
    arena.enemyEnter();
    tintForLevel(stage, res.fight.enemy.bossId ?? null);
    shader.enableAnimation();
    setFighting(true);
    arena.play(res.fight, computeStats(state, res.fight.enemy.stage).maxHp, {
      onVictory: () => {
        logProcs();
        arena.showProcs(res.fight!.reward?.procs);
        if (clutch) log('boss', 'Sursis : tu as tenu à 1 PV et achevé le boss');
        onVictory(res);
      },
      onDefeat: () => {
        logProcs();
        if (clutch) log('boss', 'Sursis épuisé : le boss a tenu bon');
        onDefeat(res);
      },
    });
  }, [act, log, onDefeat, onVictory, shader, tintForLevel]);

  const pause = useCallback(() => {
    const arena = arenaRef.current;
    if (!arena?.isFighting) return;
    arena.pause();
    setPaused(true);
    setFighting(false);
    shader.disableAnimation();
  }, [shader]);

  const skip = useCallback(() => {
    setPaused(false);
    arenaRef.current?.skip();
  }, []);

  const startRun = useCallback(
    async (mode: GameMode, palier?: number) => {
      const res = await act({ type: 'newRun', mode, ...(mode === 'deck' && palier ? { palier } : {}) });
      if (!res) return;
      const arena = arenaRef.current!;
      arena.abort();
      arena.enemyIdle();
      arena.playerReset();
      setFighting(false);
      setPaused(false);
      setEnemy(null);
      setRun(res.state);
      setShownLevel(0);
      paintPlayer(res.state);
      shader.reset();
      shader.disableAnimation();
      setModal(null);
      log('start', `Nouvelle partie · mode ${MODE_INFO[mode].label}${mode === 'deck' ? ` · palier ${res.state.palier ?? 1}` : ''}`);
    },
    [act, log, paintPlayer, shader],
  );

  const heal = useCallback(async () => {
    const before = runRef.current;
    const res = await act({ type: 'heal' });
    if (!res || !before) return;
    setRun(res.state);
    paintPlayer(res.state);
    audio.play('heal');
    log('heal', `Soin complet · ${fmt(before.hp)} → ${fmt(res.state.hp)} PV (${healCost(before)} or)`);
  }, [act, log, paintPlayer]);

  const chooseUpgrade = useCallback(
    async (index: number) => {
      const before = runRef.current;
      const offer = before?.offer?.[index];
      if (!before || !offer) return;
      const res = await act({ type: 'chooseUpgrade', index });
      if (!res) return;
      const info = upgradeInfo(offer, runMode(before));
      const kind: HistoryKind = offer.kind === 'bossPassive' ? 'passive' : offer.kind === 'fullHeal' ? 'heal' : 'upgrade';
      log(kind, offer.kind === 'bossPassive' ? `Passif obtenu · ${info.title}` : `${info.title}${info.value ? ` ${info.value}` : ''}`);
      setRun(res.state);
      paintPlayer(res.state);
      setModal(res.state.phase === 'shop' ? 'shop' : null);
      if (res.state.phase === 'shop' && res.state.shop && res.state.shop.interest > 0) {
        log('gold', `Intérêts · +${res.state.shop.interest} or`);
      }
    },
    [act, log, paintPlayer],
  );

  const buy = useCallback(
    async (index: number) => {
      const item = runRef.current?.shop?.cards[index];
      const res = await act({ type: 'shopBuy', index });
      if (!res || !item) return;
      setRun(res.state);
      paintPlayer(res.state);
      log('shop', `${cardMeta(item.cardId)?.name ?? 'Carte'} achetée · -${item.price} or`);
    },
    [act, log, paintPlayer],
  );

  const sell = useCallback(
    async (index: number) => {
      const before = runRef.current;
      const res = await act({ type: 'shopSell', index });
      if (!res || !before) return;
      setRun(res.state);
      paintPlayer(res.state);
      log('shop', `${cardMeta(before.deck[index]?.cardId ?? '')?.name ?? 'Carte'} vendue · +${res.state.gold - before.gold} or`);
    },
    [act, log, paintPlayer],
  );

  const moveCard = useCallback(
    async (from: number, to: number) => {
      const res = await act({ type: 'deckMove', from, to });
      if (res) setRun(res.state);
    },
    [act],
  );

  const reroll = useCallback(async () => {
    const before = runRef.current;
    const res = await act({ type: 'shopReroll' });
    if (!res || !before) return;
    setRun(res.state);
    log('shop', `Relance des cartes · ${before.gold - res.state.gold} or`);
  }, [act, log]);

  const buyPack = useCallback(
    async (index: number) => {
      const offer = runRef.current?.shop?.packs[index];
      const res = await act({ type: 'shopBuyPack', index });
      if (!res || !offer) return;
      setRun(res.state);
      log('shop', `${PACK_META[offer.kind].name} ouvert · ${offer.price} or`);
      setModal('pack');
    },
    [act, log],
  );

  const buyPerk = useCallback(async () => {
    const offer = runRef.current?.shop?.perk;
    const res = await act({ type: 'shopBuyPerk' });
    if (!res || !offer) return;
    setRun(res.state);
    paintPlayer(res.state);
    log('upgrade', `Amélioration acquise · ${PERK_META[offer.perk].name}`);
  }, [act, log, paintPlayer]);

  const forge = useCallback(async () => {
    const price = runRef.current ? forgePrice(runRef.current) : 0;
    const res = await act({ type: 'shopForge' });
    if (!res) return;
    setRun(res.state);
    paintPlayer(res.state);
    log('upgrade', `Forge · +8 % de dégâts (${res.state.forge} au total) · ${price} or`);
  }, [act, log, paintPlayer]);

  const bossReroll = useCallback(async () => {
    const price = runRef.current ? bossRerollPrice(runRef.current) : 0;
    const res = await act({ type: 'bossReroll' });
    if (!res) return;
    setRun(res.state);
    const next = res.state.nextBoss ? BOSSES[res.state.nextBoss].name : '?';
    log('shop', `Boss changé : ${next} · ${price} or`);
  }, [act, log]);

  const pickFromPack = useCallback(
    async (index: number) => {
      const res = await act({ type: 'packPick', index });
      if (!res) return;
      setRun(res.state);
      paintPlayer(res.state);
      if (res.state.phase === 'shop') setModal('shop');
    },
    [act, paintPlayer],
  );

  const skipPack = useCallback(async () => {
    const res = await act({ type: 'packSkip' });
    if (res) setRun(res.state);
    setModal('shop');
  }, [act]);

  const leaveShop = useCallback(async () => {
    const res = await act({ type: 'shopLeave' });
    if (res) setRun(res.state);
    setModal(null);
  }, [act]);

  const changeSpeed = (v: Speed) => {
    setSpeed(v);
    if (arenaRef.current) arenaRef.current.speed = Number(v);
    try {
      localStorage.setItem('ab:speed', v);
    } catch {
      /* storage unavailable: speed just isn't remembered */
    }
  };

  const openProfile = () => {
    void api.stats().then(setProfileStats);
    setModal('profile');
  };

  // ------------------------------------------------------------- keyboard

  const keys = useRef({ fight, pause, modal });
  keys.current = { fight, pause, modal };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      if (e.ctrlKey && e.key.toLowerCase() === 'm') {
        e.preventDefault();
        setMuted(!audio.toggle());
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey || keys.current.modal) return;
      const k = e.key.toLowerCase();
      if (k === ' ' || k === 'enter') {
        e.preventDefault();
        void keys.current.fight();
      } else if (k === 'p') keys.current.pause();
      else if (k === 'c') setModal('camp');
      else if (k === 'h') setModal('history');
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // --------------------------------------------------------------- render

  const mode: GameMode = run ? runMode(run) : 'deck';
  const ModeIcon = MODE_INFO[mode].icon;
  const inFight = fighting || paused;
  const shownStage = inFight ? shownLevel : shownLevel + 1;
  const enemyKind = inFight ? (enemy?.kind ?? 'normal') : stageKind(shownLevel + 1, mode);
  const bossBadge = enemyKind === 'boss';
  // Tier 3+: the act's elite carries a boss effect too, announced before the fight.
  const eliteFx = mode === 'deck' && enemyKind === 'elite' ? (inFight ? (enemy?.bossId ?? null) : run ? eliteBoss(run) : null) : null;
  const bossInfo =
    mode !== 'deck' ? null : bossBadge && run?.nextBoss ? BOSSES[inFight && enemy?.bossId ? enemy.bossId : run.nextBoss] : eliteFx ? BOSSES[eliteFx] : null;
  const palier = run?.palier ?? 1;
  // Waiting in front of a boss (or an elite with a boss effect): its theme already fills the screen.
  const previewBoss = !inFight && run && run.phase !== 'dead' && bossInfo ? bossInfo.id : null;
  const previewRef = useRef<BossId | null>(null);
  useEffect(() => {
    if (previewBoss) tintForLevel(shownStage, previewBoss);
    else if (previewRef.current && !inFight) tintForLevel(shownStage);
    previewRef.current = previewBoss;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to the previewed boss changing
  }, [previewBoss]);
  const BossIcon = bossInfo ? BOSS_ICON[bossInfo.id] : Crown;
  // Soundtrack follows the situation: shop, booster, boss, final boss (act 8+), victory.
  const finalStage = RULES.acts.winAct * RULES.acts.length;
  const track =
    modal === 'victory'
      ? 'celestial'
      : run?.phase === 'pack'
        ? 'arcana'
        : run?.phase === 'shop'
          ? 'shop'
          : bossBadge && run?.phase !== 'dead'
            ? mode === 'deck' && shownStage >= finalStage
              ? 'celestial'
              : 'boss'
            : 'main';
  useSoundtrack(track, muted);
  const dead = run?.phase === 'dead';
  const pending = run?.phase === 'upgrade' || run?.phase === 'shop' || run?.phase === 'pack';
  const fightLabel = fighting ? 'Combat en cours' : paused ? 'Reprendre' : dead ? 'Nouvelle partie' : pending ? 'Choix en attente' : 'Combattre';
  const FightIcon = paused ? Play : dead ? RotateCcw : Swords;

  return (
    <>
      <Navbar
        page="home"
        userInfo={
          <div className="nav-user">
            <img src={avatarUrl(user.avatar, user.username)} alt="" />
            <button className="name" onClick={openProfile} title="Profil">
              {user.username}
            </button>
            <button
              className="btn btn-sm btn-ghost btn-icon"
              title={muted ? 'Activer le son (Ctrl+M)' : 'Couper le son (Ctrl+M)'}
              onClick={() => setMuted(!audio.toggle())}
            >
              {muted ? <VolumeX className="icon" /> : <Volume2 className="icon" />}
            </button>
            <button className="btn btn-sm btn-ghost btn-icon" title="Déconnexion" onClick={() => void logout()}>
              <LogOut className="icon" />
            </button>
          </div>
        }
      />

      <main className="page game-layout">
        <div className="game-col left">
          <CharacterPanel run={run} />
          <PassivesPanel run={run} />
          <PerksPanel run={run} />
        </div>

        <div className="game-col center">
          <section className="panel arena-panel">
            <div className="arena-head">
              <div className="level-title">
                <small>Niveau</small>
                {pad(shownStage)}
              </div>
              {enemyKind !== 'normal' && (
                <span className="badge badge-boss">
                  {bossBadge ? <Crown className="icon" /> : <Skull className="icon" />} {bossBadge ? 'Boss' : 'Élite'}
                </span>
              )}
              <span className="badge" title={MODE_INFO[mode].description}>
                <ModeIcon className="icon" /> {MODE_INFO[mode].label}
              </span>
              {mode === 'deck' && (
                <span className="badge badge-palier" title={PALIERS.filter((p) => p.level <= palier).map((p) => `${p.name} : ${p.text}`).join('\n')}>
                  <Mountain className="icon" /> Palier {palier}
                </span>
              )}
              <span className="badge badge-accent" title={`Record en mode ${MODE_INFO[mode].label}`}>
                <Trophy className="icon" /> {bests[mode] + 1}
              </span>
              <span className="spacer" />
              <span className="muted" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                <FastForward className="icon" /> Vitesse
              </span>
              <Tabs value={speed} onChange={changeSpeed} options={[['1', '×1'], ['2', '×2'], ['4', '×4']] as const} />
            </div>

            {run && mode === 'deck' && <ActTrack run={run} stage={shownStage} fighting={inFight} />}

            <div className="arena" ref={el.arena}>
              <div className="fighter player" ref={el.player}>
                <div className="tag">{user.username}</div>
                <div className="token">
                  <img src={avatarUrl(user.avatar, user.username)} alt="" />
                </div>
                <div className="hp">
                  <div className="bar">
                    <span ref={el.playerFill} />
                  </div>
                  <div className="hp-text" ref={el.playerText}>
                    -
                  </div>
                </div>
              </div>

              <div className={`fighter enemy ${inFight ? enemyKind : 'waiting'}`} ref={el.enemy}>
                <div className="tag">
                  {bossInfo ? (enemyKind === 'elite' ? `Élite · ${bossInfo.name}` : bossInfo.name) : enemyKind === 'boss' ? 'Boss' : enemyKind === 'elite' ? 'Élite' : inFight ? 'Ennemi' : 'Prochain ennemi'}
                </div>
                <div className="token">{bossBadge || eliteFx ? <BossIcon className="icon" /> : <Skull className="icon" />}</div>
                <div className="hp" style={{ visibility: inFight ? 'visible' : 'hidden' }}>
                  <div className="bar">
                    <span ref={el.enemyFill} />
                  </div>
                  <div className="hp-text" ref={el.enemyText}>
                    -
                  </div>
                </div>
              </div>
              <div className="fx" ref={el.fx} />
              {bossInfo && inFight && !paused && (
                <div className="arena-status">
                  <span className="badge badge-boss">
                    <BossIcon className="icon" /> {bossInfo.text}
                  </span>
                </div>
              )}
              {paused && (
                <div className="arena-status">
                  <span className="badge">
                    <Pause className="icon" /> En pause
                  </span>
                </div>
              )}
            </div>

            {run && mode === 'deck' && (
              <JokerBar ref={el.jokers} run={run} silenced={inFight && enemy?.bossId === 'silencer' ? silencedIndex(run.deck) : -1} />
            )}

            <div className="controls">
              <button className="btn btn-primary btn-lg" disabled={fighting || busy} onClick={() => void fight()}>
                <FightIcon className="icon" /> {fightLabel}
                {!fighting && <span className="kbd">Espace</span>}
              </button>
              {fighting ? (
                <button className="btn btn-lg" onClick={pause} title="Pause (P)">
                  <Pause className="icon" /> Pause
                </button>
              ) : (
                <button className="btn btn-lg" disabled={!paused} onClick={skip} title="Terminer le combat sans animation">
                  <SkipForward className="icon" /> Passer
                </button>
              )}
              <button className="btn btn-lg" disabled={inFight} onClick={() => setModal('camp')} title="Camp (C)">
                <Tent className="icon" /> Camp
              </button>
              <button className="btn btn-lg btn-danger" disabled={fighting || busy} onClick={() => setModal('newRun')}>
                <RotateCcw className="icon" /> Recommencer
              </button>
            </div>

            <div className="log-strip">
              <div className="text">
                {history.length > 0 ? <LogLine entry={history[history.length - 1]!} /> : <span className="muted">Aucun événement</span>}
              </div>
              {fighting && (
                <button className="btn btn-sm" onClick={skip} title="Passer l’animation">
                  <SkipForward className="icon" /> Passer
                </button>
              )}
              <button className="btn btn-sm" onClick={() => setModal('history')} title="Historique (H)">
                <ScrollText className="icon" /> Historique
              </button>
            </div>
          </section>
        </div>

        <div className="game-col right">
          <LeaderboardPanel key={mode} snapshot={snapshot} userId={user.id} mode={mode} />
          <OnlinePanel snapshot={snapshot} userId={user.id} />
          <CasesPanel cases={cases} />
        </div>
      </main>

      <CampModal open={modal === 'camp'} run={run} busy={busy} onClose={() => setModal(null)} onHeal={() => void heal()} />
      <UpgradeModal open={modal === 'upgrade'} offer={run?.offer ?? null} mode={run ? runMode(run) : 'deck'} busy={busy} onChoose={(i) => void chooseUpgrade(i)} />
      <ShopView
        open={modal === 'shop'}
        run={run}
        busy={busy}
        onBuy={(i) => void buy(i)}
        onSell={(i) => void sell(i)}
        onMove={(a, b) => void moveCard(a, b)}
        lastAction={history.at(-1)?.message}
        onReroll={() => void reroll()}
        onBuyPack={(i) => void buyPack(i)}
        onBuyPerk={() => void buyPerk()}
        onForge={() => void forge()}
        onBossReroll={() => void bossReroll()}
        onLeave={() => void leaveShop()}
      />
      <PackView
        open={modal === 'pack'}
        run={run}
        busy={busy}
        onPick={(i) => void pickFromPack(i)}
        onSkip={() => void skipPack()}
        onSell={(i) => void sell(i)}
        onMove={(a, b) => void moveCard(a, b)}
      />
      <HistoryModal open={modal === 'history'} history={history} onClose={() => setModal(null)} onClear={() => setHistory([])} />
      <NewRunModal open={modal === 'newRun'} run={run} busy={busy} onClose={() => setModal(null)} palierUnlocked={profileStats?.palierUnlocked ?? 1} onStart={(m, p) => void startRun(m, p)} />
      <DefeatModal open={modal === 'defeat'} run={run} best={bests[mode]} onClose={() => setModal(null)} onNewRun={() => setModal('newRun')} />
      <VictoryModal open={modal === 'victory'} run={run} unlocked={unlockedPalier} onContinue={() => setModal('upgrade')} />
      <ProfileModal
        open={modal === 'profile'}
        user={user}
        stats={profileStats}
        onClose={() => setModal(null)}
        onSaveAvatar={async (avatar) => setUser(await api.setAvatar(avatar))}
      />
    </>
  );
}
