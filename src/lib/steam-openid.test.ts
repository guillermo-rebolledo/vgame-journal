import { beforeEach, expect, test, vi } from "vitest";
import { user } from "@/db/schema";
import { createTestDb } from "@/test/db";
import { createSteamOpenId, STEAM_OPENID_ENDPOINT } from "./steam-openid";

const identity = "https://steamcommunity.com/openid/id/76561198000000000";
const session = { userId: "mario", sessionId: "session-a" };
let database: Awaited<ReturnType<typeof createTestDb>>;
let fetcher: ReturnType<typeof vi.fn<typeof fetch>>;
let verifier: ReturnType<typeof createSteamOpenId>;
beforeEach(async () => {
  const db = await createTestDb();
  database = db;
  fetcher = vi.fn(async () => new Response("is_valid:true\n"));
  await db
    .insert(user)
    .values({ id: "mario", name: "Mario", email: "mario@example.com" });
  verifier = createSteamOpenId(db, "https://shelve.games", fetcher);
});
async function assertion() {
  const login = new URL(await verifier.start(session));
  const callback = new URL(
    login.searchParams.get("openid.return_to") as string,
  );
  const params = callback.searchParams;
  for (const [field, value] of Object.entries({
    mode: "id_res",
    ns: "http://specs.openid.net/auth/2.0",
    op_endpoint: STEAM_OPENID_ENDPOINT,
    return_to: callback.href,
    claimed_id: identity,
    identity,
    signed:
      "op_endpoint,return_to,claimed_id,identity,response_nonce,assoc_handle",
    response_nonce: "2026-11-09T00:00:00Zabc",
    assoc_handle: "abc",
  }))
    params.set(`openid.${field}`, value);
  return params;
}
test("verified assertion is session-bound and single-use", async () => {
  const params = await assertion();
  expect(await verifier.verify(session, params)).toBe("76561198000000000");
  await expect(verifier.verify(session, params)).rejects.toThrow();
});
test.each([
  "state",
  "session",
  "return_to",
  "op_endpoint",
  "identity",
  "claimed_id",
  "signed",
  "cancel",
  "duplicate",
])("rejects %s", async (failure) => {
  const params = await assertion();
  const owner = { ...session };
  if (failure === "session") owner.sessionId = "other";
  else if (failure === "state") params.set("state", "forged");
  else if (failure === "cancel") params.set("openid.mode", "cancel");
  else if (failure === "duplicate") params.append("openid.identity", identity);
  else params.set(`openid.${failure}`, "forged");
  await expect(verifier.verify(owner, params)).rejects.toThrow();
});

test("Steam must confirm the full assertion; false or expired proof never connects", async () => {
  const params = await assertion();
  fetcher.mockResolvedValue(new Response("is_valid:false\n"));
  await expect(verifier.verify(session, params)).rejects.toThrow();
  const { verification } = await import("@/db/schema");
  const fresh = await assertion();
  await database.update(verification).set({ expiresAt: new Date(0) });
  await expect(verifier.verify(session, fresh)).rejects.toThrow();
});
