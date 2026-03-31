import type { TournamentSnapshot, TournamentMatchStatus } from './manager';

interface PlayerRegistrationProps {
  players: string[];
  tournamentName: string;
  onPlayerChange: (index: number, value: string) => void;
  onAddPlayer: () => void;
  onRemovePlayer: (index: number) => void;
  onTournamentNameChange: (name: string) => void;
  onStartTournament: () => void;
  error?: string;
}

export function PlayerRegistration({
  players,
  tournamentName,
  onPlayerChange,
  onAddPlayer,
  onRemovePlayer,
  onTournamentNameChange,
  onStartTournament,
  error,
}: PlayerRegistrationProps) {
  const canStart = players.filter(p => p.trim()).length >= 2;

  return (
    <div className="w-full max-w-md p-6 bg-gray-800 rounded-lg">
      <h2 className="text-2xl font-bold text-cyan-400 mb-4">Tournament Setup</h2>
      
      <div className="mb-4">
        <label className="block text-gray-300 text-sm mb-2">Tournament Name</label>
        <input
          type="text"
          value={tournamentName}
          onChange={(e) => onTournamentNameChange(e.target.value)}
          placeholder="Enter tournament name"
          className="w-full px-4 py-2 bg-gray-700 text-white border border-gray-600 rounded focus:border-cyan-400 focus:outline-none"
        />
      </div>

      <div className="mb-4">
        <label className="block text-gray-300 text-sm mb-2">Players (minimum 2)</label>
        <div className="space-y-2">
          {players.map((player, index) => (
            <div key={index} className="flex gap-2">
              <input
                type="text"
                value={player}
                onChange={(e) => onPlayerChange(index, e.target.value)}
                placeholder={`Player ${index + 1}`}
                className="flex-1 px-4 py-2 bg-gray-700 text-white border border-gray-600 rounded focus:border-cyan-400 focus:outline-none"
              />
              {players.length > 2 && (
                <button
                  onClick={() => onRemovePlayer(index)}
                  className="px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded transition-colors"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          onClick={onAddPlayer}
          className="mt-2 w-full px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded transition-colors"
        >
          + Add Player
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-900 text-red-200 rounded">
          {error}
        </div>
      )}

      <button
        onClick={onStartTournament}
        disabled={!canStart}
        className={`w-full px-6 py-3 font-bold text-xl rounded transition-colors ${
          canStart
            ? 'bg-cyan-500 hover:bg-cyan-600 text-black'
            : 'bg-gray-600 text-gray-400 cursor-not-allowed'
        }`}
      >
        Start Tournament
      </button>
    </div>
  );
}

interface BracketDisplayProps {
  snapshot: TournamentSnapshot;
}

function getStatusColor(status: TournamentMatchStatus): string {
  switch (status) {
    case 'current':
      return 'border-cyan-400 bg-cyan-900';
    case 'completed':
      return 'border-green-400 bg-green-900';
    case 'pending':
      return 'border-gray-500 bg-gray-700';
    case 'bye':
      return 'border-yellow-400 bg-yellow-900';
    default:
      return 'border-gray-500 bg-gray-700';
  }
}

export function BracketDisplay({ snapshot }: BracketDisplayProps) {
  return (
    <div className="w-full max-w-4xl p-6 bg-gray-800 rounded-lg">
      <h2 className="text-2xl font-bold text-cyan-400 mb-4">
        {snapshot.name} - Bracket
      </h2>
      
      <div className="flex gap-8 overflow-x-auto pb-4">
        {snapshot.rounds.map((round) => (
          <div key={round.round} className="flex-shrink-0 min-w-48">
            <h3 className="text-lg font-semibold text-gray-300 mb-3">
              Round {round.round}
            </h3>
            <div className="space-y-3">
              {round.matches.map((match) => (
                <div
                  key={match.id}
                  className={`p-3 rounded border-2 ${getStatusColor(match.status)}`}
                >
                  <div className="text-sm text-gray-400 mb-1">{match.id}</div>
                  <div className={`flex justify-between items-center ${
                    match.winner === match.left ? 'text-green-400 font-bold' : 'text-white'
                  }`}>
                    <span>{match.left}</span>
                    {match.winner === match.left && <span>🏆</span>}
                  </div>
                  <div className="text-gray-500 text-center text-sm">vs</div>
                  <div className={`flex justify-between items-center ${
                    match.winner === match.right ? 'text-green-400 font-bold' : 'text-white'
                  }`}>
                    <span>{match.right}</span>
                    {match.winner === match.right && <span>🏆</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface CurrentMatchDisplayProps {
  leftPlayer: string;
  rightPlayer: string;
  matchId: string;
  round: number;
  onStartMatch: () => void;
}

export function CurrentMatchDisplay({
  leftPlayer,
  rightPlayer,
  matchId,
  round,
  onStartMatch,
}: CurrentMatchDisplayProps) {
  return (
    <div className="w-full max-w-md p-6 bg-bgsecondary rounded-xl text-center border border-white/5 shadow-lg">
      <h2 className="text-xl font-oswald font-bold text-accent mb-2 uppercase">Next Match</h2>
      <div className="text-sm text-gray-400 font-oswald mb-4">
        {matchId} - Round {round}
      </div>
      
      <div className="flex items-center justify-center gap-4 mb-6">
        <div className="text-2xl font-oswald font-bold text-white uppercase">{leftPlayer}</div>
        <div className="text-gray-500 text-xl">vs</div>
        <div className="text-2xl font-oswald font-bold text-white uppercase">{rightPlayer}</div>
      </div>

      <button
        onClick={onStartMatch}
        className="px-8 py-4 bg-accent hover:bg-cyan-glow text-bgprimary font-oswald font-bold text-xl rounded-xl transition-all shadow-lg uppercase"
        style={{ boxShadow: '0 0 20px rgba(0, 207, 255, 0.4)' }}
      >
        Start Match
      </button>
    </div>
  );
}

interface ChampionDisplayProps {
  championName: string;
  tournamentName: string;
  onNewTournament: () => void;
}

export function ChampionDisplay({
  championName,
  tournamentName,
  onNewTournament,
}: ChampionDisplayProps) {
  return (
    <div className="w-full max-w-md p-8 bg-gradient-to-b from-yellow-900/30 to-bgsecondary rounded-xl text-center border border-yellow-500/30 shadow-2xl">
      <div className="text-6xl mb-4">🏆</div>
      <h2 className="text-3xl font-oswald font-bold text-yellow-400 mb-2 uppercase">Champion!</h2>
      <div className="text-4xl font-oswald font-bold text-white mb-4 uppercase">{championName}</div>
      <div className="text-gray-400 font-oswald mb-6">Winner of {tournamentName}</div>
      
      <button
        onClick={onNewTournament}
        className="px-8 py-4 bg-accent hover:bg-cyan-glow text-bgprimary font-oswald font-bold text-xl rounded-xl transition-all shadow-lg uppercase"
        style={{ boxShadow: '0 0 20px rgba(0, 207, 255, 0.4)' }}
      >
        New Tournament
      </button>
    </div>
  );
}
