import { LocalMatchState } from '../state/models';
import type { PlaneVector } from '../state/models';
import { checkScoring } from '../state/scoring';

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const isPaddleCollision = (
	ball: PlaneVector,
	radius: number,
	paddleY: number,
	paddleX: number,
	paddleHeight: number,
	paddleWidth: number,
): boolean => {
	if (Math.abs(ball.y - paddleY) > paddleHeight / 2) {
		return false;
	}

	const halfWidth = paddleWidth / 2;
	const paddleLeft = paddleX - halfWidth;
	const paddleRight = paddleX + halfWidth;

	return paddleX < 0
		? ball.x - radius <= paddleRight
		: ball.x + radius >= paddleLeft;
};

type PaddleDirection = 'up' | 'down' | 'stop';

const movePaddle = (current: number, direction: PaddleDirection, speed: number, dt: number, min: number, max: number) => {
	const delta = direction === 'up' ? speed * dt : direction === 'down' ? -speed * dt : 0;
	return clamp(current + delta, min, max);
};

const applyWallBounce = (coords: PlaneVector, momentum: PlaneVector, limit: number, radius: number) => {
	const max = limit - radius;
	const min = -limit + radius;
	if (coords.y > max || coords.y < min) {
		momentum.y *= -1;
		coords.y = clamp(coords.y, min, max);
	}
};

const handlePaddleBounce = (
	gameInfo: LocalMatchState,
	paddleX: number,
	paddleY: number,
	directionCheck: boolean,
	adjustBall: (x: number) => number,
): void => {
	const { ballCoords, ballMomentum, arena } = gameInfo;
	if (!directionCheck) {
		return;
	}
	if (!isPaddleCollision(ballCoords, arena.ballRadius, paddleY, paddleX, arena.paddleHeight, arena.paddleWidth)) {
		return;
	}

	ballMomentum.x *= -1;
	const relativeHit = ballCoords.y - paddleY;
	const normalizedHit = relativeHit / (arena.paddleHeight / 2);
	
	const baseAngle = normalizedHit * (Math.PI / 3);
	const randomVariation = (Math.random() - 0.5) * (Math.PI / 6);
	const bounceAngle = baseAngle + randomVariation;
	
	const currentSpeed = Math.sqrt(ballMomentum.x * ballMomentum.x + ballMomentum.y * ballMomentum.y);
	const maxSpeed = arena.ballRadius * 100;
	const newSpeed = Math.min(currentSpeed * 1.05, maxSpeed);
	
	const direction = ballMomentum.x > 0 ? 1 : -1;
	ballMomentum.x = Math.cos(bounceAngle) * newSpeed * direction;
	ballMomentum.y = -Math.sin(bounceAngle) * newSpeed;
	
	ballMomentum.y += (Math.random() - 0.5) * (currentSpeed * 0.1);
	
	ballCoords.x = adjustBall(paddleX);
};

export function updateGamePhysics(
	gameInfo: LocalMatchState,
	dt: number,
	leftDirection: PaddleDirection,
	rightDirection: PaddleDirection,
): void {
	const { arena, paddleTrack, ballCoords, ballMomentum } = gameInfo;
	const { paddleSpeed, paddleHeight, paddleOffset, ballRadius, groundHeight, groundWidth } = arena;

	const halfHeight = groundHeight / 2;
	const paddleBounds = {
		min: -halfHeight + paddleHeight / 2,
		max: halfHeight - paddleHeight / 2,
	};

	paddleTrack.p1y = movePaddle(paddleTrack.p1y, leftDirection, paddleSpeed, dt, paddleBounds.min, paddleBounds.max);
	paddleTrack.p2y = movePaddle(paddleTrack.p2y, rightDirection, paddleSpeed, dt, paddleBounds.min, paddleBounds.max);

	ballCoords.x += ballMomentum.x * dt;
	ballCoords.y += ballMomentum.y * dt;

	applyWallBounce(ballCoords, ballMomentum, halfHeight, ballRadius);

	const halfWidth = groundWidth / 2;
	const p1X = -halfWidth + paddleOffset;
	const p2X = halfWidth - paddleOffset;

	handlePaddleBounce(gameInfo, p1X, paddleTrack.p1y, ballMomentum.x < 0 && ballCoords.x <= p1X + ballRadius, x => x + ballRadius);
    handlePaddleBounce(gameInfo, p2X, paddleTrack.p2y, ballMomentum.x > 0 && ballCoords.x >= p2X - ballRadius, x => x - ballRadius);

    checkScoring(gameInfo);
    }