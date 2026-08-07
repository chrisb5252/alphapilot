export const PAPER_GAME_LEVELS = [
  { level: 1, minimumXP: 0 }, { level: 2, minimumXP: 250 },
  { level: 3, minimumXP: 600 }, { level: 4, minimumXP: 1000 },
  { level: 5, minimumXP: 1500 }, { level: 6, minimumXP: 2200 },
  { level: 7, minimumXP: 3000 }, { level: 8, minimumXP: 4000 },
  { level: 9, minimumXP: 5250 }, { level: 10, minimumXP: 7000 },
] as const;

export function levelForXP(totalXP: number) {
  return PAPER_GAME_LEVELS.filter((item) => totalXP >= item.minimumXP).at(-1)?.level ?? 1;
}

export function levelProgress(totalXP: number) {
  const current = PAPER_GAME_LEVELS.filter((item) => totalXP >= item.minimumXP).at(-1) ?? PAPER_GAME_LEVELS[0];
  const next = PAPER_GAME_LEVELS.find((item) => item.level === current.level + 1) ?? null;
  return { currentLevel: current.level, nextLevelXP: next?.minimumXP ?? null, progress: next ? Math.min(100, ((totalXP - current.minimumXP) / (next.minimumXP - current.minimumXP)) * 100) : 100 };
}
