// src/lib/battle-system.ts
import { Piece, PieceType, BattleStats, BattleFighter, BattleClass, BattleState, BattleLog } from '@/types';

// Each piece type maps to a battle class with unique stats
export const PIECE_BATTLE_CLASS: Record<PieceType, BattleClass> = {
  king:   'paladin',
  queen:  'mage',
  rook:   'warrior',
  bishop: 'ranger',
  knight: 'assassin',
  pawn:   'rogue',
};

const BASE_STATS: Record<BattleClass, BattleStats> = {
  warrior:  { hp: 120, maxHp: 120, attack: 18, defense: 14, speed: 7,  special: 'Shield Bash' },
  mage:     { hp: 70,  maxHp: 70,  attack: 32, defense: 5,  speed: 10, special: 'Arcane Burst' },
  ranger:   { hp: 85,  maxHp: 85,  attack: 22, defense: 8,  speed: 12, special: 'Piercing Shot' },
  rogue:    { hp: 65,  maxHp: 65,  attack: 15, defense: 6,  speed: 14, special: 'Backstab' },
  paladin:  { hp: 140, maxHp: 140, attack: 20, defense: 18, speed: 6,  special: 'Holy Smite' },
  assassin: { hp: 75,  maxHp: 75,  attack: 28, defense: 7,  speed: 16, special: 'Death Strike' },
};

export const PIECE_COLORS: Record<string, { primary: string; glow: string }> = {
  white: { primary: '#f0d9b5', glow: '#ffe680' },
  black: { primary: '#2d2d2d', glow: '#6600cc' },
};

export const CLASS_COLORS: Record<BattleClass, string> = {
  warrior:  '#e05c00',
  mage:     '#8800ff',
  ranger:   '#006600',
  rogue:    '#cc6600',
  paladin:  '#d4af37',
  assassin: '#cc0044',
};

export const CLASS_EMOJI: Record<BattleClass, string> = {
  warrior:  '⚔️',
  mage:     '🔮',
  ranger:   '🏹',
  rogue:    '🗡️',
  paladin:  '🛡️',
  assassin: '⚡',
};

export function createFighter(piece: Piece, side: 'left' | 'right'): BattleFighter {
  const battleClass = PIECE_BATTLE_CLASS[piece.type];
  const stats = { ...BASE_STATS[battleClass] };

  return {
    piece,
    stats,
    class: battleClass,
    x: side === 'left' ? 150 : 450,
    y: 250,
    facing: side === 'left' ? 'right' : 'left',
    state: 'idle',
    buffs: [],
  };
}

interface AttackResult {
  damage: number;
  isCrit: boolean;
  isSpecial: boolean;
  log: string;
  defenderDefeated: boolean;
}

function rollDamage(attacker: BattleFighter, defender: BattleFighter, isSpecial: boolean): AttackResult {
  const baseDmg = attacker.stats.attack;
  const defense = defender.stats.defense;
  const critChance = attacker.stats.speed / 100;
  const isCrit = Math.random() < critChance;

  let damage = Math.max(1, baseDmg - defense + Math.floor(Math.random() * 8) - 4);
  if (isCrit) damage = Math.floor(damage * 1.8);
  if (isSpecial) damage = Math.floor(damage * 1.5);

  defender.stats.hp = Math.max(0, defender.stats.hp - damage);
  const defenderDefeated = defender.stats.hp <= 0;

  const attackerName = `${attacker.piece.color} ${attacker.piece.type}`;
  const defenderName = `${defender.piece.color} ${defender.piece.type}`;

  let log = '';
  if (isSpecial) {
    log = `${attackerName} uses ${attacker.stats.special} on ${defenderName} for ${damage}${isCrit ? ' (CRIT!)' : ''} damage!`;
  } else {
    log = `${attackerName} attacks ${defenderName} for ${damage}${isCrit ? ' (CRIT!)' : ''} damage!`;
  }

  if (defenderDefeated) {
    log += ` ${defenderName} is defeated!`;
  }

  return { damage, isCrit, isSpecial, log, defenderDefeated };
}

// Simulate entire battle and return turn-by-turn log
export function simulateBattle(attackerPiece: Piece, defenderPiece: Piece): BattleState {
  const attacker = createFighter(attackerPiece, 'left');
  const defender = createFighter(defenderPiece, 'right');

  const log: BattleLog[] = [];
  let round = 1;
  let winner: 'attacker' | 'defender' | null = null;

  log.push({
    message: `⚔️ BATTLE BEGINS! ${attacker.piece.color} ${attacker.piece.type} (${CLASS_EMOJI[attacker.class]} ${attacker.class}) vs ${defender.piece.color} ${defender.piece.type} (${CLASS_EMOJI[defender.class]} ${defender.class})`,
    type: 'attack',
    timestamp: 0,
  });

  while (attacker.stats.hp > 0 && defender.stats.hp > 0 && round <= 20) {
    // Attacker goes first (they initiated capture)
    const attackerIsSpecial = round % 3 === 0;
    const attackResult = rollDamage(attacker, defender, attackerIsSpecial);

    log.push({
      message: attackResult.log,
      type: attackerIsSpecial ? 'special' : 'attack',
      timestamp: round * 2 - 1,
    });

    if (attackResult.defenderDefeated) {
      winner = 'attacker';
      break;
    }

    // Defender counter-attacks
    const defenderIsSpecial = round % 4 === 0;
    const defenderResult = rollDamage(defender, attacker, defenderIsSpecial);

    log.push({
      message: defenderResult.log,
      type: defenderIsSpecial ? 'special' : 'attack',
      timestamp: round * 2,
    });

    if (defenderResult.defenderDefeated) {
      winner = 'defender';
      break;
    }

    round++;
  }

  // If no winner after max rounds, higher HP percentage wins
  if (!winner) {
    const attackerHpPct = attacker.stats.hp / attacker.stats.maxHp;
    const defenderHpPct = defender.stats.hp / defender.stats.maxHp;
    winner = attackerHpPct >= defenderHpPct ? 'attacker' : 'defender';
    log.push({
      message: `Time's up! ${winner === 'attacker' ? `${attacker.piece.color} ${attacker.piece.type}` : `${defender.piece.color} ${defender.piece.type}`} wins by HP!`,
      type: 'death',
      timestamp: round * 2 + 1,
    });
  }

  log.push({
    message: winner === 'attacker'
      ? `🏆 ${attacker.piece.color} ${attacker.piece.type} wins the battle and captures the square!`
      : `🛡️ ${defender.piece.color} ${defender.piece.type} defends and survives! The attacker retreats!`,
    type: 'death',
    timestamp: round * 2 + 2,
  });

  return {
    attacker,
    defender,
    round,
    log,
    phase: 'intro',
    winner,
  };
}
