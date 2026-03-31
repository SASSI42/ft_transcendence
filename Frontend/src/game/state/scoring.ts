import { GAME_CONFIG } from '../config';
import { LocalMatchState } from './models';
import type { PlayerSideTag } from './models';

const randomServeVelocity = (towards: PlayerSideTag) => {
	const horizontalDirection = towards === 'rightPlayer' ? 1 : -1;
	const angle = (Math.random() - 0.5) * Math.PI * GAME_CONFIG.ball.maxVerticalFactor;
	const speed = GAME_CONFIG.ball.speed;
	return {
		x: Math.cos(angle) * speed * horizontalDirection,
		y: Math.sin(angle) * speed,
	};
};

const resetBall = (gameInfo: LocalMatchState, scoringPlayer: PlayerSideTag): void => {
	gameInfo.ballCoords = { x: 0, y: 0 };
	const serveTarget: PlayerSideTag = scoringPlayer === 'rightPlayer' ? 'leftPlayer' : 'rightPlayer';
	gameInfo.ballMomentum = randomServeVelocity(serveTarget);
};

export function checkScoring(gameInfo: LocalMatchState): boolean {
	const {
		ballCoords: { x },
		arena: { groundWidth, ballRadius, maxScore },
		scoreCard,
		status,
	} = gameInfo;
	const limit = groundWidth / 2;
	const leftLoss = x <= -limit - ballRadius;
	const rightLoss = x >= limit + ballRadius;

	if (!leftLoss && !rightLoss) {
		return false;
	}

	const winner: PlayerSideTag = leftLoss ? 'rightPlayer' : 'leftPlayer';
	scoreCard.points[winner] += 1;
	resetBall(gameInfo, winner);

	if (scoreCard.points[winner] >= maxScore) {
		status.setOver = true;
	}

	return true;
}