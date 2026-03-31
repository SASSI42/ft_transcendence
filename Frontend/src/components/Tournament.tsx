import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { TournamentManager } from '../game/tournaments/manager';
import type { TournamentSnapshot, WinnerSide } from '../game/tournaments/manager';
import { CurrentMatchDisplay, ChampionDisplay } from '../game/tournaments/UIComponents';
import { TournamentBracket } from '../game/tournaments/TournamentBracket';
import { GAME_CONFIG } from '../game/config';
import { LocalMatchState } from '../game/state/models';
import { useGameLoop } from '../hooks/useGameLoop';
import { useKeyboard } from '../hooks/useKeyboard';

type TournamentPhase = 'registration' | 'bracket' | 'playing' | 'champion';

export function Tournament() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<TournamentPhase>('registration');
  const [players, setPlayers] = useState<string[]>(['', '']);
  const [tournamentName, setTournamentName] = useState('Local Cup');
  const [capacity, setCapacity] = useState<4 | 8>(4);
  const [error, setError] = useState<string | undefined>();
  const [snapshot, setSnapshot] = useState<TournamentSnapshot | null>(null);
  const [gameState, setGameState] = useState<LocalMatchState | null>(null);
  const [, forceUpdate] = useState(0);
  
  const managerRef = useRef<TournamentManager>(new TournamentManager());

  const handlePlayerChange = useCallback((index: number, value: string) => {
    setPlayers(prev => {
      const newPlayers = [...prev];
      newPlayers[index] = value;
      return newPlayers;
    });
    setError(undefined);
  }, []);

  const handleAddNewPlayer = useCallback(() => {
    setPlayers(prev => {
      if (prev.length >= capacity) {
        setError(`Maximum ${capacity} players allowed`);
        return prev;
      }
      return [...prev, ''];
    });
  }, [capacity]);

  const handleRemovePlayer = useCallback((index: number) => {
    setPlayers(prev => prev.filter((_, i) => i !== index));
    setError(undefined);
  }, []);

  const handleCapacityChange = useCallback((newCapacity: 4 | 8) => {
    setCapacity(newCapacity);
    // Trim players array if it exceeds new capacity
    setPlayers(prev => {
      if (prev.length > newCapacity) {
        return prev.slice(0, newCapacity);
      }
      return prev;
    });
    setError(undefined);
  }, []);

  const handleStartTournament = useCallback(() => {
    const validPlayers = players.filter(p => p.trim());
    if (validPlayers.length < 2) {
      setError('At least 2 players are required');
      return;
    }

    if (validPlayers.length > capacity) {
      setError(`Maximum ${capacity} players allowed`);
      return;
    }

    const uniquePlayers = new Set(validPlayers.map(p => p.trim().toLowerCase()));
    if (uniquePlayers.size !== validPlayers.length) {
      setError('All player names must be unique');
      return;
    }

    try {
      const manager = managerRef.current;
      manager.initialize(validPlayers, tournamentName);
      manager.start();
      setSnapshot(manager.getSnapshot());
      setPhase('bracket');
      setError(undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start tournament');
    }
  }, [players, tournamentName, capacity]);

  const handleStartMatch = useCallback(() => {
    const currentMatch = managerRef.current.getCurrentMatch();
    if (!currentMatch) return;

    const newGameState = new LocalMatchState(
      currentMatch.left.name,
      currentMatch.right.name
    );
    setGameState(newGameState);
    setPhase('playing');
  }, []);

  const handleMatchComplete = useCallback((winnerSide: WinnerSide) => {
    const manager = managerRef.current;
    
    try {
      const result = manager.recordResult(winnerSide);
      setSnapshot(manager.getSnapshot());
      setGameState(null);

      if (result.champion) {
        setPhase('champion');
      } else {
        setPhase('bracket');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error recording result');
    }
  }, []);

  const handleNewTournament = useCallback(() => {
    managerRef.current.reset();
    setPlayers(['', '']);
    setTournamentName('Local Cup');
    setCapacity(4);
    setSnapshot(null);
    setGameState(null);
    setPhase('registration');
    setError(undefined);
  }, []);

  const handleBackToMenu = useCallback(() => {
    handleNewTournament();
  }, [handleNewTournament]);

  // Game loop for match play
  useGameLoop(gameState?.status.setOver ? null : gameState);
  useKeyboard(gameState !== null);

  // Force re-render for game state updates
  useEffect(() => {
    if (!gameState) return;

    const interval = setInterval(() => {
      forceUpdate(n => n + 1);
    }, 16);

    return () => clearInterval(interval);
  }, [gameState]);

  // Check if match is over and determine winner
  useEffect(() => {
    if (gameState?.status.setOver) {
      const leftScore = gameState.scoreCard.points.leftPlayer;
      const rightScore = gameState.scoreCard.points.rightPlayer;
      const winnerSide: WinnerSide = leftScore > rightScore ? 'leftPlayer' : 'rightPlayer';
      
      // Small delay to show final score before transitioning
      const timeout = setTimeout(() => {
        handleMatchComplete(winnerSide);
      }, 2000);

      return () => clearTimeout(timeout);
    }
  }, [gameState?.status.setOver, gameState?.scoreCard.points.leftPlayer, gameState?.scoreCard.points.rightPlayer, handleMatchComplete]);

  return (
    <div className="h-full flex flex-col">
      <div className="">
        <button
          onClick={() => navigate('/game')}
          className="absolute px-6 py-3 rounded-md secondary-button font-oswald text-h4 uppercase"
        >
          ← Back to Menu
        </button>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center text-slate-200">

      {phase === 'registration' && (
        <PlayerRegistrationForm
          players={players}
          tournamentName={tournamentName}
          capacity={capacity}
          onPlayerChange={handlePlayerChange}
          onAddPlayer={handleAddNewPlayer}
          onRemovePlayer={handleRemovePlayer}
          onTournamentNameChange={setTournamentName}
          onCapacityChange={handleCapacityChange}
          onStartTournament={handleStartTournament}
          error={error}
        />
      )}

        {phase === 'bracket' && snapshot && (
          <div className="flex flex-col items-center gap-6">
            <TournamentBracket snapshot={snapshot} />
            {snapshot.currentMatch && (
              <CurrentMatchDisplay
                leftPlayer={snapshot.currentMatch.left}
                rightPlayer={snapshot.currentMatch.right}
                matchId={snapshot.currentMatch.id}
                round={snapshot.currentMatch.round}
                onStartMatch={handleStartMatch}
              />
            )}
            <button
              onClick={handleBackToMenu}
              className="mt-4 px-6 py-2 rounded-md secondary-button font-roboto"
            >
              Cancel Tournament
            </button>
          </div>
        )}

        {phase === 'playing' && gameState && (
          <MatchGameView gameState={gameState} snapshot={snapshot} />
        )}

        {phase === 'champion' && snapshot && (
          <div className="flex flex-col items-center gap-6">
            <ChampionDisplay
              championName={snapshot.champion || 'Unknown'}
              tournamentName={snapshot.name}
              onNewTournament={handleNewTournament}
            />
            <TournamentBracket snapshot={snapshot} />
          </div>
        )}
      </div>
    </div>
  );
}

// Separate player registration form with individual field control
interface PlayerRegistrationFormProps {
  players: string[];
  tournamentName: string;
  capacity: 4 | 8;
  onPlayerChange: (index: number, value: string) => void;
  onAddPlayer: () => void;
  onRemovePlayer: (index: number) => void;
  onTournamentNameChange: (name: string) => void;
  onCapacityChange: (capacity: 4 | 8) => void;
  onStartTournament: () => void;
  error?: string;
}

function PlayerRegistrationForm({
  players,
  tournamentName,
  capacity,
  onPlayerChange,
  onAddPlayer,
  onRemovePlayer,
  onTournamentNameChange,
  onCapacityChange,
  onStartTournament,
  error,
}: PlayerRegistrationFormProps) {
  const canStart = players.filter(p => p.trim()).length >= 2;
  const canAddMore = players.length < capacity;

  return (
    <div className="w-full max-w-md p-6 bg-bgsecondary rounded-lg border border-white/5">
      <h2 className="text-xl font-oswald font-bold text-accent mb-4 uppercase">Tournament Setup</h2>
      
      <div className="mb-4">
        <label className="block text-gray-300 text-sm mb-2 font-roboto">Tournament Name</label>
        <input
          type="text"
          value={tournamentName}
          onChange={(e) => onTournamentNameChange(e.target.value)}
          placeholder="Enter tournament name"
          className="w-full px-4 py-2 bg-bgsecondary text-bgprimary border border-gray-600/30 rounded-[12px] focus:border-accent focus:outline-none font-roboto placeholder-bgprimary/50"
        />
      </div>

      <div className="mb-4">
        <label className="block text-white/70 text-sm mb-2 font-roboto uppercase">Bracket Size</label>
        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => onCapacityChange(4)}
            className={`flex-1 px-4 py-2 rounded-[12px] transition-colors font-oswald ${
              capacity === 4
                ? "bg-accent text-bgprimary font-bold"
                : "bg-bgprimary border border-gray-600/30 text-slate-200 hover:bg-bgprimary/80"
            }`}
          >
            4 PLAYERS
          </button>
          <button
            type="button"
            onClick={() => onCapacityChange(8)}
            className={`flex-1 px-4 py-2 rounded-[12px] transition-colors font-oswald ${
              capacity === 8
                ? "bg-accent text-bgprimary font-bold"
                : "bg-bgprimary border border-gray-600/30 text-slate-200 hover:bg-bgprimary/80"
            }`}
          >
            8 PLAYERS
          </button>
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-gray-300 text-sm mb-2 font-roboto">
          Players (minimum 2, maximum {capacity})
        </label>
        <div className="space-y-2">
          {players.map((player, index) => (
            <div key={index} className="flex gap-2">
              <input
                type="text"
                value={player}
                maxLength={10}
                onChange={(e) => onPlayerChange(index, e.target.value)}
                placeholder={`Player ${index + 1}`}
                className="flex-1 px-4 py-2 bg-bgsecondary text-bgprimary border border-gray-600/30 rounded-[12px] focus:border-accent focus:outline-none font-roboto placeholder-bgprimary/50"
              />
              {players.length > 2 && (
                <button
                  onClick={() => onRemovePlayer(index)}
                  className="px-3 py-2 bg-bgprimary/50 hover:bg-bgprimary border border-gray-600/30 text-slate-200 rounded-[12px] transition-colors"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          onClick={onAddPlayer}
          disabled={!canAddMore}
          className={`mt-2 w-full px-4 py-2 border border-gray-600/30 rounded-[12px] transition-colors font-roboto ${
            canAddMore
              ? 'bg-bgprimary/50 hover:bg-bgprimary text-slate-200'
              : 'bg-bgsecondary/20 text-gray-500 cursor-not-allowed'
          }`}
        >
          {canAddMore ? '+ Add Player' : `Maximum ${capacity} players reached`}
        </button>
      </div>

      {error && (
        <div className="mb-4 submission-error">
          {error}
        </div>
      )}

      <button
        onClick={onStartTournament}
        disabled={!canStart}
        className={`w-full px-6 py-3 font-oswald font-bold text-xl rounded-[12px] transition-all uppercase ${
          canStart
            ? 'bg-accent hover:brightness-110 text-bgprimary shadow-lg'
            : 'bg-bgsecondary/20 text-gray-400 cursor-not-allowed'
        }`}
        style={canStart ? { boxShadow: '0 0 15px rgba(102, 232, 250, 0.5)' } : {}}
      >
        START TOURNAMENT
      </button>
    </div>
  );
}

// Game view for matches
interface MatchGameViewProps {
  gameState: LocalMatchState;
  snapshot: TournamentSnapshot | null;
}

function MatchGameView({ gameState, snapshot }: MatchGameViewProps) {
  const { arena, ballCoords, paddleTrack } = gameState;
  const { groundWidth, groundHeight, ballRadius, paddleWidth, paddleHeight, paddleOffset } = arena;

  const BASE_CANVAS_WIDTH = GAME_CONFIG.arenaWidth;
  const scale = BASE_CANVAS_WIDTH / groundWidth;
  const canvasWidth = BASE_CANVAS_WIDTH;
  const canvasHeight = groundHeight * scale;

  const toCanvasX = (x: number) => (x + groundWidth / 2) * scale;
  const toCanvasY = (y: number) => (groundHeight / 2 - y) * scale;

  const ballX = toCanvasX(ballCoords.x);
  const ballY = toCanvasY(ballCoords.y);
  const ballSize = ballRadius * 2 * scale;

  const p1X = toCanvasX(-groundWidth / 2 + paddleOffset);
  const p2X = toCanvasX(groundWidth / 2 - paddleOffset);
  const p1Y = toCanvasY(paddleTrack.p1y);
  const p2Y = toCanvasY(paddleTrack.p2y);
  const paddleW = paddleWidth * scale;
  const paddleH = paddleHeight * scale;

  const isGameOver = gameState.status.setOver;

  return (
    <div className="flex flex-col items-center">
      {/* Tournament info */}
      {snapshot?.currentMatch && (
        <div className="text-sm text-gray-400 mb-2 font-roboto">
          {snapshot.name} - {snapshot.currentMatch.id}
        </div>
      )}

      {/* Scoreboard */}
      <div className="flex justify-center gap-16 mb-4 text-3xl font-oswald">
        <div className="text-center">
          <div className="text-sm text-gray-400 font-roboto">{gameState.scoreCard.usernames.left}</div>
          <div className="font-bold text-accent">{gameState.scoreCard.points.leftPlayer}</div>
        </div>
        <div className="text-gray-500">-</div>
        <div className="text-center">
          <div className="text-sm text-gray-400 font-roboto">{gameState.scoreCard.usernames.right}</div>
          <div className="font-bold text-accent">{gameState.scoreCard.points.rightPlayer}</div>
        </div>
      </div>

      {/* Game Canvas */}
      <div
        className="relative rounded-2xl border border-gray-600 overflow-hidden"
        style={{ 
          width: canvasWidth, 
          height: canvasHeight,
          backgroundColor: '#7B8A9A',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)'
        }}
      >
        {/* Center line */}
        <div
          className="absolute"
          style={{
            left: canvasWidth / 2 - 1,
            top: 0,
            width: 2,
            height: canvasHeight,
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
          }}
        />

        {/* Ball */}
        <div
          className="absolute bg-white rounded-full"
          style={{
            left: ballX - ballSize / 2,
            top: ballY - ballSize / 2,
            width: ballSize,
            height: ballSize,
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
          }}
        />

        {/* Left Paddle */}
        <div
          className="absolute bg-white rounded-full"
          style={{
            left: p1X - paddleW / 2,
            top: p1Y - paddleH / 2,
            width: paddleW,
            height: paddleH,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
          }}
        />

        {/* Right Paddle */}
        <div
          className="absolute bg-white rounded-full"
          style={{
            left: p2X - paddleW / 2,
            top: p2Y - paddleH / 2,
            width: paddleW,
            height: paddleH,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
          }}
        />
      </div>

      {/* Controls hint */}
      <div className="mt-4 text-gray-400 text-sm font-roboto">
        <span className="mr-8">Player 1: W/S keys</span>
        <span>Player 2: Arrow Up/Down</span>
      </div>

      {isGameOver && (
        <div className="mt-4 text-xl text-accent font-oswald">
          Match Complete! Returning to bracket...
        </div>
      )}
    </div>
  );
}
