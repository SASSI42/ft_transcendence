export type PlayerSide = "left" | "right";
export type InputCommand = "up" | "down" | "stop";
export type GameStatus = "waiting" | "ready" | "playing" | "ended";

export interface Vector2 {
	x: number;
	y: number;
}

export interface PaddleState {
	position: number;
	direction: -1 | 0 | 1;
}

export interface BallState {
	position: Vector2;
	velocity: Vector2;
}

export interface ScoreState {
	left: number;
	right: number;
}

export interface GameState {
	ball: BallState;
	paddles: Record<PlayerSide, PaddleState>;
	score: ScoreState;
	status: GameStatus;
	rally: number;
}

export interface StepResult {
	state: GameState;
	scoredSide?: PlayerSide;
	winner?: PlayerSide;
}

export const GAME_CONFIG = {
	arenaWidth: 800,
	arenaHeight: 460,
	paddle: {
		height: 100,
		width: 16,
		speed: 420,
		offset: 8,
	},
	ball: {
		radius: 8,
		speed: 450,
		maxVerticalFactor: 0.8,
	},
	maxScore: 11,
	loopIntervalMs: 1000 / 60,
} as const;

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

export function createInitialState(): GameState {
	return {
		ball: {
			position: { x: GAME_CONFIG.arenaWidth / 2, y: GAME_CONFIG.arenaHeight / 2 },
			velocity: randomServeVelocity("left"),
		},
		paddles: {
			left: { position: GAME_CONFIG.arenaHeight / 2, direction: 0 },
			right: { position: GAME_CONFIG.arenaHeight / 2, direction: 0 },
		},
		score: { left: 0, right: 0 },
		status: "waiting",
		rally: 0,
	};
}

export function applyInputCommand(paddle: PaddleState, command: InputCommand): void {
	if (command === "up") {
		paddle.direction = -1;
	} else if (command === "down") {
		paddle.direction = 1;
	} else {
		paddle.direction = 0;
	}
}

export function stepGameState(current: GameState, deltaMs: number): StepResult {
	const nextState: Mutable<GameState> = {
		ball: {
			position: { ...current.ball.position },
			velocity: { ...current.ball.velocity },
		},
		paddles: {
			left: { ...current.paddles.left },
			right: { ...current.paddles.right },
		},
		score: { ...current.score },
		status: current.status,
		rally: current.rally,
	};

	const dt = deltaMs / 1000;
	updatePaddle(nextState.paddles.left, dt);
	updatePaddle(nextState.paddles.right, dt);
	updateBall(nextState, dt);

	let scoredSide: PlayerSide | undefined;

	if (nextState.ball.position.x < -GAME_CONFIG.ball.radius) {
		scoredSide = "right";
		registerScore(nextState, scoredSide);
	} else if (nextState.ball.position.x > GAME_CONFIG.arenaWidth + GAME_CONFIG.ball.radius) {
		scoredSide = "left";
		registerScore(nextState, scoredSide);
	}

	let winner: PlayerSide | undefined;
	if (nextState.score.left >= GAME_CONFIG.maxScore) {
		nextState.status = "ended";
		winner = "left";
	} else if (nextState.score.right >= GAME_CONFIG.maxScore) {
		nextState.status = "ended";
		winner = "right";
	}

	return {
		state: nextState,
		scoredSide,
		winner,
	};
}

function updatePaddle(paddle: PaddleState, dt: number): void {
	const halfHeight = GAME_CONFIG.paddle.height / 2;
	const min = halfHeight;
	const max = GAME_CONFIG.arenaHeight - halfHeight;
	const delta = paddle.direction * GAME_CONFIG.paddle.speed * dt;
	paddle.position = clamp(paddle.position + delta, min, max);
}

function updateBall(state: Mutable<GameState>, dt: number): void {
	const { ball, paddles } = state;
	ball.position.x += ball.velocity.x * dt;
	ball.position.y += ball.velocity.y * dt;

	const topBoundary = GAME_CONFIG.ball.radius;
	const bottomBoundary = GAME_CONFIG.arenaHeight - GAME_CONFIG.ball.radius;

	if (ball.position.y <= topBoundary && ball.velocity.y < 0) {
		ball.position.y = topBoundary;
		ball.velocity.y *= -1;
	}

	if (ball.position.y >= bottomBoundary && ball.velocity.y > 0) {
		ball.position.y = bottomBoundary;
		ball.velocity.y *= -1;
	}

	handlePaddleCollision(ball, paddles.left, "left");
	handlePaddleCollision(ball, paddles.right, "right");
}

function handlePaddleCollision(ball: BallState, paddle: PaddleState, side: PlayerSide): void {
	const paddleX = side === "left" ? GAME_CONFIG.paddle.offset : GAME_CONFIG.arenaWidth - GAME_CONFIG.paddle.offset;
	const towardsPaddle = side === "left" ? ball.velocity.x < 0 : ball.velocity.x > 0;

	if (!towardsPaddle) {
		return;
	}

	const thresholdX = side === "left" ? paddleX + GAME_CONFIG.ball.radius : paddleX - GAME_CONFIG.ball.radius;
	const reachedPaddle = side === "left" ? ball.position.x <= thresholdX : ball.position.x >= thresholdX;

	if (!reachedPaddle) {
		return;
	}

	const paddleHalfHeight = GAME_CONFIG.paddle.height / 2;
	const distanceY = Math.abs(ball.position.y - paddle.position);

	if (distanceY > paddleHalfHeight) {
		return;
	}

	// Reflect horizontally and add deflection based on impact point.
	const impactFactor = clamp((ball.position.y - paddle.position) / paddleHalfHeight, -1, 1);
	const direction = side === "left" ? 1 : -1;
	ball.position.x = side === "left" ? thresholdX : thresholdX;
	ball.velocity.x = direction * GAME_CONFIG.ball.speed;
	ball.velocity.y = impactFactor * GAME_CONFIG.ball.speed * GAME_CONFIG.ball.maxVerticalFactor;
}

function registerScore(state: Mutable<GameState>, scoredSide: PlayerSide): void {
	state.score[scoredSide] += 1;
	state.rally = 0;
	const serveTo: PlayerSide = scoredSide === "left" ? "right" : "left";
	state.ball.position = { x: GAME_CONFIG.arenaWidth / 2, y: GAME_CONFIG.arenaHeight / 2 };
	state.ball.velocity = randomServeVelocity(serveTo);
}

function randomServeVelocity(towards: PlayerSide): Vector2 {
	const horizontal = towards === "left" ? -GAME_CONFIG.ball.speed : GAME_CONFIG.ball.speed;
	const angle = (Math.random() - 0.5) * Math.PI * GAME_CONFIG.ball.maxVerticalFactor;
	const vertical = Math.sin(angle) * GAME_CONFIG.ball.speed * GAME_CONFIG.ball.maxVerticalFactor;
	return { x: horizontal, y: vertical };
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}
