import { expect, test } from "vitest";
import { authPageHref, safeReturnTo } from "./auth-continuation";

test("R10 accepts local destinations and preserves their browsing context", () => {
  expect(safeReturnTo("/games/celeste")).toBe("/games/celeste");
  expect(safeReturnTo("/library?status=playing&libraryPage=2#games")).toBe(
    "/library?status=playing&libraryPage=2#games",
  );
  expect(authPageHref("/sign-up", "/games/celeste")).toBe(
    "/sign-up?returnTo=%2Fgames%2Fceleste",
  );
  expect(authPageHref("/onboarding", null)).toBe("/onboarding");
});

test.each([
  null,
  "",
  "https://evil.example/game",
  "http://localhost:3000/games/celeste",
  "//evil.example",
  "\\\\evil.example",
  "/\\evil.example",
  "javascript:alert(1)",
  "%2f%2fevil.example",
  "/%2fevil.example",
  "/%5cevil.example",
  "/%255cevil.example",
  "/%252fevil.example",
  "/\nevil.example",
  "/%0devil.example",
  "/%zz",
  "/sign-in",
  "/sign-up?returnTo=/games/celeste",
  "/onboarding",
  "/forgot-password",
  "/reset-password?token=secret",
  "/api/auth/sign-in",
  "/%73ign-in",
  "/games/../sign-in",
  "/games/%2e%2e/onboarding",
  "/sign-in/",
  "/SIGN-IN",
  "/api/account/export",
])("R10 falls back to Home for unsafe or auth-loop destination %j", (value) => {
  expect(safeReturnTo(value)).toBe("/");
  expect(authPageHref("/sign-in", value)).toBe("/sign-in");
});

test("R10 preserves encoded local searches and fragments without treating their values as destinations", () => {
  expect(
    safeReturnTo("/library?q=Moss%20Cartographer&progress=100%25#my%20games"),
  ).toBe("/library?q=Moss%20Cartographer&progress=100%25#my%20games");
});
