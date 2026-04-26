// src/types/index.ts

export type PieceType = 'king' | 'queen' | 'rook' | 'bishop' | 'knight' | 'pawn';
export type PieceColor = 'white' | 'black';

export interface Piece {
  id: string;
  type: PieceType;
  color: PieceColor;
  row: number;
  col: number;
  hasMoved?: boolean;
}

export interface Square {
  row: number;
  col: number;
}

export interface Move {
  from: Square;
  to: Square;
  piece: Piece;
  captured?: Piece;
  promotion?: PieceType;
}

export interface BoardState {
  pieces: Piece[];
  currentTurn: PieceColor;
  moveHistory: Move[];
  status: 'playing' | 'check' | 'checkmate' | 'stalemate' | 'battle';
  selectedSquare: Square | null;
  validMoves: Square[];
}

// Battle system types
export type BattleClass = 'warrior' | 'mage' | 'ranger' | 'rogue' | 'paladin' | 'assassin';

export interface BattleStats {
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
  special: string;
}

export interface BattleFighter {
  piece: Piece;
  stats: BattleStats;
  class: BattleClass;
  x: number;
  y: number;
  facing: 'left' | 'right';
  state: 'idle' | 'attacking' | 'hurt' | 'dead' | 'special';
  buffs: Buff[];
}

export interface Buff {
  name: string;
  duration: number;
  effect: Partial<BattleStats>;
}

export interface BattleLog {
  message: string;
  type: 'attack' | 'special' | 'buff' | 'damage' | 'death';
  timestamp: number;
}

export interface BattleState {
  attacker: BattleFighter;
  defender: BattleFighter;
  round: number;
  log: BattleLog[];
  phase: 'intro' | 'fighting' | 'result';
  winner: 'attacker' | 'defender' | null;
}

// Game room types
export interface GameRoom {
  id: string;
  roomCode: string;
  white?: Player;
  black?: Player;
  status: 'waiting' | 'active' | 'finished';
  boardState: BoardState;
}

export interface Player {
  id: string;
  username: string;
  rating: number;
  avatar?: string;
}

export interface UserStats {
  wins: number;
  losses: number;
  draws: number;
  rating: number;
  winRate: number;
}
