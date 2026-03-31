import type { TournamentBracketSnapshot } from "./types";

export type BracketMatchStatus = "pending" | "current" | "completed" | "bye";

export interface BracketMatch {
	id: string;
	round: number;
	index: number;
	left: BracketPlayer;
	right: BracketPlayer;
	status: BracketMatchStatus;
	winner?: BracketPlayer;
}

export interface BracketPlayer {
	id: number;
	alias: string;
}

export interface SerializedBracketMatch {
	id: string;
	round: number;
	index: number;
	left: BracketPlayer;
	right: BracketPlayer;
	status: BracketMatchStatus;
	winner?: BracketPlayer;
}

export interface SerializedBracketRound {
	round: number;
	matches: SerializedBracketMatch[];
}

export interface SerializedBracketState {
	registeredPlayers: BracketPlayer[];
	rounds: SerializedBracketRound[];
	roundNumber: number;
	autoSeeds: BracketPlayer[];
	nextRoundSeeds: BracketPlayer[];
	champion: BracketPlayer | null;
	started: boolean;
}

interface RoundBuildResult {
	matches: BracketMatch[];
	autoAdvanced: BracketPlayer[];
}

export class SingleEliminationBracket {
	private registeredPlayers: BracketPlayer[] = [];
	private readonly rounds = new Map<number, BracketMatch[]>();
	private roundNumber = 0;
	private autoSeeds: BracketPlayer[] = [];
	private nextRoundSeeds: BracketPlayer[] = [];
	private champion: BracketPlayer | null = null;
	private started = false;

	public buildFromAliases(aliases: string[]): void {
		this.reset();
		this.registeredPlayers = aliases.map((alias, index) => ({ id: index + 1, alias }));
	}

	public hasEnoughPlayers(): boolean {
		return this.registeredPlayers.length >= 2;
	}

	public start(): void {
		if (this.started) {
			return;
		}
		if (!this.hasEnoughPlayers()) {
			throw new Error("Tournament requires at least two players.");
		}

		this.roundNumber = 1;
		const { matches, autoAdvanced } = this.buildRound(this.registeredPlayers, this.roundNumber);
		this.rounds.set(this.roundNumber, matches);
		this.autoSeeds = autoAdvanced;
		this.started = true;
		if (matches.length === 0) {
			this.advanceIfRoundComplete(this.roundNumber);
		}
	}

	public isStarted(): boolean {
		return this.started;
	}

	public isComplete(): boolean {
		return Boolean(this.champion);
	}

	public serialize(): SerializedBracketState {
		return {
			registeredPlayers: this.registeredPlayers.map((player) => ({ ...player })),
			rounds: [...this.rounds.entries()]
				.sort((a, b) => a[0] - b[0])
				.map(([round, matches]) => ({
					round,
					matches: matches.map((match) => ({
						id: match.id,
						round: match.round,
						index: match.index,
						left: { ...match.left },
						right: { ...match.right },
						status: match.status,
						winner: match.winner ? { ...match.winner } : undefined,
					})),
				})),
			roundNumber: this.roundNumber,
			autoSeeds: this.autoSeeds.map((player) => ({ ...player })),
			nextRoundSeeds: this.nextRoundSeeds.map((player) => ({ ...player })),
			champion: this.champion ? { ...this.champion } : null,
			started: this.started,
		};
	}

	public hydrate(state: SerializedBracketState): void {
		this.registeredPlayers = state.registeredPlayers.map((player) => ({ ...player }));
		this.rounds.clear();
		for (const round of state.rounds) {
			this.rounds.set(
				round.round,
				round.matches.map((match) => ({
					id: match.id,
					round: match.round,
					index: match.index,
					left: { ...match.left },
					right: { ...match.right },
					status: match.status,
					winner: match.winner ? { ...match.winner } : undefined,
				})),
			);
		}
		this.roundNumber = state.roundNumber;
		this.autoSeeds = state.autoSeeds.map((player) => ({ ...player }));
		this.nextRoundSeeds = state.nextRoundSeeds.map((player) => ({ ...player }));
		this.champion = state.champion ? { ...state.champion } : null;
		this.started = state.started;
	}

	public getPendingMatches(): BracketMatch[] {
		if (!this.started) {
			return [];
		}
		const pending: BracketMatch[] = [];
		for (const matches of this.rounds.values()) {
			for (const match of matches) {
				if (match.status === "pending") {
					pending.push(match);
				}
			}
		}
		return pending;
	}

