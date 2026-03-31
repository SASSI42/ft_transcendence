import { useState } from 'react';
import { Search, Trophy } from 'lucide-react';

interface JoinRoomProps {
  onJoinRemoteTournament: (code: string) => void;
}

export function JoinRoom({ onJoinRemoteTournament }: JoinRoomProps) {
  const [tournamentCode, setTournamentCode] = useState('');

  const handleJoin = () => {
    if (tournamentCode.trim()) {
      onJoinRemoteTournament(tournamentCode.trim().toUpperCase());
    }
  };

  return (
    <div className="p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-4 text-center">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="p-3 rounded-lg bg-accent/10">
              <Trophy className="w-10 h-10 text-accent" />
            </div>
            <h1 className="text-white font-oswald font-bold text-3xl uppercase">
              JOIN TOURNAMENt
            </h1>
          </div>
          <p className="text-white/70 font-roboto text-lg">
            Enter the tournament code to join an existing tournament
          </p>
        </div>

        {/* Join Section */}
        <div className="max-w-2xl mx-auto">
          <div className="bg-bgprimary/50 rounded-lg p-8 border border-gray-600/30">
            <div className="mb-6">
              <label className="block text-white/70 text-sm font-oswald uppercase mb-2">
                TOURNAMENT CODE
              </label>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-bgprimary/40" />
                <input
                  type="text"
                  value={tournamentCode}
                  onChange={(e) => setTournamentCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && tournamentCode.trim()) {
                      handleJoin();
                    }
                  }}
                  placeholder="ENTER CODE"
                  className="w-full rounded-lg px-12 py-4 text-bgprimary font-oswald font-bold text-lg placeholder-bgprimary/40 uppercase input-field"
                  maxLength={6}
                />
              </div>
            </div>

            <button
              onClick={handleJoin}
              disabled={!tournamentCode.trim()}
              className={`w-full px-8 py-4 font-oswald font-bold text-xl uppercase rounded-[12px] transition-all ${
                tournamentCode.trim()
                  ? 'bg-accent text-bgprimary hover:brightness-110'
                  : 'bg-bgsecondary/20 text-white/30 cursor-not-allowed'
              }`}
              style={
                tournamentCode.trim()
                  ? { boxShadow: '0 0 20px rgba(102, 232, 250, 0.5)' }
                  : undefined
              }
            >
              JOIN TOURNAMENT
            </button>

            <div className="mt-6 pt-6 border-t border-gray-600/30">
              <p className="text-white/50 text-sm font-roboto text-center">
                Ask the tournament organizer for the tournament code
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
