export const dynamic = 'force-dynamic';
// src/app/api/game/[code]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// PATCH /api/game/[code] - join game or make move
export async function PATCH(req: NextRequest, { params }: { params: { code: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { action, boardState, result } = await req.json();
  const { code } = params;

  const game = await prisma.game.findUnique({ where: { roomCode: code } });
  if (!game) return NextResponse.json({ error: 'Game not found' }, { status: 404 });

  if (action === 'join') {
    if (game.blackId) return NextResponse.json({ error: 'Game is full' }, { status: 409 });
    if (game.whiteId === session.user.id) return NextResponse.json({ error: 'Already in game' }, { status: 409 });

    const updated = await prisma.game.update({
      where: { roomCode: code },
      data: { blackId: session.user.id, status: 'ACTIVE' },
      include: {
        white: { select: { id: true, username: true, rating: true } },
        black: { select: { id: true, username: true, rating: true } },
      }
    });

    return NextResponse.json({ game: updated });
  }

  if (action === 'move' && boardState) {
    const updated = await prisma.game.update({
      where: { roomCode: code },
      data: { boardState, updatedAt: new Date() },
    });
    return NextResponse.json({ game: updated });
  }

  if (action === 'finish' && result) {
    const updated = await prisma.game.update({
      where: { roomCode: code },
      data: {
        status: 'FINISHED',
        result,
        finishedAt: new Date(),
      }
    });

    // Update player stats
    if (result === 'WHITE_WIN') {
      await Promise.all([
        prisma.user.update({ where: { id: game.whiteId! }, data: { wins: { increment: 1 }, rating: { increment: 15 } } }),
        prisma.user.update({ where: { id: game.blackId! }, data: { losses: { increment: 1 }, rating: { decrement: 15 } } }),
      ]);
    } else if (result === 'BLACK_WIN') {
      await Promise.all([
        prisma.user.update({ where: { id: game.blackId! }, data: { wins: { increment: 1 }, rating: { increment: 15 } } }),
        prisma.user.update({ where: { id: game.whiteId! }, data: { losses: { increment: 1 }, rating: { decrement: 15 } } }),
      ]);
    } else if (result === 'DRAW') {
      await Promise.all([
        prisma.user.update({ where: { id: game.whiteId! }, data: { draws: { increment: 1 } } }),
        prisma.user.update({ where: { id: game.blackId! }, data: { draws: { increment: 1 } } }),
      ]);
    }

    return NextResponse.json({ game: updated });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
