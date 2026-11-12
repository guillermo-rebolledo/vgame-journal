/** Only selected by the isolated E2E aliases; no production flag provider calls. */
export const steamImportFlag = async () => {
  const session = await currentSession();
  const response = await fetch(
    `${process.env.E2E_SUPPORT_URL}/steam-flag?username=${encodeURIComponent(session?.user.username ?? "")}`,
    { cache: "no-store" },
  );
  return ((await response.json()) as { enabled: boolean }).enabled;
};

import { currentSession } from "../../src/lib/auth";
export async function reviewFixture() {
  const session = await currentSession();
  const response = await fetch(
    `${process.env.E2E_SUPPORT_URL}/review-fixture?username=${encodeURIComponent(session?.user.username ?? "")}`,
    { cache: "no-store" },
  );
  return response.json() as Promise<{ enabled: boolean; now: string }>;
}
export const yearInReviewFlag = async () => (await reviewFixture()).enabled;
