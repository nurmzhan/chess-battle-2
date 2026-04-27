'use client';
// src/hooks/useBattleSync.ts
// Syncs battle snapshots between two players using the existing
// game DB polling (stores snapshot in boardState.battle).

import { useState, useEffect, useRef, useCallback } from 'react';


import { BattleSnapshot } from '@/types';
export function useBattleSync(roomCode: string, myRole: 'attacker' | 'defender') {
  const [remoteSnapshot, setRemoteSnapshot] = useState<BattleSnapshot | null>(null);
  const lastTickRef = useRef(0);
  const pendingRef = useRef<BattleSnapshot | null>(null);
  const isSendingRef = useRef(false);

  // Push my snapshot to DB every ~100ms (throttled)
  const pushSnapshot = useCallback((snap: BattleSnapshot) => {
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
        await fetch(`/api/game/${roomCode}/battle`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: myRole, snapshot: snap }),
        });
      } catch { /* ignore */ }
      isSendingRef.current = false;
    };
    const iv = setInterval(flush, 80);
    return () => clearInterval(iv);
  }, [roomCode, myRole]);

  // Receiver: poll remote snapshot
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
    const iv = setInterval(poll, 100);
    return () => clearInterval(iv);
  }, [roomCode]);

  return { remoteSnapshot, pushSnapshot };
}