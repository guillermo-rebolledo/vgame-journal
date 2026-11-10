import { beforeEach, expect, test, vi } from "vitest";

const { decide, session } = vi.hoisted(() => ({
  decide: vi.fn(),
  session: vi.fn(),
}));
vi.mock("@flags-sdk/vercel", () => ({
  vercelAdapter: () => ({ decide, config: { reportValue: false } }),
}));
vi.mock("@/lib/auth", () => ({ currentSession: session }));
const { steamImportFlag } = await import("./flags");
const evaluate = () =>
  steamImportFlag.run({
    request: new Request("http://localhost/settings"),
    identify: steamImportFlag.identify,
  });

beforeEach(() => {
  vi.resetAllMocks();
  session.mockResolvedValue({
    user: { id: "owner", email: "private@example.com" },
  });
});

test("Steam rollout targets the signed-in user ID without sending other account fields", async () => {
  decide.mockImplementation(({ entities }) => entities.user?.id === "owner");
  expect(await evaluate()).toBe(true);
  expect(decide).toHaveBeenCalledWith(
    expect.objectContaining({
      key: "steam-import",
      entities: { user: { id: "owner" } },
    }),
  );
  session.mockResolvedValue({ user: { id: "other" } });
  expect(await evaluate()).toBe(false);
});

test("Steam rollout defaults off when a flag is missing or its provider fails", async () => {
  decide.mockResolvedValue(undefined);
  expect(await evaluate()).toBe(false);
  decide.mockRejectedValue(new Error("Flags unavailable"));
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    expect(await evaluate()).toBe(false);
  } finally {
    log.mockRestore();
  }
});

test("Year in Review targets only signed-in IDs and fails closed", async () => {
  const { yearInReviewFlag } = await import("./flags");
  const evaluate = () =>
    yearInReviewFlag.run({
      request: new Request("http://localhost/year-in-review"),
      identify: yearInReviewFlag.identify,
    });
  decide.mockImplementation(({ entities }) => entities.user?.id === "owner");
  expect(await evaluate()).toBe(true);
  expect(decide).toHaveBeenCalledWith(
    expect.objectContaining({
      key: "year-in-review",
      entities: { user: { id: "owner" } },
    }),
  );
  session.mockResolvedValue({ user: { id: "other" } });
  expect(await evaluate()).toBe(false);
  session.mockResolvedValue(null);
  expect(await evaluate()).toBe(false);
  decide.mockResolvedValue(undefined);
  expect(await evaluate()).toBe(false);
  decide.mockRejectedValue(new Error("Unavailable"));
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    expect(await evaluate()).toBe(false);
  } finally {
    log.mockRestore();
  }
});
