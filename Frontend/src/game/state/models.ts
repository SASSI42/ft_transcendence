import { GAME_CONFIG } from '../config';

export type GameMode = 'localGame' | 'remoteGame' | 'tournament' | 'remoteTournament';
export type GamePhase = 'unset' | 'waiting' | 'ready' | 'playing' | 'completed';

export type PlayerSideTag = 'leftPlayer' | 'rightPlayer';

export interface PlaneVector {
	x: number;
	y: number;
}

export interface ArenaDimensions {
	groundWidth: number;
	groundHeight: number;
	ballRadius: number;
	paddleWidth: number;
	paddleHeight: number;
	paddleSpeed: number;
	paddleOffset: number;
	maxScore: number;
}

export interface PaddleCoordinates {
	p1y: number;
	p2y: number;
}

export interface SeriesScoreCard {
	points: Record<PlayerSideTag, number>;
	sets: Record<PlayerSideTag, number>;
	usernames: { left: string; right: string };
}

export interface MatchStatusState {
	setOver: boolean;
	isPaused: boolean;
	roundNumber?: number;
	tournamentName?: string;
	phase: GamePhase;
}

export interface MatchResolution {
	matchWinner?: PlayerSideTag;
	endReason: 'normal' | 'disconnection' | 'unknown';
}

const DEFAULT_ARENA: ArenaDimensions = {
	groundWidth: GAME_CONFIG.arenaWidth,
	groundHeight: GAME_CONFIG.arenaHeight,
	ballRadius: GAME_CONFIG.ball.radius,
	paddleWidth: GAME_CONFIG.paddle.width,
	paddleHeight: GAME_CONFIG.paddle.height,
	paddleSpeed: GAME_CONFIG.paddle.speed,
	paddleOffset: GAME_CONFIG.paddle.offset,
	maxScore: GAME_CONFIG.maxScore,
};

const createScoreCard = (left: string, right: string): SeriesScoreCard => ({
	points: { leftPlayer: 0, rightPlayer: 0 },
	sets: { leftPlayer: 0, rightPlayer: 0 },
	usernames: { left, right },
});

const randomInitialVelocity = (): PlaneVector => {
	const speed = GAME_CONFIG.ball.speed;
	const direction = Math.random() < 0.5 ? -1 : 1;
	const angle = (Math.random() - 0.5) * Math.PI * GAME_CONFIG.ball.maxVerticalFactor;
	return {
		x: Math.cos(angle) * speed * direction,
		y: Math.sin(angle) * speed,
	};
};

export class LocalMatchState {
	public arena = { ...DEFAULT_ARENA };
	public status: MatchStatusState = { setOver: false, isPaused: false, phase: 'playing' };
	public resolution: MatchResolution | null = null;
	public paddleTrack: PaddleCoordinates = { p1y: 0, p2y: 0 };
	public mode: GameMode = 'localGame';
	public ballCoords: PlaneVector = { x: 0, y: 0 };
	public ballMomentum: PlaneVector = randomInitialVelocity();
	public scoreCard: SeriesScoreCard;

	public constructor(p1Name = 'Player 1', p2Name = 'Player 2', maxScore?: number) {
		this.scoreCard = createScoreCard(p1Name, p2Name);
		if (maxScore !== undefined) {
			this.arena.maxScore = maxScore;
		}
	}
}