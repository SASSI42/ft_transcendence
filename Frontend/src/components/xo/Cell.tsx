import React from "react";
import type { PlayerSymbol } from "../../types/index";

interface CellProps {
  value: PlayerSymbol | null;
  onClick: () => void;
  disabled: boolean;
  isWinning: boolean;
  isUserPiece: boolean;
}

export const Cell: React.FC<CellProps> = ({
  value,
  onClick,
  disabled,
  isWinning,
  isUserPiece,
}) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        h-24 w-24 text-4xl font-bold flex items-center justify-center border-2 rounded-lg transition-all
        ${isWinning ? "bg-green/30 border-green scale-105" : "bg-bgsecondary/20"}
        ${!value && !disabled ? "hover:bg-bgsecondary/50 cursor-pointer" : ""}
        
        ${/* logic: if it's my piece -> blue, opponent -> red */ ""}
        ${
          value 
            ? (isUserPiece ? "text-blue" : "text-red")
            : "text-bgsecondary/50"
        }
        
        ${disabled ? "cursor-not-allowed" : ""}
      `}
    >
      {value}
    </button>
  );
};
