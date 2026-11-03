import { type APIRequestContext, expect } from "@playwright/test";
import { supportUrl } from "./url";

/** Keep fixture statements local while sharing the isolated database transport. */
export async function seedSql(
  request: APIRequestContext,
  statements: string[],
  params: string[],
) {
  for (const sql of statements) {
    const response = await request.post(supportUrl("/query"), {
      data: { sql, params: sql.includes("$1") ? params : [] },
    });
    expect(response.ok(), await response.text()).toBeTruthy();
  }
}
