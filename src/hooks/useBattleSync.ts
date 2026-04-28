'use client';
// src/hooks/useBattleSync.ts
// Syncs battle snapshots between two players through the fast battle API.

import { useState, useEffect, useRef, useCallback } from 'react';


import { BattleSnapshot } from '@/types';

// Snapshot of a single player — what TopDownBattle sends via onSnapshot
interface PlayerSnap {
  x: number; y: number; hp: number; angle: number;
  bullets: BattleSnapshot['bullets'];
  winner: 'attacker' | 'defender' | null;
  tick: number;
}

export function useBattleSync(roomCode: string, myRole: 'attacker' | 'defender', enabled: boolean) {
  const [remoteSnapshot, setRemoteSnapshot] = useState<BattleSnapshot | null>(null);
  const lastTickRef = useRef(0);
  const lastWinnerRef = useRef<'attacker' | 'defender' | null>(null);
  const pendingRef = useRef<PlayerSnap | null>(null);
  const isSendingRef = useRef(false);

  const resetBattleSync = useCallback(() => {
    lastTickRef.current = 0;
    lastWinnerRef.current = null;
    pendingRef.current = null;
    setRemoteSnapshot(null);
  }, []);

  // Reset counters whenever a battle session starts/stops or role changes.
  useEffect(() => {
    resetBattleSync();
  }, [roomCode, myRole, enabled, resetBattleSync]);

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
        const res = await fetch(`/api/game/${roomCode}/battle`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: myRole, snapshot: payload }),
        });
        if (res.ok) {
          const data = await res.json();
          const serverSnap: BattleSnapshot | null = data.snapshot ?? null;
          if (serverSnap) {
            lastTickRef.current = serverSnap.tick;
            lastWinnerRef.current = serverSnap.winner;
            setRemoteSnapshot(serverSnap);
          }
        }
      } catch { /* ignore */ }
      isSendingRef.current = false;
    };
    if (!enabled) return;
    const iv = setInterval(flush, 100);
    return () => clearInterval(iv);
  }, [roomCode, myRole, enabled]);

  // Receiver: low-frequency backup poll. Regular POST responses carry the
  // current authoritative snapshot, so this does not need to run rapidly.
  useEffect(() => {
    if (!enabled) return;
    const poll = async () => {
      try {
        const res = await fetch(`/api/game/${roomCode}/battle`);
        if (!res.ok) return;
        const data = await res.json();
        const snap: BattleSnapshot = data.snapshot;
        if (
          snap &&
          (snap.tick > lastTickRef.current || snap.winner !== lastWinnerRef.current)
        ) {
          lastTickRef.current = snap.tick;
          lastWinnerRef.current = snap.winner;
          setRemoteSnapshot(snap);
        }
      } catch { /* ignore */ }
    };
    const iv = setInterval(poll, 500);
    return () => clearInterval(iv);
  }, [roomCode, enabled]);

  return { remoteSnapshot, pushSnapshot, resetBattleSync };
}
