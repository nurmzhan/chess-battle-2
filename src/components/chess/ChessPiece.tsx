'use client';
// src/components/chess/ChessPiece.tsx
import { Piece, PieceType } from '@/types';
import Image from 'next/image';

const PIECE_UNICODE: Record<PieceType, { white: string; black: string }> = {
  king:   { white: '♔', black: '♚' },
  queen:  { white: '♕', black: '♛' },
  rook:   { white: '♖', black: '♜' },
  bishop: { white: '♗', black: '♝' },
  knight: { white: '♘', black: '♞' },
  pawn:   { white: '♙', black: '♟' },
};

const PIECE_IMAGE_NAME: Record<PieceType, string> = {
  king:   'King',
  queen:  'Queen',
  rook:   'Rook',
  bishop: 'Bishop',
  knight: 'Knight',
  pawn:   'Pawn',
};

interface ChessPieceProps {
  piece: Piece;
  size?: number;
}

export function ChessPiece({ piece, size = 1 }: ChessPieceProps) {
  const imageName = `${piece.color === 'white' ? 'white' : 'black'}${PIECE_IMAGE_NAME[piece.type]}.png`;
  const hasImage = true; // Set to false if you don't have PNG assets yet

  if (hasImage) {
    return (
      <div
        style={{
          position: 'absolute',
          inset: '4%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Try image first, fall back to unicode */}
        <img
          src={`/pieces/${imageName}`}
          alt={`${piece.color} ${piece.type}`}
          style={{
            width: '90%',
            height: '90%',
            objectFit: 'contain',
            filter: piece.color === 'white'
              ? 'drop-shadow(0 2px 3px rgba(0,0,0,0.5))'
              : 'drop-shadow(0 2px 3px rgba(0,0,0,0.8))',
            transition: 'transform 0.15s',
          }}
          draggable={false}
          onError={(e) => {
            // Fallback to unicode
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
            const parent = target.parentElement!;
            if (!parent) return;
            parent.innerHTML = PIECE_UNICODE[piece.type][piece.color];
            parent.style.fontSize = '80%';
            parent.style.color = piece.color === 'white' ? '#fff' : '#111';
            parent.style.textShadow = piece.color === 'white'
              ? '0 0 3px #000, 0 0 6px #000'
              : '0 0 3px #fff4';
          }}
        />
      </div>
    );
  }

  // Unicode fallback
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '72%',
        lineHeight: 1,
        color: piece.color === 'white' ? '#fff' : '#111',
        textShadow: piece.color === 'white' ? '0 0 3px #000' : '0 0 3px #fff4',
        userSelect: 'none',
      }}
    >
      {PIECE_UNICODE[piece.type][piece.color]}
    </div>
  );
}

// Larger version for battle display
export function BattlePieceDisplay({ piece, size = 64 }: { piece: Piece; size?: number }) {
  const imageName = `${piece.color === 'white' ? 'white' : 'black'}${PIECE_IMAGE_NAME[piece.type]}.png`;

  return (
    <img
      src={`/pieces/${imageName}`}
      alt={`${piece.color} ${piece.type}`}
      width={size}
      height={size}
      style={{ objectFit: 'contain', imageRendering: 'pixelated' }}
      onError={(e) => {
        const target = e.target as HTMLImageElement;
        target.style.display = 'none';
      }}
    />
  );
}
