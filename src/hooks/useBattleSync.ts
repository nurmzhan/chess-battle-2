'use client';
// src/hooks/useBattleSync.ts
// Syncs battle snapshots between two players using the existing
// game DB polling (stores snapshot in boardState.battle).

import { useState, useEffect, useRef, useCallback } from 'react';


import { BattleSnapshot } from '@/types';

// Snapshot of a single player — what TopDownBattle sends via onSnapshot
interface PlayerSnap {
  x: number; y: number; hp: number; angle: number;
  bullets: BattleSnapshot['bullets'];
  winner: 'attacker' | 'defender' | null;
  tick: number;
}

export function useBattleSync(roomCode: string, myRole: 'attacker' | 'defender') {
  const [remoteSnapshot, setRemoteSnapshot] = useState<BattleSnapshot | null>(null);
  const lastTickRef = useRef(0);
  const pendingRef = useRef<PlayerSnap | null>(null);
  const isSendingRef = useRef(false);

  // Reset tick counter whenever roomCode or role changes (new battle session)
  useEffect(() => {
    lastTickRef.current = 0;
  }, [roomCode, myRole]);

  // Push my snapshot to DB every ~100ms (throttled)
  // Accepts PlayerSnap (my own position/state) and wraps it into the role field
  const pushSnapshot = useCallback((snap: PlayerSnap) => {
    pendingRef.current = snap;
  }, []);

  // Sender: flush pending snapshot to DB
  useEffect(() => {
    const flush = async () => {
      if (isSendingRef.current || !pendingRef.current) return;
      const snap = pendingRef.current;
      pendingRef.current = null;
      isSendingRef.current = true;
      try {
        // Wrap my PlayerSnap into the role field the API expects
        const playerState = { x: snap.x, y: snap.y, hp: snap.hp, angle: snap.angle };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const payload: any = {
          [myRole]: playerState,
          bullets: snap.bullets,
          winner: snap.winner,
          tick: snap.tick,
        };
        await fetch(`/api/game/${roomCode}/battle`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: myRole, snapshot: payload }),
        });
      } catch { /* ignore */ }
      isSendingRef.current = false;
    };
    const iv = setInterval(flush, 50);
    return () => clearInterval(iv);
  }, [roomCode, myRole]);

  // Receiver: poll remote snapshot — 50ms for real-time HP/damage visibility
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(`/api/game/${roomCode}/battle`);
        if (!res.ok) return;
        const data = await res.json();
        const snap: BattleSnapshot = data.snapshot;
        if (snap && snap.tick > lastTickRef.current) {
          lastTickRef.current = snap.tick;
          setRemoteSnapshot(snap);
        }
      } catch { /* ignore */ }
    };
    const iv = setInterval(poll, 50);
    return () => clearInterval(iv);
  }, [roomCode]);

  return { remoteSnapshot, pushSnapshot };
}