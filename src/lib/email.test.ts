import { afterEach, expect, test, vi } from "vitest";
import { sendWithResend } from "./email";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

test("provider rejection is safe and sends once with an explicit deadline", async () => {
  vi.stubEnv("RESEND_API_KEY", "re_test");
  vi.spyOn(console, "error").mockImplementation(() => {});
  const fetcher = vi.fn(async (_url, options) => {
    expect(options.signal).toBeInstanceOf(AbortSignal);
    return Response.json(
      {
        name: "rate_limit_exceeded",
        statusCode: 429,
        message: "secret@example.com token=secret",
      },
      { status: 429, headers: { "retry-after": "60" } },
    );
  });
  vi.stubGlobal("fetch", fetcher);
  await expect(
    sendWithResend({
      to: "delivered@resend.dev",
      subject: "test",
      text: "private",
    }),
  ).rejects.toMatchObject({
    code: "rate_limited",
    message: "Operation failed: rate_limited",
  });
  await expect(
    sendWithResend({
      to: "delivered@resend.dev",
      subject: "test",
      text: "private",
    }),
  ).rejects.toMatchObject({ code: "rate_limited" });
  expect(fetcher).toHaveBeenCalledOnce();
  const later = Date.now() + 60_001;
  vi.spyOn(Date, "now").mockReturnValue(later);
  fetcher.mockResolvedValue(Response.json({ id: "accepted" }));
  await expect(
    sendWithResend({
      to: "delivered@resend.dev",
      subject: "test",
      text: "private",
      replyTo: "delivered@resend.dev",
    }),
  ).resolves.toBeUndefined();
  expect(JSON.parse(fetcher.mock.calls[1][1].body)).toHaveProperty(
    "reply_to",
    "delivered@resend.dev",
  );
  expect(fetcher).toHaveBeenCalledTimes(2);
});

test("malformed acceptance is unavailable without exposing response text", async () => {
  vi.resetModules();
  const { sendWithResend } = await import("./email");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("private provider payload")),
  );
  await expect(
    sendWithResend({
      to: "delivered@resend.dev",
      subject: "test",
      text: "private",
    }),
  ).rejects.toMatchObject({ code: "invalid_response" });
});

test("email timeout aborts the transport without retrying or exposing the failure", async () => {
  vi.resetModules();
  const { sendWithResend } = await import("./email");
  const controller = new AbortController();
  const timeout = vi
    .spyOn(AbortSignal, "timeout")
    .mockReturnValue(controller.signal);
  const fetcher = vi.fn(
    (_url, options) =>
      new Promise<Response>((_resolve, reject) => {
        options.signal.addEventListener(
          "abort",
          () => reject(new Error("private transport error")),
          { once: true },
        );
      }),
  );
  vi.stubGlobal("fetch", fetcher);
  const sending = sendWithResend({
    to: "delivered@resend.dev",
    subject: "test",
    text: "private",
  });
  const assertion = expect(sending).rejects.toMatchObject({
    code: "timeout",
    message: "Operation failed: timeout",
  });
  controller.abort();
  await assertion;
  expect(timeout).toHaveBeenCalledWith(10_000);
  expect(fetcher).toHaveBeenCalledOnce();
});
