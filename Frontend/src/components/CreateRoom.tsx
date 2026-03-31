import { useState } from 'react';
import { Users, Trophy } from 'lucide-react';

interface CreateRoomProps {
  onCreateLocal1v1: () => void;
  onCreateLocalTournament: () => void;
  onCreateRemote1v1: () => void;
  onCreateRemoteTournament: () => void;
}

export function CreateRoom({
  onCreateLocal1v1,
  onCreateLocalTournament,
  onCreateRemote1v1,
  onCreateRemoteTournament,
}: CreateRoomProps) {
  const [mode, setMode] = useState<'local' | 'remote'>('local');

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        {/* Mode Selector */}
        <div className="mb-8">
          <div className="flex gap-8 border-b border-gray-600/30">
            <button
              onClick={() => setMode('local')}
              className={`px-6 py-3 font-oswald font-bold text-xl uppercase transition-all relative ${
                mode === 'local' ? 'text-accent' : 'text-white/60 hover:text-white'
              }`}
            >
              LOCAL
              {mode === 'local' && (
                <div
                  className="absolute bottom-0 left-0 right-0 h-1 bg-accent"
                  style={{ boxShadow: '0 0 10px rgba(102, 232, 250, 0.5)' }}
                />
              )}
            </button>
            <button
              onClick={() => setMode('remote')}
              className={`px-6 py-3 font-oswald font-bold text-xl uppercase transition-all relative ${
                mode === 'remote' ? 'text-accent' : 'text-white/60 hover:text-white'
              }`}
            >
              ONLINE
              {mode === 'remote' && (
                <div
                  className="absolute bottom-0 left-0 right-0 h-1 bg-accent"
                  style={{ boxShadow: '0 0 10px rgba(102, 232, 250, 0.5)' }}
                />
              )}
            </button>
          </div>
        </div>

        {/* Game Type Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 1v1 Card */}
          <div className="bg-bgprimary/50 rounded-lg p-6 border border-gray-600/30 hover:border-accent/50 transition-all group">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-lg bg-accent/10 group-hover:bg-accent/20 transition-all">
                <Users className="w-8 h-8 text-accent" />
              </div>
              <h3 className="text-white font-oswald font-bold text-2xl uppercase">
                1V1 MATCH
              </h3>
            </div>
            <p className="text-white/70 font-roboto mb-6">
              {mode === 'local' 
                ? 'Play against a friend on the same computer. One uses W/S keys, the other uses arrow keys.'
                : 'Challenge an online opponent in real-time multiplayer action.'}
            </p>
            <button
              onClick={mode === 'local' ? onCreateLocal1v1 : onCreateRemote1v1}
              className="w-full px-6 py-3 bg-accent text-bgprimary font-oswald font-bold text-lg uppercase rounded-[12px] transition-all hover:brightness-110"
              style={{ boxShadow: '0 0 15px rgba(102, 232, 250, 0.3)' }}
            >
              {mode === 'local' ? 'START LOCAL GAME' : 'FIND OPPONENT'}
            </button>
          </div>

          {/* Tournament Card */}
          <div className="bg-bgprimary/50 rounded-lg p-6 border border-gray-600/30 hover:border-accent/50 transition-all group">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-lg bg-accent/10 group-hover:bg-accent/20 transition-all">
                <Trophy className="w-8 h-8 text-accent" />
              </div>
              <h3 className="text-white font-oswald font-bold text-2xl uppercase">
                TOURNAMENT
              </h3>
            </div>
            <p className="text-white/70 font-roboto mb-6">
              {mode === 'local'
                ? 'Organize a local tournament with multiple players competing in rounds.'
                : 'Create or join an online tournament and compete for the championship.'}
            </p>
            <button
              onClick={mode === 'local' ? onCreateLocalTournament : onCreateRemoteTournament}
              className="w-full px-6 py-3 bg-accent text-bgprimary font-oswald font-bold text-lg uppercase rounded-[12px] transition-all hover:brightness-110"
              style={{ boxShadow: '0 0 15px rgba(102, 232, 250, 0.3)' }}
            >
              {mode === 'local' ? 'SETUP TOURNAMENT' : 'CREATE TOURNAMENT'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
