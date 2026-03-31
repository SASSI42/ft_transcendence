export type TournamentStatus = "registration" | "in_progress" | "completed";

export interface TournamentParticipantSnapshot {
	alias: string;
	connected: boolean;
	ready: boolean;
	inMatch: boolean;
	joinedAt: number;
	lastSeenAt: number;
}

export interface TournamentBracketMatchSnapshot {
	id: string;
	left: string;
	right: string;
	status: "pending" | "current" | "completed" | "bye";
	winner?: string;
}

export interface TournamentBracketRoundSnapshot {
	round: number;
	matches: TournamentBracketMatchSnapshot[];
}

export interface TournamentBracketSnapshot {
	currentRound: number;
	rounds: TournamentBracketRoundSnapshot[];
	currentMatch?: {
		id: string;
		round: number;
		left: string;
		right: string;
	};
	champion?: string;
}

export interface TournamentSnapshot {
	code: string;
	name: string;
	createdAt: number;
	status: TournamentStatus;
	participants: TournamentParticipantSnapshot[];
	capacity?: number;
	bracket?: TournamentBracketSnapshot;
}
