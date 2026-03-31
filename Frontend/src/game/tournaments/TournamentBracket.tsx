import React from 'react';
import { Trophy } from 'lucide-react';
import { MatchNode, type Player } from './MatchNode';
import type { TournamentSnapshot } from './manager';

export interface Match {
  id: string;
  round: number;
  player1: Player;
  player2: Player;
}

interface BracketConnectorProps {
  topActive?: boolean;
  bottomActive?: boolean;
}

const BracketConnector: React.FC<BracketConnectorProps> = ({ topActive = false, bottomActive = false }) => {
  const baseColor = 'bg-gray-500/60';
  const activeColor = 'bg-accent';
  
  return (
    <div className="absolute right-[-24px] top-[38px] bottom-[38px] w-[24px] pointer-events-none">
      <div className={`absolute top-0 right-0 w-full h-[1px] ${topActive ? activeColor : baseColor}`} />
      <div className={`absolute bottom-0 right-0 w-full h-[1px] ${bottomActive ? activeColor : baseColor}`} />
      <div className={`absolute top-0 right-0 w-[1px] h-1/2 ${topActive ? activeColor : baseColor}`} />
      <div className={`absolute bottom-0 right-0 w-[1px] h-1/2 ${bottomActive ? activeColor : baseColor}`} />
      <div className={`absolute top-1/2 right-[-24px] w-[24px] h-[1px] -translate-y-1/2 ${topActive || bottomActive ? activeColor : baseColor}`} />
    </div>
  );
};

const SingleConnector: React.FC<{ active?: boolean }> = ({ active = false }) => (
  <div className={`absolute right-[-24px] top-[38px] w-[24px] h-[1px] pointer-events-none ${active ? 'bg-accent' : 'bg-gray-500/60'}`}></div>
);

interface TournamentBracketProps {
  snapshot: TournamentSnapshot;
}

export const TournamentBracket: React.FC<TournamentBracketProps> = ({ snapshot }) => {
  const hasWinner = (winner?: string) => !!winner;

  const quarterFinals: Match[] = [];
  const semiFinals: Match[] = [];
  const finals: Match[] = [];

  snapshot.rounds.forEach(round => {
    round.matches.forEach(match => {
      const matchData: Match = {
        id: match.id,
        round: round.round,
        player1: {
          name: match.left,
          score: null,
          isWinner: match.winner === match.left
        },
        player2: {
          name: match.right,
          score: null,
          isWinner: match.winner === match.right
        }
      };

      if (round.round === 1) {
        quarterFinals.push(matchData);
      } else if (round.round === 2) {
        semiFinals.push(matchData);
      } else if (round.round === 3) {
        finals.push(matchData);
      }
    });
  });

  const final = finals[0];

  const hasSemiFinals = semiFinals.length > 0;
  const hasQuarterFinals = quarterFinals.length > 0;

  return (
    <div className="w-full h-full max-w-[1200px] bg-bgsecondary rounded-xl p-8 md:p-12 shadow-2xl overflow-x-auto flex flex-col border border-white/5">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-16 border-b border-gray-600/30 pb-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-gray-300">
            <Trophy className="w-5 h-5 text-gray-400" />
            <h2 className="text-xl font-oswald font-bold tracking-wide uppercase text-gray-200">Tournament</h2>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-400 mt-1 font-oswald tracking-wide">
            <span className="font-bold text-gray-300 uppercase">{snapshot.name}</span>
            <span className="text-gray-500">•</span>
            <span className="uppercase">PING PONG</span>
          </div>
        </div>
      </div>
      
      
      <div className="flex flex-row justify-between items-center flex-grow min-w-[900px]">
        
        {hasQuarterFinals && (
          <div className="flex flex-col gap-20">
            
            {quarterFinals.map((_, idx) => {
              // Only process even indices (pairs)
              if (idx % 2 !== 0) return null;
              
              const match1 = quarterFinals[idx];
              const match2 = quarterFinals[idx + 1];
              
              // If there's only one match left (odd number), render it without pair
              if (!match2) {
                return (
                  <div key={match1.id} className="relative flex flex-col">
                    <MatchNode player1={match1.player1} player2={match1.player2} />
                    <SingleConnector active={hasWinner(match1.player1.isWinner || match1.player2.isWinner ? 'winner' : undefined)} />
                  </div>
                );
              }
              
              // Render pair of matches with connector
              return (
                <div key={match1.id} className="relative flex flex-col gap-8">
                  <MatchNode player1={match1.player1} player2={match1.player2} />
                  <MatchNode player1={match2.player1} player2={match2.player2} />
                  <BracketConnector 
                    topActive={hasWinner(match1.player1.isWinner || match1.player2.isWinner ? 'winner' : undefined)}
                    bottomActive={hasWinner(match2.player1.isWinner || match2.player2.isWinner ? 'winner' : undefined)}
                  />
                </div>
              );
            })}
          </div>
        )}

        
        {hasSemiFinals && (
          <div className="relative flex flex-col gap-32">
            {semiFinals[0] && (
              <div className="relative">
                <MatchNode player1={semiFinals[0].player1} player2={semiFinals[0].player2} />
              </div>
            )}
            
            {semiFinals[1] && (
              <div className="relative">
                <MatchNode player1={semiFinals[1].player1} player2={semiFinals[1].player2} />
              </div>
            )}

            {semiFinals.length >= 2 && (
              <BracketConnector 
                topActive={hasWinner(semiFinals[0].player1.isWinner || semiFinals[0].player2.isWinner ? 'winner' : undefined)}
                bottomActive={hasWinner(semiFinals[1].player1.isWinner || semiFinals[1].player2.isWinner ? 'winner' : undefined)}
              />
            )}
          </div>
        )}

        
        {final && (
          <div className="relative flex flex-col justify-center">
            <div className="relative">
              <MatchNode player1={final.player1} player2={final.player2} />
              <SingleConnector active={hasWinner(final.player1.isWinner || final.player2.isWinner ? 'winner' : undefined)} />
            </div>
          </div>
        )}

        
        {snapshot.champion && (
          <div className="flex flex-col justify-center pl-4">
            <div className="flex items-center gap-4 animate-fade-in-up">
              <div className="bg-bgsecondary text-bgprimary font-oswald font-bold px-6 py-2 rounded-md min-w-[140px] text-center uppercase text-sm tracking-wider h-9 flex items-center justify-center shadow-sm">
                {snapshot.champion}
              </div>
              <div className="flex items-center gap-2">
                <Trophy className="w-6 h-6 text-leaderboadgold drop-shadow-sm" />
                <span className="text-leaderboadgold font-oswald font-bold text-xl tracking-wide uppercase">Winner</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
