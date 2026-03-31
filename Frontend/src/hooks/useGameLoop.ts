import { useEffect } from 'react';
import type { LocalMatchState } from '../game/state/models';
import { updateGamePhysics } from '../game/physics/physics';
import { LocalInputHandler } from '../game/keyboard/bindings';

export function useGameLoop(gameState: LocalMatchState | null) {
  useEffect(() => {
    if (!gameState) return;

    let animationFrameId: number;
    let lastTime = performance.now();

    const gameLoop = (currentTime: number) => {
      const deltaTime = (currentTime - lastTime) / 1000;
      lastTime = currentTime;

      if (!gameState.status.setOver && !gameState.status.isPaused) {
        const inputHandler = LocalInputHandler.getInstance();
        updateGamePhysics(
          gameState,
          deltaTime,
          inputHandler.directions.left,
          inputHandler.directions.right
        );
      }

      animationFrameId = requestAnimationFrame(gameLoop);
    };

    animationFrameId = requestAnimationFrame(gameLoop);

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [gameState]);
}
