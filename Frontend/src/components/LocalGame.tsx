import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { GAME_CONFIG } from '../game/config';
import { LocalMatchState } from '../game/state/models';
import { useGameLoop } from '../hooks/useGameLoop';
import { useKeyboard } from '../hooks/useKeyboard';

export function LocalGame() {
  const navigate = useNavigate();
  const [gameState, setGameState] = useState<LocalMatchState | null>(null);
  const [, forceUpdate] = useState(0);
  const gameStateRef = useRef<LocalMatchState | null>(null);

  const startGame = useCallback(() => {
    const newState = new LocalMatchState('Player 1', 'Player 2');
    gameStateRef.current = newState;
    setGameState(newState);
  }, []);

  const resetGame = useCallback(() => {
    gameStateRef.current = null;
    setGameState(null);
  }, []);

  useGameLoop(gameState?.status.setOver ? null : gameState);
  useKeyboard(gameState !== null);

  useEffect(() => {
    if (!gameState) return;

    const interval = setInterval(() => {
      forceUpdate(n => n + 1);
    }, 16);

    return () => clearInterval(interval);
  }, [gameState]);

  const isGameOver = gameState?.status.setOver;

  return (
    <div className="flex flex-col h-full w-full">
      <div className="">
        <button
          onClick={() => navigate('/game')}
          className="absolute px-6 py-3 rounded-md secondary-button font-oswald text-h4 uppercase"
        >
          ← Back to Menu
        </button>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center text-slate-200">
        <h1 className="text-xl font-oswald font-bold text-accent uppercase" style={{ textShadow: '0 0 20px rgba(102, 232, 250, 0.5)' }}>
          LOCAL 1V1
        </h1>

        {!gameState && (
          <button
            onClick={startGame}
            className="px-8 py-4 bg-accent hover:brightness-110 text-bgprimary font-oswald font-bold text-xl rounded-[12px] transition-all shadow-lg"
            style={{ boxShadow: '0 0 15px rgba(102, 232, 250, 0.5)' }}
          >
            START GAME
          </button>
        )}

        {gameState && (
          <div className="relative flex flex-col items-center">
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

          <GameCanvas gameState={gameState} />

          <div className="mt-2 text-gray-400 text-sm font-h4body">
            <span className="mr-8">Player 1: W/S keys</span>
            <span>Player 2: Arrow Up/Down</span>
          </div>

            {isGameOver && (
              <div className="absolute top-1/3 flex flex-col items-center">
                <div className="text-2xl mb-4 font-oswald text-accent uppercase">
                  {gameState.scoreCard.points.leftPlayer > gameState.scoreCard.points.rightPlayer
                    ? gameState.scoreCard.usernames.left
                    : gameState.scoreCard.usernames.right}{' '}
                  WINS!
                </div>
                <button
                  onClick={resetGame}
                  className="px-8 py-4 bg-accent hover:brightness-110 text-bgprimary font-oswald font-bold text-xl rounded-[12px] transition-all shadow-lg"
                >
                  PLAY AGAIN
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface GameCanvasProps {
  gameState: LocalMatchState;
}

function GameCanvas({ gameState }: GameCanvasProps) {
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

  return (
    <div
      className="relative rounded-2xl border border-gray-600 overflow-hidden"
      style={{ 
        width: canvasWidth, 
        height: canvasHeight,
        backgroundColor: '#7B8A9A',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)'
      }}
    >
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
  );
}
