import { randomBytes } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import type { Db } from "@/db";
import { verification } from "@/db/schema";

export const STEAM_OPENID_ENDPOINT = "https://steamcommunity.com/openid/login";
const NS = "http://specs.openid.net/auth/2.0";
type Owner = { userId: string; sessionId: string };

/** State is consumed even on failed verification; a replay can never attach an identity. */
export function createSteamOpenId(
  db: Db,
  appUrl: string,
  fetcher: typeof fetch = fetch,
) {
  const callback = (state: string) =>
    new URL(`/api/steam/callback?state=${encodeURIComponent(state)}`, appUrl)
      .href;
  return {
    async start(owner: Owner) {
      const state = randomBytes(32).toString("hex");
      await db.insert(verification).values({
        id: `steam:${state}`,
        identifier: `steam:${owner.sessionId}`,
        value: owner.userId,
        expiresAt: new Date(Date.now() + 10 * 60_000),
      });
      const url = new URL(STEAM_OPENID_ENDPOINT);
      url.search = new URLSearchParams({
        "openid.ns": NS,
        "openid.mode": "checkid_setup",
        "openid.return_to": callback(state),
        "openid.realm": new URL(appUrl).origin,
        "openid.identity": `${NS}/identifier_select`,
        "openid.claimed_id": `${NS}/identifier_select`,
      }).toString();
      return url.href;
    },
    async verify(owner: Owner, params: URLSearchParams) {
      const state = params.get("state") ?? "";
      if (!/^[a-f0-9]{64}$/.test(state)) throw new Error("Invalid Steam state");
      const [proof] = await db
        .delete(verification)
        .where(
          and(
            eq(verification.id, `steam:${state}`),
            eq(verification.identifier, `steam:${owner.sessionId}`),
            eq(verification.value, owner.userId),
            gt(verification.expiresAt, new Date()),
          ),
        )
        .returning();
      if (!proof) throw new Error("Expired Steam sign-in");
      for (const name of params.keys())
        if (params.getAll(name).length !== 1)
          throw new Error("Duplicate assertion field");
      const get = (name: string) => params.get(`openid.${name}`);
      const identity = get("claimed_id");
      const id = identity?.match(
        /^https?:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/,
      )?.[1];
      const signed = new Set((get("signed") ?? "").split(","));
      if (
        get("mode") !== "id_res" ||
        get("ns") !== NS ||
        get("return_to") !== callback(state) ||
        get("op_endpoint") !== STEAM_OPENID_ENDPOINT ||
        !id ||
        identity !== get("identity") ||
        [
          "op_endpoint",
          "return_to",
          "claimed_id",
          "identity",
          "response_nonce",
          "assoc_handle",
        ].some((key) => !signed.has(key) || !get(key))
      )
        throw new Error("Invalid Steam assertion");
      const body = new URLSearchParams(params);
      body.set("openid.mode", "check_authentication");
      const response = await fetcher(STEAM_OPENID_ENDPOINT, {
        method: "POST",
        body,
        signal: AbortSignal.timeout(15_000),
        redirect: "error",
      });
      if (
        !response.ok ||
        !(await response.text()).split(/\r?\n/).includes("is_valid:true")
      )
        throw new Error("Steam rejected assertion");
      return id;
    },
  };
}
