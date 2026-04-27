export const dynamic = 'force-dynamic';
// src/app/api/stats/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const users = await prisma.user.findMany({
    select: { id: true, username: true, rating: true, wins: true, losses: true, draws: true },
    orderBy: { rating: 'desc' },
    take: 20,
  });

  return NextResponse.json({ leaderboard: users });
}
