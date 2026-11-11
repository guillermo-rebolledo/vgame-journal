import { beforeEach, expect, test, vi } from "vitest";

const state = vi.hoisted(() => ({
  signedIn: true,
  enabled: true,
  viewed: vi.fn(async () => true),
  dismiss: vi.fn(async () => {}),
  hide: vi.fn(async () => {}),
  revalidate: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({
  currentSession: async () =>
    state.signedIn ? { user: { id: "mario" }, session: { id: "first" } } : null,
}));
vi.mock("@/lib/flags", () => ({ yearInReviewFlag: async () => state.enabled }));
vi.mock("@/lib/review-invitation", () => ({
  reviewInvitation: {
    viewed: state.viewed,
    dismiss: state.dismiss,
    hide: state.hide,
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: state.revalidate }));

import { dismissReviewInvitation, markReviewViewed } from "./actions";

beforeEach(() => {
  vi.clearAllMocks();
  state.signedIn = true;
  state.enabled = true;
});

test("actions reject a different owner, missing login, disabled flag and invalid duration", async () => {
  await markReviewViewed("luigi");
  expect(await dismissReviewInvitation("luigi", "year")).toBeTruthy();
  state.signedIn = false;
  await markReviewViewed("mario");
  expect(await dismissReviewInvitation("mario", "year")).toBeTruthy();
  state.signedIn = true;
  state.enabled = false;
  await markReviewViewed("mario");
  expect(await dismissReviewInvitation("mario", "session")).toBeTruthy();
  state.enabled = true;
  // @ts-expect-error Server action inputs can bypass the client type.
  expect(await dismissReviewInvitation("mario", "forever")).toBeTruthy();
  expect(state.viewed).not.toHaveBeenCalled();
  expect(state.hide).not.toHaveBeenCalled();
  expect(state.dismiss).not.toHaveBeenCalled();
});

test("actions use the authenticated session and preserve retry on write failure", async () => {
  await markReviewViewed("mario");
  expect(state.viewed).toHaveBeenCalledWith("mario");
  expect(await dismissReviewInvitation("mario", "session")).toBeNull();
  expect(state.dismiss).toHaveBeenCalledWith("mario", "first");
  state.hide.mockRejectedValueOnce(new Error("Database unavailable"));
  expect(await dismissReviewInvitation("mario", "year")).toMatch(/try again/);
  expect(await dismissReviewInvitation("mario", "year")).toBeNull();
  expect(state.hide).toHaveBeenCalledWith("mario");
});
