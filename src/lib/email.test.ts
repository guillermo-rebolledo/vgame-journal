import { inspect } from "node:util";
import { afterEach, expect, test, vi } from "vitest";
import { sendWithResend } from "./email";

const { send } = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send };
  },
}));

afterEach(() => vi.resetAllMocks());

const sentinel = "PRIVATE-recipient-body-reset-token-cookie-authorization";
const email = { to: "delivered@resend.dev", subject: "Verify", text: sentinel };

test("provider rejection exposes only a fixed delivery error without sensitive details or cause", async () => {
  send.mockResolvedValue({ error: { message: sentinel, name: sentinel } });
  const error = await sendWithResend(email).catch((error: unknown) => error);
  expect(error).toBeInstanceOf(Error);
  expect(error).toHaveProperty("message", "Email delivery failed");
  expect(error).not.toHaveProperty("cause");
  expect(inspect(error, { showHidden: true })).not.toContain(sentinel);
});

test("network rejection discards sensitive error properties and nested causes", async () => {
  send.mockRejectedValue(
    Object.assign(new Error(sentinel, { cause: new Error(sentinel) }), {
      request: email,
    }),
  );
  const error = await sendWithResend(email).catch((error: unknown) => error);
  expect(error).toBeInstanceOf(Error);
  expect(error).toHaveProperty("message", "Email delivery failed");
  expect(error).not.toHaveProperty("cause");
  expect(error).not.toHaveProperty("request");
  expect(inspect(error, { showHidden: true })).not.toContain(sentinel);
});

test("successful delivery preserves the email and returns success without resending", async () => {
  send.mockResolvedValue({ data: { id: "sent" }, error: null });
  await expect(sendWithResend(email)).resolves.toBeUndefined();
  expect(send).toHaveBeenCalledExactlyOnceWith(expect.objectContaining(email));
});
