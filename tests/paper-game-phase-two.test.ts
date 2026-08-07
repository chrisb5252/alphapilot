import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
import { rankLeaderboardRows } from "@/lib/paper-game/phase-two-service";

describe("paper-game leaderboard privacy and ranking", () => {
  it("orders ties deterministically and does not expose user identities", () => {
    const rows = rankLeaderboardRows(
      [
        { userId: "user-b", alphaScore: new Prisma.Decimal(80), challengePoints: 20, level: 3 },
        { userId: "user-a", alphaScore: new Prisma.Decimal(80), challengePoints: 40, level: 4 },
      ],
      "user-b",
    );
    expect(rows.map((row) => row.rank)).toEqual([1, 2]);
    expect(rows[0].nickname).toBe("Paper investor 1");
    expect(rows[1]).toMatchObject({ nickname: "You", isCurrentUser: true });
  });
});
