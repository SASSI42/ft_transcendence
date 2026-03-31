import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './User_management/authContext';
import {
  useWebSocket,
  type ConnectionStatus,
  type ServerGameState,
  type PlayerSide,
  type MatchPlayers,
  type InputCommand,
} from "../hooks/useWebSocket";
import { GAME_CONFIG } from "../game/config";

function ReconnectionCountdown({ timeoutMs }: { timeoutMs: number }) {
  const [remainingSeconds, setRemainingSeconds] = useState(Math.ceil(timeoutMs / 1000));

  useEffect(() => {
    const endTime = Date.now() + timeoutMs;
    
    const interval = setInterval(() => {
      const remaining = Math.ceil((endTime - Date.now()) / 1000);
      setRemainingSeconds(Math.max(0, remaining));
      
      if (remaining <= 0) {
        clearInterval(interval);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [timeoutMs]);

  return (
    <div className="text-4xl font-bold text-accent font-oswald mb-4">
      {remainingSeconds}s
    </div>
  );
}

export function RemoteGame() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [username, setUsername] = useState("");
  const isInvite = location.state?.fromInvite === true;
  const [shouldAutoConnect, setShouldAutoConnect] = useState(true);
  const {
    connectionStatus,
    gameState,
    playerSide,
    players,
    winner,
    errorMessage,
    reconnectionTimeoutMs,
    matchEndReason,
    connect,
    disconnect,
    sendInput,
    sendReady,
  } = useWebSocket();

  const statusRef = useRef(connectionStatus);

  useEffect(() => {
    statusRef.current = connectionStatus;
  }, [connectionStatus]);

  useEffect(() => {
    if (user?.username && connectionStatus === "disconnected" && shouldAutoConnect) {
      setUsername(user.username);
      connect(user.username, isInvite);
      if (isInvite) {
        navigate(location.pathname, { replace: true, state: {} });
      }
    }
  }, [user, connectionStatus, connect, shouldAutoConnect, isInvite, navigate, location.pathname]);

  const handleDisconnect = useCallback(() => {
    setShouldAutoConnect(false);
    disconnect();
    setUsername("");
    navigate('/game');
  }, [disconnect, navigate]);

  const handlePlayAgain = useCallback(() => {
    disconnect();
    setUsername("");
    setShouldAutoConnect(true);
  }, [disconnect]);

  useEffect(() => {
    if (connectionStatus === "matched" && gameState?.status === "ready") {
      sendReady();
    }
  }, [connectionStatus, gameState?.status, sendReady]);

  useEffect(() => {
    return () => {
      setShouldAutoConnect(false);
      if (statusRef.current === 'queued') {
        disconnect();
      }
    };
  }, [disconnect]);

  return (
    <div className="h-full w-full flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center text-slate-200 p-4">
        <h1 className="text-6xl font-oswald font-bold mb-8 text-accent uppercase" style={{ textShadow: '0 0 20px rgba(102, 232, 250, 0.5)' }}>
          REMOTE 1V1
        </h1>

      <ConnectionStatusBadge status={connectionStatus} />

      {connectionStatus === "disconnected" && !user?.username && (
        <div className="text-center">
          <p className="text-red-400 font-roboto mb-4">No user found. Please log in.</p>
          <button
            onClick={() => navigate('/signin')}
            className="px-6 py-3 rounded-md primary-button font-oswald text-h4 uppercase"
          >
            Go to Login
          </button>
        </div>
      )}

      {connectionStatus === "connecting" && <LoadingSpinner text="Connecting to game server..." />}

        {connectionStatus === "queued" && (
          <div className="text-center">
            <LoadingSpinner text="Searching for opponent..." />
            <button
              onClick={handleDisconnect}
              className="mt-4 px-4 py-2 rounded-md secondary-button font-roboto"
            >
              Cancel
            </button>
          </div>
        )}

        {connectionStatus === "matched" && gameState && players && (
          <div className="text-center">
            <MatchInfo players={players} playerSide={playerSide} />
            <LoadingSpinner text="Get ready..." />
          </div>
        )}

        {connectionStatus === "playing" && gameState && players && playerSide && (
          <GameView
            gameState={gameState}
            players={players}
            playerSide={playerSide}
            sendInput={sendInput}
          />
        )}

        {connectionStatus === "ended" && gameState && players && (
          <GameOverView
            gameState={gameState}
            players={players}
            winner={winner}
            username={username}
            matchEndReason={matchEndReason}
            onPlayAgain={handlePlayAgain}
          />
        )}

        {connectionStatus === "opponent_disconnected" && (
          <div className="text-center">
            <div className="text-2xl text-yellow-400 mb-4 font-oswald">
              Opponent Disconnected
            </div>
            {reconnectionTimeoutMs && (
              <>
                <ReconnectionCountdown timeoutMs={reconnectionTimeoutMs} />
                <p className="text-gray-400 mb-6 font-roboto">
                  Waiting for opponent to reconnect...
                </p>
                <p className="text-sm text-gray-500 mb-4 font-roboto">
                  If they don't reconnect, you'll win by forfeit
                </p>
              </>
            )}
            {!reconnectionTimeoutMs && (
              <p className="text-gray-400 mb-6 font-roboto">
                Opponent has left the match
              </p>
            )}
          </div>
        )}

        {connectionStatus === "error" && (
          <div className="text-center">
            <div className="text-2xl text-red-400 mb-4 font-oswald">Connection Error</div>
            <p className="text-gray-400 mb-4 font-roboto">{errorMessage || "An error occurred"}</p>
            <button
              onClick={handleDisconnect}
              className="px-4 py-2 rounded-lg primary-button font-oswald font-bold"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

interface ConnectionStatusBadgeProps {
  status: ConnectionStatus;
}

function ConnectionStatusBadge({ status }: ConnectionStatusBadgeProps) {
  const statusColors: Record<ConnectionStatus, string> = {
    disconnected: "bg-gray-600",
    connecting: "bg-yellow-600",
    connected: "bg-green-600",
    queued: "bg-blue-600",
    matched: "bg-purple-600",
    playing: "bg-green-500",
    ended: "bg-gray-500",
    error: "bg-red-600",
    opponent_disconnected: "bg-yellow-600",
  };

  const statusLabels: Record<ConnectionStatus, string> = {
    disconnected: "Disconnected",
    connecting: "Connecting...",
    connected: "Connected",
    queued: "In Queue",
    matched: "Matched",
    playing: "Playing",
    ended: "Game Over",
    error: "Error",
    opponent_disconnected: "Opponent Disconnected",
  };

  return (
    <div
      className={`px-3 py-1 rounded-full text-sm font-medium mb-4 ${statusColors[status]}`}
    >
      {statusLabels[status]}
    </div>
  );
}

interface LoadingSpinnerProps {
  text: string;
}

function LoadingSpinner({ text }: LoadingSpinnerProps) {
  return (
    <div className="flex flex-col items-center">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-accent mb-4"></div>
      <p className="text-gray-400 font-roboto">{text}</p>
    </div>
  );
}

interface MatchInfoProps {
  players: MatchPlayers;
  playerSide: PlayerSide | null;
}

function MatchInfo({ players, playerSide }: MatchInfoProps) {
  return (
    <div className="mb-4">
      <div className="text-xl text-gray-300 mb-2 font-oswald">Match Found!</div>
      <div className="flex justify-center gap-8 text-lg font-roboto">
        <div
          className={`${
            playerSide === "left" ? "text-accent font-bold" : "text-gray-400"
          }`}
        >
          {players.left.username}
          {playerSide === "left" && " (You)"}
        </div>
        <div className="text-gray-500">vs</div>
        <div
          className={`${
            playerSide === "right" ? "text-accent font-bold" : "text-gray-400"
          }`}
        >
          {players.right.username}
          {playerSide === "right" && " (You)"}
        </div>
      </div>
    </div>
  );
}

interface GameViewProps {
  gameState: ServerGameState;
  players: MatchPlayers;
  playerSide: PlayerSide;
  sendInput: (command: InputCommand) => void;
}

function GameView({ gameState, players, playerSide, sendInput }: GameViewProps) {
  const currentInputRef = useRef<InputCommand>("stop");

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;

      let newCommand: InputCommand | null = null;

      if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") {
        newCommand = "up";
        e.preventDefault();
      } else if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") {
        newCommand = "down";
        e.preventDefault();
      }

      if (newCommand && newCommand !== currentInputRef.current) {
        currentInputRef.current = newCommand;
        sendInput(newCommand);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const isUp = e.key === "ArrowUp" || e.key === "w" || e.key === "W";
      const isDown = e.key === "ArrowDown" || e.key === "s" || e.key === "S";

      if (isUp || isDown) {
        e.preventDefault();
        if (currentInputRef.current !== "stop") {
          currentInputRef.current = "stop";
          sendInput("stop");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [sendInput]);

  return (
    <div className="flex flex-col items-center">
      <div className="flex justify-center gap-16 mb-4 text-3xl font-oswald">
        <div className="text-center">
          <div
            className={`text-sm font-roboto ${
              playerSide === "left" ? "text-accent" : "text-gray-400"
            }`}
          >
            {players.left.username}
            {playerSide === "left" && " (You)"}
          </div>
          <div className="font-bold text-accent">{gameState.score.left}</div>
        </div>
        <div className="text-gray-500">-</div>
        <div className="text-center">
          <div
            className={`text-sm font-roboto ${
              playerSide === "right" ? "text-accent" : "text-gray-400"
            }`}
          >
            {players.right.username}
            {playerSide === "right" && " (You)"}
          </div>
          <div className="font-bold text-accent">{gameState.score.right}</div>
        </div>
      </div>

      <RemoteGameCanvas gameState={gameState} />

      <div className="mt-4 text-gray-400 text-sm font-roboto">
        <span>Use Arrow Up/Down or W/S keys to move your paddle</span>
      </div>
    </div>
  );
}

interface RemoteGameCanvasProps {
  gameState: ServerGameState;
}

function RemoteGameCanvas({ gameState }: RemoteGameCanvasProps) {
  const { arenaWidth, arenaHeight, paddle, ball } = GAME_CONFIG;

  const ballX = gameState.ball.position.x;
  const ballY = gameState.ball.position.y;
  const ballSize = ball.radius * 2;

  const leftPaddleX = 0;
  const rightPaddleX = arenaWidth - paddle.width;
  const leftPaddleY = gameState.paddles.left.position;
  const rightPaddleY = gameState.paddles.right.position;

  return (
    <div
      className="relative rounded-2xl border border-gray-600 overflow-hidden"
      style={{ 
        width: arenaWidth, 
        height: arenaHeight,
        backgroundColor: '#7B8A9A',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)'
      }}
    >
      <div
        className="absolute"
        style={{
          left: arenaWidth / 2 - 1,
          top: 0,
          width: 2,
          height: arenaHeight,
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
        }}
      />

      <div
        className="absolute bg-white rounded-full"
        style={{
          left: ballX - ball.radius,
          top: ballY - ball.radius,
          width: ballSize,
          height: ballSize,
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
        }}
      />

      <div
        className="absolute bg-white rounded-full"
        style={{
          left: leftPaddleX,
          top: leftPaddleY - paddle.height / 2,
          width: paddle.width,
          height: paddle.height,
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
        }}
      />

      <div
        className="absolute bg-white rounded-full"
        style={{
          left: rightPaddleX,
          top: rightPaddleY - paddle.height / 2,
          width: paddle.width,
          height: paddle.height,
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
        }}
      />
    </div>
  );
}

interface GameOverViewProps {
  gameState: ServerGameState;
  players: MatchPlayers;
  winner: PlayerSide | null;
  username: string;
  matchEndReason: "finished" | "forfeit" | "tie" | null;
  onPlayAgain: () => void;
}

function GameOverView({
  gameState,
  players,
  winner,
  username,
  matchEndReason,
  onPlayAgain,
}: GameOverViewProps) {
  const isWinner =
    winner &&
    ((winner === "left" && players.left.username === username) ||
      (winner === "right" && players.right.username === username));

  return (
    <div className="flex flex-col items-center">
      <div className="flex justify-center gap-16 mb-4 text-3xl font-oswald">
        <div className="text-center">
          <div className="text-sm text-gray-400 font-roboto">{players.left.username}</div>
          <div className="font-bold text-accent">{gameState.score.left}</div>
        </div>
        <div className="text-gray-500">-</div>
        <div className="text-center">
          <div className="text-sm text-gray-400 font-roboto">{players.right.username}</div>
          <div className="font-bold text-accent">{gameState.score.right}</div>
        </div>
      </div>

      <div className="text-center mb-8">
        <div
          className={`text-4xl font-oswald font-bold mb-2 ${
            isWinner ? "text-accent" : "text-gray-400"
          }`}
        >
          {isWinner ? "YOU WIN!" : "YOU LOSE!"}
        </div>
        <div className="text-xl text-gray-400 font-roboto">
          {winner && matchEndReason === "forfeit" ? (
            <span>
              {players[winner].username} wins by forfeit!
              <span className="block text-sm text-gray-500 mt-2">
                Opponent failed to reconnect
              </span>
            </span>
          ) : (
            winner && `${players[winner].username} wins the match!`
          )}
        </div>
      </div>

      <button
        onClick={onPlayAgain}
        className="px-8 py-4 bg-cyan-neon hover:bg-cyan-glow text-bg-primary font-oswald font-bold text-xl rounded-xl transition-all shadow-lg"
        style={{ boxShadow: '0 0 15px rgba(0, 207, 255, 0.3)' }}
      >
        PLAY AGAIN
      </button>
    </div>
  );
}
