import React from 'react';

export interface Player {
  name: string;
  score: number | null;
  isWinner?: boolean;
}

interface MatchNodeProps {
  player1: Player;
  player2: Player;
  className?: string;
}

const PlayerRow: React.FC<{ player: Player }> = ({ player }) => {
  const bgColor = player.isWinner 
    ? 'bg-accent' 
    : 'bg-bgsecondary';
    
  return (
    <div className={`flex items-center justify-between rounded-md mb-1 h-9 w-52 ${bgColor} text-bgprimary transition-transform hover:scale-105 duration-200 cursor-pointer shadow-sm`}>
      <span className="pl-3 text-sm font-oswald font-bold uppercase tracking-tight truncate max-w-[75%]">
        {player.name}
      </span>
      <div className="flex items-center h-full">
        <div className="w-[1px] h-full bg-black/10 mx-1"></div>
        <span className="pr-3 pl-1 font-oswald font-bold text-lg w-10 text-center leading-none">
          {player.score !== null ? player.score.toString().padStart(2, '0') : '--'}
        </span>
      </div>
    </div>
  );
};

export const MatchNode: React.FC<MatchNodeProps> = ({ player1, player2, className = '' }) => {
  return (
    <div className={`flex flex-col z-10 ${className}`}>
      <PlayerRow player={player1} />
      <PlayerRow player={player2} />
    </div>
  );
};
