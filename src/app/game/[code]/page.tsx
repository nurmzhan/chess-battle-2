'use client';
// src/app/game/[code]/page.tsx
import { useEffect, useState, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { ChessBoard } from '@/components/chess/ChessBoard';
import { TopDownBattle } from '@/components/battle/TopDownBattle';
import { BoardState, Piece, Square, Move } from '@/types';
import {
  createInitialBoard,
  getValidMoves,
  applyMove,
  isInCheck,
  isCheckmate,
  isStalemate,
  getPieceAt,
} from '@/lib/chess-engine';
import { useBattleSync } from '@/hooks/useBattleSync';

interface GameData {
  id: string;
  roomCode: string;
  status: string;
  white: { id: string; username: string; rating: number } | null;
  black: { id: string; username: string; rating: number } | null;
  boardState: string;
  currentTurn: string;
}

const initialBoardState = (): BoardState => ({
  pieces: createInitialBoard(),
  currentTurn: 'white',
  moveHistory: [],
  status: 'playing',
  selectedSquare: null,
  validMoves: [],
});

export default function GamePage() {
  const { data: session } = useSession();
  const params = useParams();
  const code = params.code as string;
  const router = useRouter();

  const [gameData, setGameData] = useState<GameData | null>(null);
  const [boardState, setBoardState] = useState<BoardState>(initialBoardState());
  const [battle, setBattle] = useState<{ attacker: Piece; defender: Piece } | null>(null);
  const [battleKey, setBattleKey] = useState(0);
  const [pendingMove, setPendingMove] = useState<{ piece: Piece; to: Square } | null>(null);
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copyMsg, setCopyMsg] = useState('');
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const lastBoardRef = useRef('');
  const battleRef = useRef<{ attacker: Piece; defender: Piece } | null>(null);
  const myColorRef = useRef<string | null>(null);
  const myRoleRef = useRef<'attacker' | 'defender'>('defender');
  const pendingMoveRef = useRef<{ piece: Piece; to: Square } | null>(null);

  useEffect(() => { battleRef.current = battle; }, [battle]);
  useEffect(() => { pendingMoveRef.current = pendingMove; }, [pendingMove]);

  const userId = (session?.user as any)?.id;
  const myColor = gameData?.white?.id === userId ? 'white'
    : gameData?.black?.id === userId ? 'black' : null;

  useEffect(() => { myColorRef.current = myColor; }, [myColor]);

  const isMyTurn = myColor === boardState.currentTurn;
  // myRole вычисляется динамически, но фиксируется в ref при старте битвы
  const myRole: 'attacker' | 'defender' = myColor === boardState.currentTurn ? 'attacker' : 'defender';
  const { remoteSnapshot, pushSnapshot, resetBattleSync } = useBattleSync(
    code,
    myRoleRef.current,
    !!battle
  );

  // Fetch game data
  const fetchGame = useCallback(async () => {
    try {
      const res = await fetch(`/api/game?code=${code}`);
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }

      setGameData(data.game);

      if (data.game.boardState && data.game.boardState !== lastBoardRef.current) {
        lastBoardRef.current = data.game.boardState;
        try {
          const parsed = JSON.parse(data.game.boardState);

          // Триггер боя для defender
          if (parsed.status === 'battle' && parsed.battlePieces && !battleRef.current) {
            const amIDefender = myColorRef.current !== parsed.currentTurn;
            if (amIDefender) {
              myRoleRef.current = 'defender'; // Я не хожу — значит я защищающийся
              resetBattleSync();
              setBattleKey(k => k + 1);
              setPendingMove({
                piece: parsed.battlePieces.attacker,
                to: { row: parsed.battlePieces.defender.row, col: parsed.battlePieces.defender.col }
              });
              setBattle({ attacker: parsed.battlePieces.attacker, defender: parsed.battlePieces.defender });
            }
          }

          // Don't overwrite local state while a battle is in progress or just finished
          if (!battleRef.current) {
            setBoardState(prev => ({ ...parsed, selectedSquare: null, validMoves: [] }));
          }
        } catch {}
      }

      setLoading(false);
    } catch {
      setError('Failed to load game');
    }
  }, [code, resetBattleSync]);

  useEffect(() => {
    fetchGame();
    // Keep board polling modest; battle realtime uses /battle while a fight is active.
    pollRef.current = setInterval(fetchGame, 1000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchGame]);

  // Save board state to server
  const saveBoardState = useCallback(async (state: BoardState) => {
    const serialized = JSON.stringify({
      pieces: state.pieces,
      currentTurn: state.currentTurn,
      moveHistory: state.moveHistory,
      status: state.status,
    });
    lastBoardRef.current = serialized;

    await fetch(`/api/game/${code}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'move', boardState: serialized }),
    });
  }, [code]);

  // Finish game
  const finishGame = useCallback(async (result: string) => {
    await fetch(`/api/game/${code}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'finish', result }),
    });
  }, [code]);

  // Handle square click
  const handleSquareClick = useCallback(async (row: number, col: number) => {
    if (!isMyTurn || battleRef.current || gameData?.status === 'FINISHED') return;

    const { pieces, selectedSquare, currentTurn } = boardState;
    const clickedPiece = getPieceAt(pieces, row, col);

    if (selectedSquare) {
      const movingPiece = getPieceAt(pieces, selectedSquare.row, selectedSquare.col)!;
      const isValidTarget = boardState.validMoves.some(m => m.row === row && m.col === col);

      if (isValidTarget) {
        const target = getPieceAt(pieces, row, col);

        if (target && target.color !== movingPiece.color) {
          // BATTLE — сигнал обоим игрокам через БД
          myRoleRef.current = 'attacker'; // Я хожу — значит я атакующий
          // Clear old battle state from server before starting new battle
          resetBattleSync();
          await fetch(`/api/game/${code}/battle`, { method: 'DELETE' });
          setBattleKey(k => k + 1);
          setPendingMove({ piece: movingPiece, to: { row, col } });
          setBattle({ attacker: movingPiece, defender: target });
          setBoardState(prev => ({ ...prev, selectedSquare: null, validMoves: [] }));

          const battleSignal = JSON.stringify({
            pieces: boardState.pieces,
            currentTurn: boardState.currentTurn,
            moveHistory: boardState.moveHistory,
            status: 'battle',
            battlePieces: { attacker: movingPiece, defender: target },
          });
          lastBoardRef.current = battleSignal;
          await fetch(`/api/game/${code}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'move', boardState: battleSignal }),
          });
        } else {
          // Normal move
          const { newPieces } = applyMove(pieces, movingPiece, { row, col });
          const nextTurn = currentTurn === 'white' ? 'black' : 'white';
          const newMove: Move = { from: selectedSquare, to: { row, col }, piece: movingPiece };
          const newStatus = isCheckmate(newPieces, nextTurn) ? 'checkmate'
            : isStalemate(newPieces, nextTurn) ? 'stalemate'
            : isInCheck(newPieces, nextTurn) ? 'check'
            : 'playing';

          const newState: BoardState = {
            pieces: newPieces,
            currentTurn: nextTurn,
            moveHistory: [...boardState.moveHistory, newMove],
            status: newStatus as any,
            selectedSquare: null,
            validMoves: [],
          };

          setBoardState(newState);
          setLastMove({ from: selectedSquare, to: { row, col } });
          saveBoardState(newState);

          if (newStatus === 'checkmate') finishGame(nextTurn === 'black' ? 'WHITE_WIN' : 'BLACK_WIN');
          else if (newStatus === 'stalemate') finishGame('DRAW');
        }
        return;
      }
    }

    if (clickedPiece && clickedPiece.color === currentTurn) {
      const validMoves = getValidMoves(clickedPiece, pieces);
      setBoardState(prev => ({ ...prev, selectedSquare: { row, col }, validMoves }));
    } else {
      setBoardState(prev => ({ ...prev, selectedSquare: null, validMoves: [] }));
    }
  }, [boardState, isMyTurn, gameData, saveBoardState, finishGame, code, resetBattleSync]);

  // Battle ended — only attacker applies and saves result; defender waits for polling
  const handleBattleEnd = useCallback((attackerWon: boolean) => {
    const pending = pendingMoveRef.current;
    if (!pending) { setBattle(null); return; }
    const { piece, to } = pending;

    const isAttacker = myRoleRef.current === 'attacker';

    if (isAttacker) {
      setBoardState(prev => {
        const { pieces, currentTurn, moveHistory } = prev;
        const nextTurn = currentTurn === 'white' ? 'black' : 'white';

        let newPieces: Piece[];
        if (attackerWon) {
          newPieces = pieces
            .filter(p => !(p.row === to.row && p.col === to.col))
            .map(p => p.id === piece.id ? { ...p, row: to.row, col: to.col, hasMoved: true } : p);
        } else {
          newPieces = pieces.filter(p => p.id !== piece.id);
        }

        const newStatus = isCheckmate(newPieces, nextTurn) ? 'checkmate'
          : isStalemate(newPieces, nextTurn) ? 'stalemate'
          : isInCheck(newPieces, nextTurn) ? 'check'
          : 'playing';

        const newState: BoardState = {
          pieces: newPieces,
          currentTurn: nextTurn,
          moveHistory,
          status: newStatus as any,
          selectedSquare: null,
          validMoves: [],
        };

        if (attackerWon) setLastMove({ from: { row: piece.row, col: piece.col }, to });
        saveBoardState(newState);
        if (newStatus === 'checkmate') finishGame(nextTurn === 'black' ? 'WHITE_WIN' : 'BLACK_WIN');
        else if (newStatus === 'stalemate') finishGame('DRAW');

        return newState;
      });
    }
    // Defender: just clear battle state — polling will update board from attacker's save

    setBattle(null);
    setPendingMove(null);
    pendingMoveRef.current = null;
  }, [saveBoardState, finishGame]);

  const copyCode = () => {
    navigator.clipboard.writeText(code);
    setCopyMsg('Copied!');
    setTimeout(() => setCopyMsg(''), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-display)' }}>Loading game...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="card-elevated p-8 text-center">
          <div style={{ color: 'var(--red)', marginBottom: '1rem' }}>{error}</div>
          <button className="btn-primary" onClick={() => router.push('/')}>Back to Lobby</button>
        </div>
      </div>
    );
  }

  const isWaiting = gameData?.status === 'WAITING';
  const isFinished = gameData?.status === 'FINISHED';

  return (
    <div className="min-h-screen flex flex-col" style={{ padding: '1rem' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 max-w-5xl mx-auto w-full">
        <button className="btn-secondary text-sm" onClick={() => router.push('/')}>
          ← Lobby
        </button>

        <div className="flex items-center gap-3">
          <span style={{ fontFamily: 'var(--font-display)', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            ROOM
          </span>
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.2rem',
              color: 'var(--accent)',
              letterSpacing: '0.2em',
              cursor: 'pointer',
            }}
            onClick={copyCode}
            title="Click to copy"
          >
            {code}
          </span>
          {copyMsg && <span style={{ color: 'var(--green)', fontSize: '0.8rem' }}>{copyMsg}</span>}
        </div>

        <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.9rem' }}>
          {isMyTurn && !isFinished && (
            <span style={{ color: 'var(--green)' }}>Your turn</span>
          )}
          {!isMyTurn && !isFinished && !isWaiting && (
            <span style={{ color: 'var(--text-muted)' }}>Waiting...</span>
          )}
        </div>
      </div>

      {/* Main layout */}
      <div className="flex gap-6 max-w-5xl mx-auto w-full justify-center">
        {/* Player info - Black */}
        <div className="hidden md:flex flex-col items-end justify-start pt-4" style={{ minWidth: '140px' }}>
          {gameData?.black ? (
            <div className="card p-3 text-right">
              <div style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                ♟ {gameData.black.username}
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                Rating: {gameData.black.rating}
              </div>
            </div>
          ) : (
            <div className="card p-3 text-right" style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Waiting for opponent...
            </div>
          )}
        </div>

        {/* Board */}
        <div className="flex flex-col items-center gap-4">
          {isWaiting && (
            <div className="card p-4 text-center animate-slide-up" style={{ maxWidth: '400px' }}>
              <div style={{ color: 'var(--accent)', fontFamily: 'var(--font-display)', marginBottom: '0.5rem' }}>
                Waiting for opponent
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
                Share the room code with your opponent:
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '2rem',
                  letterSpacing: '0.3em',
                  color: 'var(--accent)',
                  cursor: 'pointer',
                  padding: '0.5rem',
                  border: '1px solid var(--border-glow)',
                  borderRadius: '4px',
                }}
                onClick={copyCode}
              >
                {code}
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.5rem' }}>
                Click to copy
              </div>
            </div>
          )}

          {isFinished && (
            <div className="card-elevated p-4 text-center animate-slide-up">
              <div style={{ fontFamily: 'var(--font-display)', color: 'var(--accent)', fontSize: '1.2rem', marginBottom: '0.5rem' }}>
                Game Over
              </div>
              <button className="btn-primary mt-2" onClick={() => router.push('/')}>
                Back to Lobby
              </button>
            </div>
          )}

          {boardState.status === 'check' && !isFinished && (
            <div style={{
              background: 'rgba(233,69,96,0.2)',
              border: '1px solid var(--red)',
              borderRadius: '6px',
              padding: '0.5rem 1.5rem',
              fontFamily: 'var(--font-display)',
              color: 'var(--red)',
              fontSize: '0.9rem',
              animation: 'flash 1s infinite',
            }}>
              ⚠️ CHECK!
            </div>
          )}

          <ChessBoard
            boardState={boardState}
            myColor={myColor}
            onSquareClick={handleSquareClick}
            lastMove={lastMove}
            flipped={myColor === 'black'}
          />

          <div className="flex items-center gap-3">
            <div style={{
              width: '14px', height: '14px', borderRadius: '50%',
              background: boardState.currentTurn === 'white' ? '#f0d9b5' : '#2d2d2d',
              border: '2px solid var(--border-glow)',
            }} />
            <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-display)', fontSize: '0.85rem' }}>
              {boardState.currentTurn.toUpperCase()}'s TURN
            </span>
          </div>
        </div>

        {/* Player info - White */}
        <div className="hidden md:flex flex-col items-start justify-end pb-4" style={{ minWidth: '140px' }}>
          {gameData?.white ? (
            <div className="card p-3">
              <div style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                ♙ {gameData.white.username}
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                Rating: {gameData.white.rating}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Battle overlay */}
      {battle && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: '#020617' }}>
          <TopDownBattle
            key={battleKey}
            attackerPiece={battle.attacker}
            defenderPiece={battle.defender}
            myRole={myRoleRef.current}
            onSnapshot={pushSnapshot}
            battleSnap={remoteSnapshot}
            onBattleEnd={handleBattleEnd}
          />
        </div>
      )}
    </div>
  );
}
