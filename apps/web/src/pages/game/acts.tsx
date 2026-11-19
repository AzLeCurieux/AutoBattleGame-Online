import { actOf, BOSSES, eliteBoss, PALIERS, RULES, stageKind, type BossId, type PublicRunState } from '@autobattle/shared';
import type { LucideIcon } from 'lucide-react';
import { Asterisk, Ban, Crown, Droplet, Flame, HandCoins, Infinity as InfinityIcon, Mountain, Shield, Skull, Swords, Trophy, VolumeX, Zap } from 'lucide-react';
import { caseMeta } from '../../common/catalog';
import { NODE_META } from './route';
import { cssVars, Modal } from '../../ui/components';

export const BOSS_ICON: Record<BossId, LucideIcon> = {
  colossus: Mountain,
  thief: HandCoins,
  swift: Zap,
  berserk: Flame,
  armored: Shield,
  stoic: Ban,
  silencer: VolumeX,
  vampire: Droplet,
  thorns: Asterisk,
};

/** Progress inside the current act: 10 stages, elite at 5, boss at 10, plus the boss preview. */
export function ActTrack({ run, stage, fighting }: { run: PublicRunState; stage: number; fighting: boolean }) {
  const act = actOf(stage);
  const first = (act - 1) * RULES.acts.length + 1;
  const boss = run.nextBoss ? BOSSES[run.nextBoss] : null;
  const BossIcon = run.nextBoss ? BOSS_ICON[run.nextBoss] : Crown;
  const endless = act > RULES.acts.winAct;
  const elite = eliteBoss(run);
  const EliteIcon = elite ? BOSS_ICON[elite] : Skull;
  return (
    <div className="act-track">
      <div className="act-label">
        {endless ? <InfinityIcon className="icon" /> : <Swords className="icon" />}
        <strong>Acte {act}</strong>
        <span className="muted">{endless ? 'Mode infini' : `sur ${RULES.acts.winAct}`}</span>
      </div>
      <div className="act-pips">
        {Array.from({ length: RULES.acts.length }, (_, i) => {
          const s = first + i;
          const kind = stageKind(s, 'deck');
          const state = s < stage ? 'done' : s === stage ? (fighting ? 'current fighting' : 'current') : '';
          // Played steps show what was taken; the chosen path shows what is coming.
          const planned = s > stage ? run.plan?.[s - stage - 1]?.kind : undefined;
          const taken = s < stage ? run.path?.[i] : s === stage ? (run.node ?? undefined) : planned;
          const TakenIcon = taken && taken !== 'boss' && !(taken === 'elite' && kind === 'elite') ? NODE_META[taken].icon : null;
          const junction = !taken && (i === 1 || i === 4 || i === 7) && s >= stage;
          return (
            <span
              key={s}
              className={`pip ${kind} ${state} ${taken ? `took-${taken}` : ''} ${planned ? 'planned' : ''} ${junction ? 'junction' : ''}`}
              title={`Étape ${s}${taken ? ` · ${NODE_META[taken].name}` : kind === 'elite' ? ` · élite${elite ? ` · ${BOSSES[elite].name} : ${BOSSES[elite].text}` : ''}` : kind === 'boss' ? ' · boss' : ''}`}
            >
              {TakenIcon ? <TakenIcon className="icon" /> : kind === 'elite' ? <EliteIcon className="icon" /> : kind === 'boss' ? <BossIcon className="icon" /> : null}
            </span>
          );
        })}
      </div>
      {boss && (
        <div className="boss-preview" title={boss.text}>
          <span className="boss-icon">
            <BossIcon className="icon" />
          </span>
          <span>
            <strong>{boss.name}</strong>
            <small>{boss.text}</small>
          </span>
        </div>
      )}
    </div>
  );
}

const duration = (ms: number) => {
  const min = Math.max(1, Math.round(ms / 60000));
  return min >= 60 ? `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}` : `${min} min`;
};

export function VictoryModal({ open, run, unlocked, onContinue }: { open: boolean; run: PublicRunState | null; unlocked: number | null; onContinue: () => void }) {
  if (!run) return null;
  const stats: [string, string][] = [
    ['Ennemis vaincus', run.stats.kills.toLocaleString('fr-FR')],
    ['Boss vaincus', String(run.stats.bossKills)],
    ['Dégâts infligés', run.stats.damageDealt.toLocaleString('fr-FR')],
    ['Durée', duration(Date.now() - run.startedAt)],
  ];
  return (
    <Modal
      open={open}
      icon={Trophy}
      title="Victoire !"
      subtitle={`Tu as vaincu le boss de l’acte ${RULES.acts.winAct}. La partie est gagnée et comptée au classement.`}
      footer={
        <button className="btn btn-accent btn-lg" onClick={onContinue}>
          <InfinityIcon className="icon" /> Continuer en mode infini
        </button>
      }
    >
      <div className="victory" style={cssVars({ '--choice-color': '#fbbf24' })}>
        <span className="victory-icon">
          <Trophy className="icon" />
        </span>
        <div className="victory-stats">
          {stats.map(([label, value]) => (
            <div key={label}>
              <strong>{value}</strong>
              <span>{label}</span>
            </div>
          ))}
        </div>
        {unlocked && (
          <div className="palier-unlock">
            <Mountain className="icon" />
            <span>
              <strong>Palier {unlocked} débloqué</strong>
              <small>{PALIERS[unlocked - 1]?.text} Choisis-le dans « Nouvelle partie ».</small>
            </span>
          </div>
        )}
        <h3>Coffre de victoire</h3>
        <div className="victory-chest">
          {RULES.acts.victoryChest.map((id, i) => {
            const meta = caseMeta(id);
            return (
              <div key={i} className="chest-case" style={cssVars({ '--case': meta.color })}>
                <img src={meta.image} alt="" />
                {meta.name}
              </div>
            );
          })}
        </div>
        <p className="muted">
          +{RULES.acts.victoryGold} or pour la suite, et une couronne à côté de ton nom au classement. En mode infini, les ennemis deviennent beaucoup plus forts à chaque acte :
          chaque niveau gagné compte pour ton record.
        </p>
      </div>
    </Modal>
  );
}