	public markMatchActive(matchId: string): void {
		const match = this.findMatch(matchId);
		if (!match) {
			throw new Error(`Match ${matchId} not found.`);
		}
		if (match.status !== "pending") {
			return;
		}
		match.status = "current";
	}

	public recordResult(matchId: string, winnerAlias: string): void {
		const match = this.findMatch(matchId);
		if (!match) {
			throw new Error(`Match ${matchId} not found.`);
		}
		if (match.status !== "current") {
			throw new Error(`Match ${matchId} is not active.`);
		}

		let winner: BracketPlayer | undefined;
		if (match.left.alias === winnerAlias) {
			winner = match.left;
		} else if (match.right.alias === winnerAlias) {
			winner = match.right;
		}

		if (!winner) {
			throw new Error(`Winner alias ${winnerAlias} not part of match ${matchId}.`);
		}

		match.status = "completed";
		match.winner = winner;
		this.nextRoundSeeds.push(winner);
		this.advanceIfRoundComplete(match.round);
	}

	public resetMatchToPending(matchId: string): void {
		const match = this.findMatch(matchId);
		if (!match) {
			return;
		}
		if (match.status === "current") {
			match.status = "pending";
		}
	}

	public getSnapshot(): TournamentBracketSnapshot {
		const rounds: TournamentBracketSnapshot["rounds"] = [];
		for (const [round, matches] of [...this.rounds.entries()].sort((a, b) => a[0] - b[0])) {
			rounds.push({
				round,
				matches: matches.map((match) => ({
					id: match.id,
					left: match.left.alias,
					right: match.right.alias,
					status: match.status,
					winner: match.winner?.alias,
				})),
			});
		}

		const highlighted = this.findHighlightedMatch();

		return {
			currentRound: this.roundNumber,
			rounds,
			currentMatch: highlighted
				? {
					id: highlighted.id,
					round: highlighted.round,
					left: highlighted.left.alias,
					right: highlighted.right.alias,
				}
				: undefined,
			champion: this.champion?.alias,
		};
	}

	private reset(): void {
		this.rounds.clear();
		this.roundNumber = 0;
		this.autoSeeds = [];
		this.nextRoundSeeds = [];
		this.champion = null;
		this.started = false;
	}

	private advanceIfRoundComplete(round: number): void {
		const matches = this.rounds.get(round) ?? [];
		const roundComplete = matches.every((match) => match.status === "completed" || match.status === "bye");
		if (!roundComplete) {
			return;
		}

		const seeds = [...this.nextRoundSeeds, ...this.autoSeeds];
		this.nextRoundSeeds = [];
		this.autoSeeds = [];

		if (seeds.length === 0) {
			return;
		}

		if (seeds.length === 1) {
			this.champion = seeds[0];
			this.roundNumber = Math.max(this.roundNumber, round);
			return;
		}

		const nextRound = round + 1;
		const { matches: nextMatches, autoAdvanced } = this.buildRound(seeds, nextRound);
		this.rounds.set(nextRound, nextMatches);
		this.autoSeeds = autoAdvanced;
		this.roundNumber = nextRound;
		if (nextMatches.length === 0) {
			// Everyone advanced automatically; recurse to determine champion.
			this.advanceIfRoundComplete(nextRound);
		}
	}

	private findMatch(matchId: string): BracketMatch | null {
		for (const matches of this.rounds.values()) {
			const found = matches.find((match) => match.id === matchId);
			if (found) {
				return found;
			}
		}
		return null;
	}

	private findHighlightedMatch(): BracketMatch | null {
		const rounds = [...this.rounds.entries()].sort((a, b) => a[0] - b[0]);
		for (const [, matches] of rounds) {
			const current = matches.find((match) => match.status === "current");
			if (current) {
				return current;
			}
			const pending = matches.find((match) => match.status === "pending");
			if (pending) {
				return pending;
			}
		}
		return null;
	}

	private buildRound(players: BracketPlayer[], round: number): RoundBuildResult {
		const matches: BracketMatch[] = [];
		const autoAdvanced: BracketPlayer[] = [];
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
				status: "pending",
			});
			index += 1;
		}

		if (queue.length === 1) {
			autoAdvanced.push(queue.shift()!);
		}

		return { matches, autoAdvanced };
	}
}
