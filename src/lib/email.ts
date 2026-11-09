import { SITE_NAME } from "@/config/site";
import { OperationalError, operationalCode } from "@/lib/operational-errors";

import { retryAfterUntil } from "@/lib/retry-after";

let retryAt = 0;

export type Email = {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
};

const SENDER = process.env.RESEND_EMAIL_DOMAIN
  ? `noreply@${process.env.RESEND_EMAIL_DOMAIN}`
  : "onboarding@resend.dev";

/** Provider acceptance only, not mailbox delivery. No retry: acceptance may be ambiguous. */
export async function sendWithResend(email: Email) {
  if (Date.now() < retryAt) throw new OperationalError("rate_limited");
  const signal = AbortSignal.timeout(10_000);
  try {
    // Native fetch avoids the SDK's development logging of raw provider errors.
    const response = await fetch(
      `${process.env.RESEND_BASE_URL ?? "https://api.resend.com"}/emails`,
      {
        method: "POST",
        signal,
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY ?? ""}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: `${SITE_NAME} <${SENDER}>`,
          to: email.to,
          subject: email.subject,
          text: email.text,
          ...(email.replyTo ? { reply_to: email.replyTo } : {}),
        }),
      },
    );
    if (response.status === 429)
      retryAt = Math.max(
        retryAt,
        retryAfterUntil(response.headers.get("retry-after")),
      );
    if (!response.ok)
      throw new OperationalError(
        response.status === 429 ? "rate_limited" : "unavailable",
      );
    const result = await response.json();
    if (typeof result?.id !== "string" || !result.id)
      throw new OperationalError("invalid_response");
  } catch (error) {
    throw new OperationalError(
      signal.aborted
        ? "timeout"
        : error instanceof OperationalError
          ? error.code
          : error instanceof SyntaxError
            ? "invalid_response"
            : operationalCode(error),
    );
  }
}
