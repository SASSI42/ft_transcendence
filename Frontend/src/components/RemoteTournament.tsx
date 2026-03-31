import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './User_management/authContext';
import {
  useTournamentWebSocket,
  type TournamentConnectionStatus,
  type TournamentSnapshot,
  type TournamentParticipantSnapshot,
  type TournamentBracketMatchSnapshot,
  type TournamentBracketRoundSnapshot,
  type ServerGameState,
  type PlayerSide,
  type MatchPlayers,
  type InputCommand,
} from "../hooks/useTournamentWebSocket";
import { GAME_CONFIG } from "../game/config";
import { TournamentBracket } from '../game/tournaments/TournamentBracket';
import type { TournamentSnapshot as LocalTournamentSnapshot } from '../game/tournaments/manager';

type TournamentPhase = "lobby" | "create" | "join" | "waiting" | "bracket" | "playing";

export function RemoteTournament() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth(); // Get authenticated user
  const queryParams = new URLSearchParams(location.search);
  const codeFromUrl = queryParams.get('code');
  const modeFromUrl = queryParams.get('mode'); // Check if user wants to create directly
  
  const [uiPhase, setUiPhase] = useState<"lobby" | "create" | "join">(
    codeFromUrl ? "join" : modeFromUrl === "create" ? "create" : "lobby"
  );
  const [inputAlias, setInputAlias] = useState(user?.username || "");
  const [inputCode, setInputCode] = useState(codeFromUrl || "");
  const [inputTournamentName, setInputTournamentName] = useState("Remote Cup");
  const [inputCapacity, setInputCapacity] = useState<4 | 8>(8);
  const [hasAttemptedAutoJoin, setHasAttemptedAutoJoin] = useState(false);

  const {
    connectionStatus,
    tournamentSnapshot,
    tournamentCode,
    alias,
    errorMessage,
    gameState,
    playerSide,
    players,
    winner,
    reconnectionTimeoutMs,
    opponentDisconnected,
    connect,
    disconnect,
    createTournament,
    joinTournament,
    leaveTournament,
    setReady,
    sendInput,
    sendReady,
  } = useTournamentWebSocket();

  // Connect on mount if not connected
  useEffect(() => {
    if (connectionStatus === "disconnected") {
      void connect();
    }
  }, [connectionStatus, connect]);

  // Auto-populate username from authenticated user
  useEffect(() => {
    if (user?.username && !inputAlias) {
      setInputAlias(user.username);
    }
  }, [user, inputAlias]);

  // Redirect to game lobby if no code or mode specified AND no stored tournament
  useEffect(() => {
    const hasStoredTournament = sessionStorage.getItem("activeTournamentCode");
    if (!codeFromUrl && !modeFromUrl && !hasStoredTournament && uiPhase === "lobby") {
      navigate('/game');
    }
  }, [codeFromUrl, modeFromUrl, uiPhase, navigate]);

  // Auto-join tournament if code is provided in URL
  useEffect(() => {
    if (codeFromUrl && inputAlias && connectionStatus === "connected" && !tournamentSnapshot && !hasAttemptedAutoJoin) {
      setHasAttemptedAutoJoin(true);
      
      // Small delay to ensure socket listeners are set up
      setTimeout(() => {
        joinTournament(codeFromUrl.toUpperCase(), inputAlias);
      }, 100);
    }
  }, [codeFromUrl, inputAlias, connectionStatus, tournamentSnapshot, hasAttemptedAutoJoin, joinTournament]);

  // Compute phase based on connection status and tournament state
  const phase: TournamentPhase = (() => {
    if (connectionStatus === "in_match" && gameState) {
      return "playing";
    }
    // Show waiting room/bracket if we have tournament snapshot and alias (joined)
    // Skip champion phase - we auto-navigate instead
    if (tournamentSnapshot && alias) {
      if (tournamentSnapshot.bracket) {
        return "bracket";
      }
      return "waiting";
    }
    // If auto-joining (code from URL), show join phase with loading spinner
    if (codeFromUrl && inputAlias && connectionStatus === "connected" && !tournamentSnapshot) {
      return "join";
    }
    // Fall back to user-selected UI phase for lobby/create/join
    return uiPhase;
  })();


  // Auto-send ready when match starts
  useEffect(() => {
    if (connectionStatus === "in_match" && gameState?.status === "ready") {
      sendReady();
    }
  }, [connectionStatus, gameState?.status, sendReady]);

  // Navigate back to game menu when tournament ends (champion is declared)
  useEffect(() => {
    if (tournamentSnapshot?.bracket?.champion) {
      // Wait 3 seconds to let players see the winner in the bracket, then navigate back
      const timer = setTimeout(() => {
        disconnect();
        navigate('/game');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [tournamentSnapshot?.bracket?.champion, disconnect, navigate]);

  const handleCreateTournament = useCallback(() => {
    if (!inputAlias.trim() || !inputTournamentName.trim()) return;
    createTournament(inputTournamentName.trim(), inputAlias.trim(), inputCapacity);
  }, [inputAlias, inputTournamentName, inputCapacity, createTournament]);

  const handleJoinTournament = useCallback(() => {
    if (!inputAlias.trim() || !inputCode.trim()) return;
    joinTournament(inputCode.trim().toUpperCase(), inputAlias.trim());
  }, [inputAlias, inputCode, joinTournament]);

  const handleLeaveTournament = useCallback(() => {
    leaveTournament();
    navigate('/game');
  }, [leaveTournament, navigate]);

  const handleToggleReady = useCallback(() => {
    if (!tournamentSnapshot || !alias) return;
    const participant = tournamentSnapshot.participants.find(p => p.alias === alias);
    if (participant) {
      setReady(!participant.ready);
    }
  }, [tournamentSnapshot, alias, setReady]);

  return (
    <div className="h-full w-full flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center text-slate-200 p-4">
        <h1 className="text-5xl font-oswald font-bold mb-8 text-accent uppercase" style={{ textShadow: '0 0 20px rgba(102, 232, 250, 0.5)' }}>
          REMOTE TOURNAMENT
        </h1>

      <ConnectionStatusBadge status={connectionStatus} />

        {errorMessage && (
          <div className="mb-4 submission-error max-w-md text-center font-roboto">
            {errorMessage}
          </div>
        )}

        {/* Lobby - Choose to create or join */}
        {phase === "lobby" && connectionStatus === "connected" && (
          <div className="flex flex-col items-center gap-4">
            <p className="text-gray-400 mb-4 font-roboto">Create a new tournament or join an existing one</p>
            <div className="flex gap-4">
              <button
                onClick={() => setUiPhase("create")}
                className="px-8 py-4 bg-accent hover:brightness-110 text-bgprimary font-oswald font-bold text-xl rounded-[12px] transition-all shadow-lg"
                style={{ boxShadow: '0 0 15px rgba(102, 232, 250, 0.5)' }}
              >
                CREATE TOURNAMENT
              </button>
              <button
                onClick={() => setUiPhase("join")}
                className="px-8 py-4 bg-bgsecondary hover:bg-bgprimary border-2 border-accent text-accent font-oswald font-bold text-xl rounded-[12px] transition-all"
              >
                JOIN TOURNAMENT
              </button>
            </div>
          </div>
        )}

      {/* Create Tournament Form */}
      {phase === "create" && connectionStatus === "connected" && (
        <CreateTournamentForm
          inputAlias={inputAlias}
          inputTournamentName={inputTournamentName}
          inputCapacity={inputCapacity}
          setInputTournamentName={setInputTournamentName}
          setInputCapacity={setInputCapacity}
          onSubmit={handleCreateTournament}
          onBack={() => navigate('/game')}
        />
      )}

      {/* Join Tournament Form */}
      {phase === "join" && connectionStatus === "connected" && (
        <>
          {codeFromUrl && inputAlias && !tournamentSnapshot ? (
            // Auto-joining with code from URL - show loading instead of form
            <LoadingSpinner text={`Joining tournament ${codeFromUrl}...`} />
          ) : (
            // Manual join - show form
            <JoinTournamentForm
              inputAlias={inputAlias}
              inputCode={inputCode}
              setInputCode={setInputCode}
              onSubmit={handleJoinTournament}
              onBack={() => navigate('/game')}
            />
          )}
        </>
      )}

      {/* Waiting Room - Before bracket is generated */}
      {phase === "waiting" && tournamentSnapshot && (
        <WaitingRoom
          snapshot={tournamentSnapshot}
          tournamentCode={tournamentCode}
          alias={alias}
          onToggleReady={handleToggleReady}
          onLeave={handleLeaveTournament}
        />
      )}

      {/* Bracket View */}
      {phase === "bracket" && tournamentSnapshot && (
        <BracketView
          snapshot={tournamentSnapshot}
          alias={alias}
          onToggleReady={handleToggleReady}
        />
      )}

      {/* Playing Match */}
      {phase === "playing" && gameState && players && playerSide && (
        <TournamentMatchView
          gameState={gameState}
          players={players}
          playerSide={playerSide}
          winner={winner}
          tournamentSnapshot={tournamentSnapshot}
          reconnectionTimeoutMs={reconnectionTimeoutMs}
          opponentDisconnected={opponentDisconnected}
          sendInput={sendInput}
        />
      )}

        {/* Loading / Connecting States */}
        {connectionStatus === "connecting" && (
          <LoadingSpinner text="Connecting to server..." />
        )}

        {connectionStatus === "error" && (
          <div className="text-center">
            <p className="text-red-400 mb-4 font-roboto">{errorMessage || "Connection error"}</p>
            <button
              onClick={() => void connect()}
              className="px-4 py-2 bg-cyan-neon hover:bg-cyan-glow text-bg-primary rounded-lg transition-colors font-oswald font-bold"
            >
              RECONNECT
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

interface ConnectionStatusBadgeProps {
  status: TournamentConnectionStatus;
}

function ConnectionStatusBadge({ status }: ConnectionStatusBadgeProps) {
  const statusColors: Record<TournamentConnectionStatus, string> = {
    disconnected: "bg-gray-600",
    connecting: "bg-yellow-600",
    connected: "bg-green-600",
    joined: "bg-purple-600",
    in_match: "bg-cyan-500",
    error: "bg-red-600",
  };

  const statusLabels: Record<TournamentConnectionStatus, string> = {
    disconnected: "Disconnected",
    connecting: "Connecting...",
    connected: "Connected",
    joined: "In Tournament",
    in_match: "Playing Match",
    error: "Error",
  };

  return (
    <div
      className={`px-3 py-1 rounded-full text-sm font-medium mb-4 ${statusColors[status]}`}
    >
      {statusLabels[status]}
    </div>
  );
}

interface CreateTournamentFormProps {
  inputAlias: string;
  inputTournamentName: string;
  inputCapacity: 4 | 8;
  setInputTournamentName: (value: string) => void;
  setInputCapacity: (value: 4 | 8) => void;
  onSubmit: () => void;
  onBack: () => void;
}

function CreateTournamentForm({
  inputAlias,
  inputTournamentName,
  inputCapacity,
  setInputTournamentName,
  setInputCapacity,
  onSubmit,
  onBack,
}: CreateTournamentFormProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit();
  };

  const canSubmit = inputAlias.trim() && inputTournamentName.trim();

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md p-6 bg-bgsecondary rounded-lg border border-white/5">
      <h2 className="text-2xl font-oswald font-bold text-accent mb-4 uppercase">Create Tournament</h2>

      <div className="mb-4">
        <label className="block text-gray-300 text-sm mb-2 font-roboto">Tournament Name</label>
        <input
          type="text"
          value={inputTournamentName}
          onChange={(e) => setInputTournamentName(e.target.value)}
          placeholder="Enter tournament name"
          className="w-full px-4 py-2 bg-bgsecondary text-bgprimary border border-gray-600/30 rounded-[12px] focus:border-accent focus:outline-none font-roboto placeholder-bgprimary/50"
          maxLength={64}
        />
      </div>

      <div className="mb-4">
        <label className="block text-gray-300 text-sm mb-2 font-roboto">Your Alias</label>
        <div className="w-full px-4 py-3 bg-bgsecondary text-bgprimary border border-gray-600/30 rounded-[12px] font-roboto cursor-not-allowed">
          {inputAlias || "Not logged in"}
        </div>
        <p className="text-xs text-gray-400 mt-1 font-roboto">Username from your account</p>
      </div>

      <div className="mb-6">
        <label className="block text-white/70 text-sm mb-2 font-roboto uppercase">Bracket Size</label>
        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => setInputCapacity(4)}
            className={`flex-1 px-4 py-2 rounded-[12px] transition-colors font-oswald ${
              inputCapacity === 4
                ? "bg-accent text-bgprimary font-bold"
                : "bg-bgprimary border border-gray-600/30 text-slate-200 hover:bg-bgprimary/80"
            }`}
          >
            4 PLAYERS
          </button>
          <button
            type="button"
            onClick={() => setInputCapacity(8)}
            className={`flex-1 px-4 py-2 rounded-[12px] transition-colors font-oswald ${
              inputCapacity === 8
                ? "bg-accent text-bgprimary font-bold"
                : "bg-bgprimary border border-gray-600/30 text-slate-200 hover:bg-bgprimary/80"
            }`}
          >
            8 PLAYERS
          </button>
        </div>
      </div>

      <div className="flex gap-4">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 px-4 py-2 bg-bgprimary/50 hover:bg-bgprimary border border-gray-600/30 text-slate-200 rounded-[12px] transition-colors font-roboto"
        >
          Back
        </button>
        <button
          type="submit"
          disabled={!canSubmit}
          className={`flex-1 px-4 py-2 font-oswald font-bold rounded-[12px] transition-all ${
            canSubmit
              ? "bg-accent hover:brightness-110 text-bgprimary shadow-lg"
              : "bg-bgsecondary/20 text-gray-400 cursor-not-allowed"
          }`}
          style={canSubmit ? { boxShadow: '0 0 15px rgba(102, 232, 250, 0.5)' } : {}}
        >
          CREATE
        </button>
      </div>
    </form>
  );
}

interface JoinTournamentFormProps {
  inputAlias: string;
  inputCode: string;
  setInputCode: (value: string) => void;
  onSubmit: () => void;
  onBack: () => void;
}

function JoinTournamentForm({
  inputAlias,
  inputCode,
  setInputCode,
  onSubmit,
  onBack,
}: JoinTournamentFormProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit();
  };

  const canSubmit = inputAlias.trim() && inputCode.trim();

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md p-6 bg-bgsecondary rounded-lg border border-white/5">
      <h2 className="text-2xl font-oswald font-bold text-accent mb-4 uppercase">Join Tournament</h2>

      <div className="mb-4">
        <label className="block text-gray-300 text-sm mb-2 font-roboto">Tournament Code</label>
        <input
          type="text"
          value={inputCode}
          onChange={(e) => setInputCode(e.target.value.toUpperCase())}
          placeholder="Enter tournament code"
          className="w-full px-4 py-2 bg-bgsecondary text-bgprimary border border-gray-600/30 rounded-[12px] focus:border-accent focus:outline-none uppercase font-mono placeholder-bgprimary/50"
          maxLength={8}
        />
      </div>

      <div className="mb-6">
        <label className="block text-gray-300 text-sm mb-2 font-roboto">Your Alias</label>
        <div className="w-full px-4 py-3 bg-bgsecondary text-bgprimary border border-gray-600/30 rounded-[12px] font-roboto cursor-not-allowed">
          {inputAlias || "Not logged in"}
        </div>
        <p className="text-xs text-gray-400 mt-1 font-roboto">Username from your account</p>
      </div>

      <div className="flex gap-4">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 px-4 py-2 bg-bgprimary/50 hover:bg-bgprimary border border-gray-600/30 text-slate-200 rounded-[12px] transition-colors font-roboto"
        >
          Back
        </button>
        <button
          type="submit"
          disabled={!canSubmit}
          className={`flex-1 px-4 py-2 font-oswald font-bold rounded-[12px] transition-all ${
            canSubmit
              ? "bg-accent hover:brightness-110 text-bgprimary shadow-lg"
              : "bg-bgsecondary/20 text-gray-400 cursor-not-allowed"
          }`}
          style={canSubmit ? { boxShadow: '0 0 15px rgba(102, 232, 250, 0.5)' } : {}}
        >
          JOIN
        </button>
      </div>
    </form>
  );
}

interface WaitingRoomProps {
  snapshot: TournamentSnapshot;
  tournamentCode: string | null;
  alias: string | null;
  onToggleReady: () => void;
  onLeave: () => void;
}

function WaitingRoom({
  snapshot,
  tournamentCode,
  alias,
  onToggleReady,
  onLeave,
}: WaitingRoomProps) {
  const currentParticipant = snapshot.participants.find(p => p.alias === alias);
  const isReady = currentParticipant?.ready ?? false;
  const readyCount = snapshot.participants.filter(p => p.ready).length;
  const connectedCount = snapshot.participants.filter(p => p.connected).length;

  return (
    <div className="w-full max-w-lg p-6 bg-bgsecondary rounded-lg border border-white/5">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h2 className="text-2xl font-oswald font-bold text-accent">{snapshot.name}</h2>
          <p className="text-gray-400 text-sm font-roboto">
            Waiting for players ({snapshot.participants.length}/{snapshot.capacity ?? 8})
          </p>
        </div>
        {tournamentCode && (
          <div className="text-right">
            <div className="text-gray-400 text-sm font-roboto">Share Code</div>
            <div className="text-2xl font-mono font-bold text-accent">{tournamentCode}</div>
          </div>
        )}
      </div>

      <div className="mb-6">
        <h3 className="text-gray-300 text-sm mb-2 font-roboto">Players ({connectedCount} connected, {readyCount} ready)</h3>
        <div className="space-y-2">
          {snapshot.participants.map((participant) => (
            <ParticipantRow
              key={participant.alias}
              participant={participant}
              isCurrentUser={participant.alias === alias}
            />
          ))}
        </div>
      </div>

      <div className="flex gap-4">
        <button
          onClick={onLeave}
          className="flex-1 px-4 py-2 bg-bgprimary/50 hover:bg-bgprimary border border-gray-600/30 text-slate-200 rounded-[12px] transition-colors font-roboto"
        >
          Leave
        </button>
        <button
          onClick={onToggleReady}
          className={`flex-1 px-4 py-2 font-oswald font-bold rounded-[12px] transition-all ${
            isReady
              ? "bg-bgprimary/50 hover:bg-bgprimary border border-accent text-accent"
              : "bg-accent hover:brightness-110 text-bgprimary shadow-lg"
          }`}
          style={!isReady ? { boxShadow: '0 0 15px rgba(102, 232, 250, 0.5)' } : {}}
        >
          {isReady ? "CANCEL READY" : "READY"}
        </button>
      </div>
    </div>
  );
}

interface ParticipantRowProps {
  participant: TournamentParticipantSnapshot;
  isCurrentUser: boolean;
}

function ParticipantRow({ participant, isCurrentUser }: ParticipantRowProps) {
  return (
    <div
      className={`flex items-center justify-between p-1.5 rounded-[8px] border ${
        isCurrentUser ? "bg-bgprimary border-accent" : "bg-bgsecondary border-gray-600/30"
      }`}
    >
      <div className="flex items-center gap-1.5">
        <div
          className={`w-1.5 h-1.5 rounded-full ${
            participant.connected ? "bg-accent" : "bg-gray-500"
          }`}
        />
        <span className={`font-roboto text-xs ${isCurrentUser ? "text-accent font-bold" : "text-slate-200"}`}>
          {participant.alias}
          {isCurrentUser && " (you)"}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        {participant.inMatch && (
          <span className="text-[10px] px-1.5 py-0.5 bg-accent text-bgprimary rounded font-roboto font-bold">Playing</span>
        )}
        {participant.ready && !participant.inMatch && (
          <span className="text-[10px] px-1.5 py-0.5 bg-accent text-bgprimary rounded font-roboto font-bold">Ready</span>
        )}
      </div>
    </div>
  );
}

/**
 * Convert remote tournament snapshot to local tournament snapshot format
 * for use with the TournamentBracket component
 */
function convertToLocalSnapshot(remoteSnapshot: TournamentSnapshot): LocalTournamentSnapshot {
  if (!remoteSnapshot.bracket) {
    return {
      name: remoteSnapshot.name,
      currentRound: 1,
      rounds: [],
      capacity: remoteSnapshot.capacity,
      currentMatch: undefined,
      champion: undefined,
    };
  }

  return {
    name: remoteSnapshot.name,
    currentRound: remoteSnapshot.bracket.currentRound,
    rounds: remoteSnapshot.bracket.rounds,
    capacity: remoteSnapshot.capacity,
    currentMatch: remoteSnapshot.bracket.currentMatch,
    champion: remoteSnapshot.bracket.champion,
  };
}

interface BracketViewProps {
  snapshot: TournamentSnapshot;
  alias: string | null;
  onToggleReady: () => void;
}

function BracketView({
  snapshot,
  alias,
  onToggleReady,
}: BracketViewProps) {
  const currentParticipant = snapshot.participants.find(p => p.alias === alias);
  const isReady = currentParticipant?.ready ?? false;
  const isInMatch = currentParticipant?.inMatch ?? false;
  const playerMatch = alias && snapshot.bracket
    ? getUpcomingMatchForPlayer(snapshot.bracket.rounds, alias)
    : null;
  const opponentAlias = playerMatch
    ? playerMatch.left === alias
      ? playerMatch.right
      : playerMatch.left
    : null;
  const opponentParticipant = opponentAlias
    ? snapshot.participants.find(p => p.alias === opponentAlias)
    : undefined;

  // Convert remote snapshot to local format
  const localSnapshot = convertToLocalSnapshot(snapshot);

  return (
    <div className="flex flex-col items-center gap-3 w-full max-w-5xl overflow-y-auto pb-4">
      {/* Use the same TournamentBracket component as local tournament */}
      <div className="scale-90 origin-top">
        <TournamentBracket snapshot={localSnapshot} />
      </div>

      <PlayerMatchPanel
        alias={alias}
        match={playerMatch}
        isReady={isReady}
        isInMatch={isInMatch}
        opponent={opponentParticipant}
        onToggleReady={onToggleReady}
      />

      {/* Participants list */}
      <div className="w-full max-w-md p-2 bg-bgsecondary rounded-lg border border-white/5">
        <h3 className="text-gray-300 text-xs mb-1.5">Participants</h3>
        <div className="space-y-0.5">
          {snapshot.participants.map((participant) => (
            <ParticipantRow
              key={participant.alias}
              participant={participant}
              isCurrentUser={participant.alias === alias}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function getUpcomingMatchForPlayer(rounds: TournamentBracketRoundSnapshot[], alias: string) {
  for (const round of rounds) {
    for (const match of round.matches) {
      if (match.status === "completed") {
        continue;
      }
      if (match.left === alias || match.right === alias) {
        return match;
      }
    }
  }
  return null;
}

interface PlayerMatchPanelProps {
  alias: string | null;
  match: TournamentBracketMatchSnapshot | null;
  isReady: boolean;
  isInMatch: boolean;
  opponent?: TournamentParticipantSnapshot;
  onToggleReady: () => void;
}

function PlayerMatchPanel({ alias, match, isReady, isInMatch, opponent, onToggleReady }: PlayerMatchPanelProps) {
  if (!alias) {
    return null;
  }

  const buttonDisabled = !match || match.status === "completed" || isInMatch;
  const opponentLabel = opponent?.alias ?? "TBD";
  const statusLabel = match
    ? match.status === "current"
      ? "Match in progress"
      : match.status === "pending"
        ? "Waiting to start"
        : "Completed"
    : "Waiting for bracket";

  return (
    <div className="w-full max-w-md p-2 bg-bgsecondary rounded-lg border border-white/5">
      <h3 className="text-gray-100 font-semibold mb-1 text-sm font-oswald">Your Match</h3>
      <p className="text-gray-400 text-xs mb-2 font-roboto">
        {match
          ? `${match.left} vs ${match.right}`
          : "You'll be assigned once the bracket advances."}
      </p>

      <div className="flex items-center justify-between mb-2 text-xs">
        <div>
          <div className="text-gray-400 font-roboto">Opponent</div>
          <div className="text-sm text-white font-roboto">{opponentLabel}</div>
          {opponent && (
            <div className="text-[10px] text-gray-500 font-roboto">
              {opponent.inMatch
                ? "Currently playing"
                : opponent.ready
                  ? "Ready"
                  : "Not ready"}
            </div>
          )}
        </div>
        <div className="text-right">
          <div className="text-gray-400 font-roboto">Status</div>
          <div className="text-sm text-white font-roboto">{statusLabel}</div>
        </div>
      </div>

      <button
        onClick={onToggleReady}
        disabled={buttonDisabled}
        className={`w-full px-3 py-1.5 text-sm font-oswald font-bold rounded-[12px] transition-all ${
          buttonDisabled
            ? "bg-bgsecondary/20 text-gray-400 cursor-not-allowed"
            : isReady
              ? "bg-bgprimary/50 hover:bg-bgprimary border border-accent text-accent"
              : "bg-accent hover:brightness-110 text-bgprimary shadow-lg"
        }`}
        style={!buttonDisabled && !isReady ? { boxShadow: '0 0 15px rgba(102, 232, 250, 0.5)' } : {}}
      >
        {isInMatch ? "In Match" : isReady ? "Cancel Ready" : "Ready"}
      </button>

      {!match && (
        <p className="mt-1 text-[10px] text-gray-500 font-roboto">
          Once your next match is determined, stay ready so it can start immediately.
        </p>
      )}
    </div>
  );
}

interface ReconnectionCountdownProps {
  timeoutMs: number;
}

function ReconnectionCountdown({ timeoutMs }: ReconnectionCountdownProps) {
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
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
      <div className="bg-bgsecondary rounded-[12px] p-8 max-w-md text-center border border-white/5 shadow-lg" style={{ boxShadow: '0 8px 32px rgba(102, 232, 250, 0.2)' }}>
        <div className="text-2xl text-yellow-400 mb-4 font-oswald">
          Opponent Disconnected
        </div>
        
        <div className="text-4xl font-bold text-accent font-oswald mb-4">
          {remainingSeconds}s
        </div>
        
        <p className="text-gray-400 mb-6 font-roboto">
          Waiting for opponent to reconnect...
        </p>
        
        <p className="text-sm text-gray-500 font-roboto">
          If they don't reconnect, you'll win by forfeit
        </p>
      </div>
    </div>
  );
}

interface TournamentMatchViewProps {
  gameState: ServerGameState;
  players: MatchPlayers;
  playerSide: PlayerSide;
  winner: PlayerSide | null;
  tournamentSnapshot: TournamentSnapshot | null;
  reconnectionTimeoutMs: number | null;
  opponentDisconnected: boolean;
  sendInput: (command: InputCommand) => void;
}

function TournamentMatchView({
  gameState,
  players,
  playerSide,
  winner,
  tournamentSnapshot,
  reconnectionTimeoutMs,
  opponentDisconnected,
  sendInput,
}: TournamentMatchViewProps) {
  const currentInputRef = useRef<InputCommand>("stop");

  // Keyboard input handling
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
      {/* Tournament info */}
      {tournamentSnapshot && (
        <div className="text-sm text-gray-400 mb-2 font-roboto">
          {tournamentSnapshot.name}
        </div>
      )}

      {/* Scoreboard */}
      <div className="flex justify-center gap-16 mb-4 text-3xl font-oswald">
        <div className="text-center">
          <div
            className={`text-sm font-roboto ${
              playerSide === "left" ? "text-cyan-400" : "text-gray-400"
            }`}
          >
            {players.left.username}
            {playerSide === "left" && " (You)"}
          </div>
          <div className="font-bold text-cyan-400">{gameState.score.left}</div>
        </div>
        <div className="text-gray-500">-</div>
        <div className="text-center">
          <div
            className={`text-sm font-roboto ${
              playerSide === "right" ? "text-cyan-400" : "text-gray-400"
            }`}
          >
            {players.right.username}
            {playerSide === "right" && " (You)"}
          </div>
          <div className="font-bold text-cyan-400">{gameState.score.right}</div>
        </div>
      </div>

      {/* Game Canvas */}
      <RemoteGameCanvas gameState={gameState} />

      {/* Opponent Disconnected Overlay with Countdown */}
      {opponentDisconnected && reconnectionTimeoutMs && (
        <ReconnectionCountdown 
          timeoutMs={reconnectionTimeoutMs}
        />
      )}

      {/* Controls hint */}
      <div className="mt-4 text-gray-400 text-sm font-roboto">
        Use Arrow Up/Down or W/S keys to move your paddle
      </div>

      {/* Winner announcement */}
      {winner && (
        <div className="mt-4 text-center">
          <div
            className={`text-2xl font-oswald font-bold ${
              winner === playerSide ? "text-cyan-400" : "text-gray-400"
            }`}
          >
            {winner === playerSide ? "YOU WIN!" : "YOU LOSE!"}
          </div>
          <div className="text-gray-400 font-roboto">Returning to bracket...</div>
        </div>
      )}
    </div>
  );
}

interface RemoteGameCanvasProps {
  gameState: ServerGameState;
}

function RemoteGameCanvas({ gameState }: RemoteGameCanvasProps) {
  const { arenaWidth, arenaHeight, paddle, ball } = GAME_CONFIG;

  // Ball position
  const ballX = gameState.ball.position.x;
  const ballY = gameState.ball.position.y;
  const ballSize = ball.radius * 2;

  // Paddle positions
  const leftPaddleX = paddle.offset;
  const rightPaddleX = arenaWidth - paddle.offset;
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
      {/* Center line */}
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

      {/* Ball */}
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

      {/* Left Paddle */}
      <div
        className="absolute bg-white rounded-full"
        style={{
          left: leftPaddleX - paddle.width / 2,
          top: leftPaddleY - paddle.height / 2,
          width: paddle.width,
          height: paddle.height,
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
        }}
      />

      {/* Right Paddle */}
      <div
        className="absolute bg-white rounded-full"
        style={{
          left: rightPaddleX - paddle.width / 2,
          top: rightPaddleY - paddle.height / 2,
          width: paddle.width,
          height: paddle.height,
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
        }}
      />
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
