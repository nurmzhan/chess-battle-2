'use client';
// src/components/chess/ChessBoard.tsx
import { Piece, Square, BoardState } from '@/types';
import { ChessPiece } from './ChessPiece';

interface ChessBoardProps {
  boardState: BoardState;
  myColor: 'white' | 'black' | null;
  onSquareClick: (row: number, col: number) => void;
  lastMove?: { from: Square; to: Square } | null;
  flipped?: boolean;
}

export function ChessBoard({ boardState, myColor, onSquareClick, lastMove, flipped }: ChessBoardProps) {
  const { pieces, selectedSquare, validMoves, status } = boardState;

  const isSelected = (r: number, c: number) =>
    selectedSquare?.row === r && selectedSquare?.col === c;

  const isValidMove = (r: number, c: number) =>
    validMoves.some(m => m.row === r && m.col === c);

  const isLastMove = (r: number, c: number) =>
    lastMove && (
      (lastMove.from.row === r && lastMove.from.col === c) ||
      (lastMove.to.row === r && lastMove.to.col === c)
    );

  const isInCheck = (r: number, c: number) => {
    if (status !== 'check') return false;
    const king = pieces.find(p => p.type === 'king' && p.color === boardState.currentTurn);
    return king?.row === r && king?.col === c;
  };

  const rows = flipped ? [7,6,5,4,3,2,1,0] : [0,1,2,3,4,5,6,7];
  const cols = flipped ? [7,6,5,4,3,2,1,0] : [0,1,2,3,4,5,6,7];
  const files = ['a','b','c','d','e','f','g','h'];
  const ranks = ['8','7','6','5','4','3','2','1'];

  return (
    <div className="relative select-none">
      {/* Board */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(8, 1fr)',
          border: '3px solid #8B6914',
          borderRadius: '4px',
          overflow: 'hidden',
          boxShadow: '0 0 40px rgba(0,0,0,0.8), 0 0 80px rgba(200,155,60,0.15)',
          width: 'min(90vw, 560px)',
          height: 'min(90vw, 560px)',
        }}
      >
        {rows.map((row) =>
          cols.map((col) => {
            const isLight = (row + col) % 2 === 0;
            const piece = pieces.find(p => p.row === row && p.col === col);
            const selected = isSelected(row, col);
            const valid = isValidMove(row, col);
            const lastMv = isLastMove(row, col);
            const check = isInCheck(row, col);

            let bgColor = isLight ? '#f0d9b5' : '#b58863';
            if (selected) bgColor = '#f6f669';
            else if (check) bgColor = '#ff6b6b';
            else if (lastMv) bgColor = isLight ? '#cdd26a' : '#aaa23a';

            return (
              <div
                key={`${row}-${col}`}
                onClick={() => onSquareClick(row, col)}
                style={{
                  background: bgColor,
                  position: 'relative',
                  cursor: valid || (piece && piece.color === myColor) ? 'pointer' : 'default',
                  aspectRatio: '1',
                  transition: 'background 0.15s',
                }}
              >
                {/* Valid move dot */}
                {valid && !piece && (
                  <div style={{
                    position: 'absolute',
                    inset: '35%',
                    borderRadius: '50%',
                    background: 'rgba(0,0,0,0.18)',
                  }} />
                )}
                {/* Valid capture ring */}
                {valid && piece && (
                  <div style={{
                    position: 'absolute',
                    inset: '3px',
                    borderRadius: '50%',
                    border: '4px solid rgba(0,0,0,0.25)',
                  }} />
                )}

                {/* Piece */}
                {piece && <ChessPiece piece={piece} />}

                {/* Coordinates */}
                {col === (flipped ? 7 : 0) && (
                  <span style={{
                    position: 'absolute', top: '2px', left: '3px',
                    fontSize: '10px', fontWeight: 'bold', lineHeight: 1,
                    color: isLight ? '#b58863' : '#f0d9b5',
                    fontFamily: 'Georgia, serif',
                  }}>
                    {flipped ? ranks[7 - row] : ranks[row]}
                  </span>
                )}
                {row === (flipped ? 0 : 7) && (
                  <span style={{
                    position: 'absolute', bottom: '2px', right: '3px',
                    fontSize: '10px', fontWeight: 'bold', lineHeight: 1,
                    color: isLight ? '#b58863' : '#f0d9b5',
                    fontFamily: 'Georgia, serif',
                  }}>
                    {flipped ? files[7 - col] : files[col]}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
