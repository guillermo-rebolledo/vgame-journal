import { beforeEach, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  enabled: vi.fn(),
  currentSession: vi.fn(),
  ownerId: vi.fn(),
  start: vi.fn(),
  verify: vi.fn(),
  review: vi.fn(),
  commit: vi.fn(),
  link: vi.fn(),
  unlink: vi.fn(),
}));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/lib/auth", () => ({
  currentSession: mocks.currentSession,
  ownerId: mocks.ownerId,
}));
vi.mock("@/lib/steam-server", () => ({
  steamImportEnabled: mocks.enabled,
  steamImport: {
    review: mocks.review,
    commit: mocks.commit,
    link: mocks.link,
    unlink: mocks.unlink,
  },
}));
vi.mock("@/lib/steam-openid", () => ({
  createSteamOpenId: () => ({ start: mocks.start, verify: mocks.verify }),
}));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));
const { GET: connect } = await import("@/app/api/steam/connect/route");
const { GET: callback } = await import("@/app/api/steam/callback/route");
const { readSteamImport, commitSteamImport, disconnectSteam } = await import(
  "@/app/settings/steam-actions"
);

beforeEach(() => {
  vi.resetAllMocks();
  mocks.enabled.mockResolvedValue(false);
  mocks.currentSession.mockResolvedValue({
    user: { id: "owner" },
    session: { id: "session" },
  });
  mocks.ownerId.mockResolvedValue("owner");
});

test("a disabled async flag blocks connection, callback, reading and committing", async () => {
  expect((await connect()).headers.get("location")).toBe(
    "http://localhost:3000/settings?steam=unavailable",
  );
  expect(
    (
      await callback(new Request("http://localhost:3000/api/steam/callback"))
    ).headers.get("location"),
  ).toBe("http://localhost:3000/settings?steam=failed");
  expect(await readSteamImport("owner")).toEqual({ kind: "unavailable" });
  expect(await commitSteamImport("owner", [620])).toEqual({
    error: "Steam import is not available yet.",
  });
  for (const operation of [
    mocks.start,
    mocks.verify,
    mocks.review,
    mocks.commit,
    mocks.link,
  ])
    expect(operation).not.toHaveBeenCalled();
});

test("an enabled flag admits the signed-in owner and still permits disconnect when disabled", async () => {
  mocks.enabled.mockResolvedValue(true);
  mocks.start.mockResolvedValue("https://steamcommunity.com/openid/login");
  mocks.verify.mockResolvedValue("76561198000000000");
  mocks.review.mockResolvedValue({ kind: "empty" });
  mocks.commit.mockResolvedValue({ added: 1, feedbackInvitation: false });
  expect((await connect()).headers.get("location")).toBe(
    "https://steamcommunity.com/openid/login",
  );
  expect(
    (
      await callback(new Request("http://localhost:3000/api/steam/callback"))
    ).headers.get("location"),
  ).toBe("http://localhost:3000/settings?steam=connected");
  expect(mocks.link).toHaveBeenCalledWith("owner", "76561198000000000");
  expect(await readSteamImport("owner")).toEqual({ kind: "empty" });
  expect(await commitSteamImport("owner", [620])).toEqual({
    added: 1,
    feedbackInvitation: false,
  });
  mocks.enabled.mockResolvedValue(false);
  expect(await disconnectSteam("owner")).toEqual({ disconnected: true });
  expect(mocks.unlink).toHaveBeenCalledWith("owner");
});
