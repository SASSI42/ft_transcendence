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
} as const;
