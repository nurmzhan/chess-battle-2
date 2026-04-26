// src/lib/chess-engine.ts
import { Piece, PieceType, PieceColor, Square, Move, BoardState } from '@/types';
import { v4 as uuidv4 } from 'uuid';

export function createInitialBoard(): Piece[] {
  const pieces: Piece[] = [];

  const backRank: PieceType[] = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];

  // Black back rank
  backRank.forEach((type, col) => {
    pieces.push({ id: uuidv4(), type, color: 'black', row: 0, col, hasMoved: false });
  });
  // Black pawns
  for (let col = 0; col < 8; col++) {
    pieces.push({ id: uuidv4(), type: 'pawn', color: 'black', row: 1, col, hasMoved: false });
  }
  // White pawns
  for (let col = 0; col < 8; col++) {
    pieces.push({ id: uuidv4(), type: 'pawn', color: 'white', row: 6, col, hasMoved: false });
  }
  // White back rank
  backRank.forEach((type, col) => {
    pieces.push({ id: uuidv4(), type, color: 'white', row: 7, col, hasMoved: false });
  });

  return pieces;
}

export function getPieceAt(pieces: Piece[], row: number, col: number): Piece | undefined {
  return pieces.find(p => p.row === row && p.col === col);
}

function isOnBoard(row: number, col: number): boolean {
  return row >= 0 && row <= 7 && col >= 0 && col <= 7;
}

export function getValidMoves(piece: Piece, pieces: Piece[]): Square[] {
  const rawMoves = getRawMoves(piece, pieces);
  // Filter moves that would leave own king in check
  return rawMoves.filter(sq => {
    const newPieces = simulateMove(pieces, piece, sq);
    return !isInCheck(newPieces, piece.color);
  });
}

function getRawMoves(piece: Piece, pieces: Piece[]): Square[] {
  const { type, color, row, col } = piece;
  const moves: Square[] = [];

  const addIfValid = (r: number, c: number, canCapture = true): boolean => {
    if (!isOnBoard(r, c)) return false;
    const target = getPieceAt(pieces, r, c);
    if (target) {
      if (target.color !== color && canCapture) moves.push({ row: r, col: c });
      return false; // blocked
    }
    moves.push({ row: r, col: c });
    return true; // can continue sliding
  };

  const slide = (dr: number, dc: number) => {
    let r = row + dr, c = col + dc;
    while (isOnBoard(r, c)) {
      if (!addIfValid(r, c)) break;
      r += dr; c += dc;
    }
  };

  switch (type) {
    case 'pawn': {
      const dir = color === 'white' ? -1 : 1;
      const startRow = color === 'white' ? 6 : 1;
      // Forward
      if (isOnBoard(row + dir, col) && !getPieceAt(pieces, row + dir, col)) {
        moves.push({ row: row + dir, col });
        // Double move from start
        if (row === startRow && !getPieceAt(pieces, row + 2 * dir, col)) {
          moves.push({ row: row + 2 * dir, col });
        }
      }
      // Captures
      for (const dc of [-1, 1]) {
        const target = getPieceAt(pieces, row + dir, col + dc);
        if (target && target.color !== color && isOnBoard(row + dir, col + dc)) {
          moves.push({ row: row + dir, col: col + dc });
        }
      }
      break;
    }
    case 'rook':
      slide(-1, 0); slide(1, 0); slide(0, -1); slide(0, 1);
      break;
    case 'bishop':
      slide(-1, -1); slide(-1, 1); slide(1, -1); slide(1, 1);
      break;
    case 'queen':
      slide(-1, 0); slide(1, 0); slide(0, -1); slide(0, 1);
      slide(-1, -1); slide(-1, 1); slide(1, -1); slide(1, 1);
      break;
    case 'king': {
  const offsets = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
  offsets.forEach(([dr, dc]) => addIfValid(row + dr, col + dc));
  // Castling - только если король не двигался (isInCheck убираем из getRawMoves!)
  if (!piece.hasMoved) {
    // Kingside
    const krook = getPieceAt(pieces, row, 7);
    if (krook && !krook.hasMoved && krook.type === 'rook') {
      if (!getPieceAt(pieces, row, 5) && !getPieceAt(pieces, row, 6)) {
        moves.push({ row, col: 6 });
      }
    }
    // Queenside
    const qrook = getPieceAt(pieces, row, 0);
    if (qrook && !qrook.hasMoved && qrook.type === 'rook') {
      if (!getPieceAt(pieces, row, 1) && !getPieceAt(pieces, row, 2) && !getPieceAt(pieces, row, 3)) {
        moves.push({ row, col: 2 });
      }
    }
  }
  break;
}
    case 'knight': {
      const knightMoves = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
      knightMoves.forEach(([dr, dc]) => addIfValid(row + dr, col + dc));
      break;
    }
  }

  return moves;
}

