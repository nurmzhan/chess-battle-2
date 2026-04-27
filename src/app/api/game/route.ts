export const dynamic = 'force-dynamic';
// src/app/api/game/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createInitialBoard } from '@/lib/chess-engine';

function generateRoomCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// POST /api/game - create new game room
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const initialPieces = createInitialBoard();
  const boardState = JSON.stringify({
    pieces: initialPieces,
    currentTurn: 'white',
    moveHistory: [],
    status: 'playing',
    selectedSquare: null,
    validMoves: [],
  });

  const game = await prisma.game.create({
    data: {
      roomCode: generateRoomCode(),
      whiteId: session.user.id,
      boardState,
    },
    include: {
      white: { select: { id: true, username: true, rating: true } },
      black: { select: { id: true, username: true, rating: true } },
    }
  });

  return NextResponse.json({ game });
}

// GET /api/game?code=XXX - get game state
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  if (!code) return NextResponse.json({ error: 'Room code required' }, { status: 400 });

  const game = await prisma.game.findUnique({
    where: { roomCode: code },
    include: {
      white: { select: { id: true, username: true, rating: true } },
      black: { select: { id: true, username: true, rating: true } },
    }
  });

  if (!game) return NextResponse.json({ error: 'Game not found' }, { status: 404 });

  return NextResponse.json({ game });
}
