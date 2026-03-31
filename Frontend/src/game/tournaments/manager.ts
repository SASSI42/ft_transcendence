export type TournamentPlayer = {
	id: number;
	name: string;
};

export type TournamentMatchStatus = 'pending' | 'current' | 'completed' | 'bye';

export interface TournamentMatch {
	id: string;
	round: number;
	index: number;
	left: TournamentPlayer;
	right: TournamentPlayer;
	status: TournamentMatchStatus;
	winner?: TournamentPlayer;
}

export interface TournamentSnapshotRound {
	round: number;
	matches: Array<{
		id: string;
		left: string;
		right: string;
		status: TournamentMatchStatus;
		winner?: string;
	}>;
}

export interface TournamentSnapshot {
	name: string;
	currentRound: number;
	rounds: TournamentSnapshotRound[];
	capacity?: number;
	currentMatch?: {
		id: string;
		round: number;
		left: string;
		right: string;
	};
	champion?: string;
}

export type WinnerSide = 'leftPlayer' | 'rightPlayer';

interface RoundBuildResult {
	matches: TournamentMatch[];
	autoAdvanced: TournamentPlayer[];
}

const DEFAULT_NAME = 'Local Cup';

export class TournamentManager {
	private tournamentName = DEFAULT_NAME;
	private registeredPlayers: TournamentPlayer[] = [];
	private rounds = new Map<number, TournamentMatch[]>();
	private roundNumber = 0;
	private currentMatchIndex = -1;
	private currentMatch: TournamentMatch | null = null;
	private autoSeeds: TournamentPlayer[] = [];
	private nextRoundSeeds: TournamentPlayer[] = [];
	private champion: TournamentPlayer | null = null;

	public initialize(players: string[], name: string): void {
		this.reset();
		this.tournamentName = name || DEFAULT_NAME;
		this.registeredPlayers = players.map((alias, index) => ({ id: index + 1, name: alias.trim() }));
	}

	public hasEnoughPlayers(): boolean {
		return this.registeredPlayers.length >= 2;
	}

	public start(): void {
		if (!this.hasEnoughPlayers()) {
			throw new Error('Tournament requires at least two players.');
		}

		this.roundNumber = 1;
		const { matches, autoAdvanced } = this.buildRound(this.registeredPlayers, this.roundNumber);
		this.rounds.set(this.roundNumber, matches);
		this.autoSeeds = autoAdvanced;
		this.currentMatchIndex = matches.length ? 0 : -1;
		if (matches.length) {
			matches[0].status = 'current';
			this.currentMatch = matches[0];
		} else {
			this.champion = this.autoSeeds[0] ?? null;
		}
	}

	public getName(): string {
		return this.tournamentName;
	}

	public getCurrentMatch(): TournamentMatch | null {
		return this.currentMatch;
	}

	public recordResult(winnerSide: WinnerSide): { nextMatch?: TournamentMatch; champion?: TournamentPlayer } {
		if (!this.currentMatch) {
			throw new Error('No active match to record.');
		}

		const match = this.currentMatch;
		const winner = winnerSide === 'leftPlayer' ? match.left : match.right;
		match.status = 'completed';
		match.winner = winner;
		this.nextRoundSeeds.push(winner);

		const matches = this.rounds.get(match.round) ?? [];
		this.currentMatchIndex += 1;

		if (this.currentMatchIndex < matches.length) {
			const nextMatch = matches[this.currentMatchIndex];
			nextMatch.status = 'current';
			this.currentMatch = nextMatch;
			return { nextMatch };
		}

		const seeds = [...this.nextRoundSeeds, ...this.autoSeeds];
		this.nextRoundSeeds = [];
		this.autoSeeds = [];

		if (seeds.length === 1) {
			this.champion = seeds[0];
			this.currentMatch = null;
			return { champion: this.champion };
		}

		if (seeds.length === 0) {
			throw new Error('Tournament progression error: no seeds for next round.');
		}

		this.roundNumber += 1;
		const { matches: nextMatches, autoAdvanced } = this.buildRound(seeds, this.roundNumber);
		this.rounds.set(this.roundNumber, nextMatches);
		this.autoSeeds = autoAdvanced;
		this.currentMatchIndex = nextMatches.length ? 0 : -1;

		if (!nextMatches.length) {
			if (this.autoSeeds.length === 1) {
				this.champion = this.autoSeeds[0];
				this.currentMatch = null;
				return { champion: this.champion };
			}
			throw new Error('Tournament progression error: new round has no matches or auto-advanced players.');
		}

		nextMatches[0].status = 'current';
		this.currentMatch = nextMatches[0];
		return { nextMatch: nextMatches[0] };
	}

	public getSnapshot(): TournamentSnapshot {
		const rounds: TournamentSnapshotRound[] = [];
		for (const [round, matches] of [...this.rounds.entries()].sort((a, b) => a[0] - b[0])) {
			rounds.push({
				round,
				matches: matches.map(match => ({
					id: match.id,
					left: match.left.name,
					right: match.right.name,
					status: match.status,
					winner: match.winner?.name,
				})),
			});
		}

		return {
			name: this.tournamentName,
			currentRound: this.roundNumber,
			rounds,
			currentMatch: this.currentMatch
				? {
					id: this.currentMatch.id,
					round: this.currentMatch.round,
					left: this.currentMatch.left.name,
					right: this.currentMatch.right.name,
				}
				: undefined,
			champion: this.champion?.name,
		};
	}

	public reset(): void {
		this.registeredPlayers = [];
		this.rounds.clear();
		this.roundNumber = 0;
		this.currentMatchIndex = -1;
		this.currentMatch = null;
		this.autoSeeds = [];
		this.nextRoundSeeds = [];
		this.champion = null;
	}

	private buildRound(players: TournamentPlayer[], round: number): RoundBuildResult {
		const matches: TournamentMatch[] = [];
		const autoAdvanced: TournamentPlayer[] = [];
		const queue = [...players];
		let index = 0;

		while (queue.length >= 2) {
			const left = queue.shift()!;
			const right = queue.shift()!;
			matches.push({
				id: `R${round}-M${index + 1}`,
				round,
				index,
				left,
				right,
				status: 'pending',
			});
			index += 1;
		}

		if (queue.length === 1) {
			autoAdvanced.push(queue.shift()!);
		}

		return { matches, autoAdvanced };
	}
}