function simulateMove(pieces: Piece[], piece: Piece, to: Square): Piece[] {
  return pieces
    .filter(p => !(p.row === to.row && p.col === to.col)) // remove captured
    .map(p => p.id === piece.id ? { ...p, row: to.row, col: to.col, hasMoved: true } : p);
}

export function isInCheck(pieces: Piece[], color: PieceColor): boolean {
  const king = pieces.find(p => p.type === 'king' && p.color === color);
  if (!king) return false;
  const opponents = pieces.filter(p => p.color !== color);
  return opponents.some(op => {
    const moves = getRawMoves(op, pieces);
    return moves.some(m => m.row === king.row && m.col === king.col);
  });
}

export function isCheckmate(pieces: Piece[], color: PieceColor): boolean {
  if (!isInCheck(pieces, color)) return false;
  const myPieces = pieces.filter(p => p.color === color);
  return myPieces.every(p => getValidMoves(p, pieces).length === 0);
}

export function isStalemate(pieces: Piece[], color: PieceColor): boolean {
  if (isInCheck(pieces, color)) return false;
  const myPieces = pieces.filter(p => p.color === color);
  return myPieces.every(p => getValidMoves(p, pieces).length === 0);
}

export function applyMove(
  pieces: Piece[],
  piece: Piece,
  to: Square
): { newPieces: Piece[]; captured: Piece | undefined; isBattle: boolean } {
  const captured = getPieceAt(pieces, to.row, to.col);
  const isBattle = !!captured;

  let newPieces = pieces
    .filter(p => !(p.row === to.row && p.col === to.col))
    .map(p => {
      if (p.id !== piece.id) return p;
      let updated = { ...p, row: to.row, col: to.col, hasMoved: true };
      // Pawn promotion
      if (p.type === 'pawn' && (to.row === 0 || to.row === 7)) {
        updated = { ...updated, type: 'queen' };
      }
      return updated;
    });

  // Handle castling - move rook
  if (piece.type === 'king' && !piece.hasMoved) {
    if (to.col === 6) {
      newPieces = newPieces.map(p =>
        p.type === 'rook' && p.color === piece.color && p.col === 7
          ? { ...p, col: 5, hasMoved: true } : p
      );
    } else if (to.col === 2) {
      newPieces = newPieces.map(p =>
        p.type === 'rook' && p.color === piece.color && p.col === 0
          ? { ...p, col: 3, hasMoved: true } : p
      );
    }
  }

  return { newPieces, captured, isBattle };
}

export function boardToFen(pieces: Piece[]): string {
  const grid: string[][] = Array.from({ length: 8 }, () => Array(8).fill(''));
  const pieceToFen: Record<string, string> = {
    king: 'k', queen: 'q', rook: 'r', bishop: 'b', knight: 'n', pawn: 'p'
  };
  pieces.forEach(p => {
    const char = pieceToFen[p.type];
    grid[p.row][p.col] = p.color === 'white' ? char.toUpperCase() : char;
  });
  return JSON.stringify(grid);
}
