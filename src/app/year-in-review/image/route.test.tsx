import { expect, test, vi } from "vitest";

const { review } = vi.hoisted(() => ({
  review: {
    year: 2026,
    asOf: "2026-12-01T00:00:00.000Z",
    through: "2026-12-01",
    inProgress: true,
    logged: {
      count: 10000,
      games: Array.from({ length: 3 }, (_, i) => ({
        gameId: i,
        title: `Game ${i}`,
        slug: `game-${i}`,
        coverImageId: null,
      })),
    },
    played: {
      count: 1234,
      games: Array.from({ length: 5 }, (_, i) => ({
        gameId: i,
        title: `Game ${i}`,
        slug: `game-${i}`,
        coverImageId: null,
      })),
    },
    loggedByMonth: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 0],
    hours: 98765.4,
    topPlatform: { name: "Nintendo Entertainment System", games: 1000 },
  },
}));
vi.mock("@/lib/auth", () => ({
  currentSession: async () => ({
    user: { id: "player", username: "a_very_long_username_1234567890" },
  }),
}));
vi.mock("@/lib/flags", () => ({ yearInReviewFlag: async () => true }));
vi.mock("@/lib/journal", () => ({
  journal: { yearInReview: async () => review },
}));
vi.mock("@/lib/year-in-review-clock", () => ({
  yearInReviewNow: async () => new Date("2026-12-01T00:00:00Z"),
}));

import { GET } from "./route";

test("renders the Mono poster with large counts and a long optional username", async () => {
  const images: Buffer[] = [];
  for (const username of ["0", "1"]) {
    const response = await GET(
      new Request(`http://localhost/year-in-review/image?username=${username}`),
    );
    expect(response.status).toBe(200);
    const bytes = Buffer.from(await response.arrayBuffer());
    images.push(bytes);
    expect(bytes.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20)]).toEqual([
      1080, 1350,
    ]);
  }
  expect(images[0].equals(images[1])).toBe(false);
});
