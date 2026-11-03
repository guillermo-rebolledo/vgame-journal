// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { AccountMenu } from "./account-menu";

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
let pathname = "/";
let params = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => pathname,
  useSearchParams: () => params,
}));
const theme = vi.hoisted(() => ({ theme: "light", setTheme: vi.fn() }));
vi.mock("next-themes", () => ({ useTheme: () => theme }));
const signOut = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("@/lib/auth-client", () => ({ authClient: { signOut } }));

afterEach(() => {
  cleanup();
  pathname = "/";
  params = new URLSearchParams();
});

const user = { username: "mario", name: "Mario", image: null };

test("signed-in trigger names the account and opens the menu in order", async () => {
  render(<AccountMenu user={user} />);
  await userEvent.click(
    screen.getByRole("button", { name: "Account menu, @mario" }),
  );

  const menu = await screen.findByRole("menu");
  expect(menu.textContent).toMatch(
    /Signed in as @mario.*My profile.*Settings.*Theme.*Sign out/,
  );
  expect(
    screen.getByRole("menuitem", { name: "My profile" }).getAttribute("href"),
  ).toBe("/u/mario");
  expect(
    screen.getByRole("menuitem", { name: "Settings" }).getAttribute("href"),
  ).toBe("/settings");
});

test("falls back to the uppercase initial without a profile picture", () => {
  render(<AccountMenu user={user} />);
  expect(
    screen.getByRole("button", { name: "Account menu, @mario" }).textContent,
  ).toBe("M");
});

test("Theme sub-menu checks the current theme and switches on select", async () => {
  render(<AccountMenu user={user} />);
  await userEvent.click(screen.getByRole("button", { name: /Account menu/ }));
  await userEvent.click(await screen.findByRole("menuitem", { name: "Theme" }));

  const light = await screen.findByRole("menuitemradio", { name: "Light" });
  expect(light.getAttribute("aria-checked")).toBe("true");
  await userEvent.click(screen.getByRole("menuitemradio", { name: "Dark" }));
  expect(theme.setTheme).toHaveBeenCalledWith("dark", expect.anything());
});

test.each([
  "{Enter}",
  " ",
])("%s opens the menu and Escape returns focus to the trigger", async (key) => {
  render(<AccountMenu user={user} />);
  const button = screen.getByRole("button", { name: /Account menu/ });
  button.focus();
  await userEvent.keyboard(key);
  expect(await screen.findByRole("menu")).toBeTruthy();
  expect(button.getAttribute("aria-expanded")).toBe("true");

  await userEvent.keyboard("{Escape}");
  await vi.waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  expect(document.activeElement).toBe(button);
});

test("Sign out signs out and navigates home", async () => {
  render(<AccountMenu user={user} />);
  await userEvent.click(screen.getByRole("button", { name: /Account menu/ }));
  await userEvent.click(
    await screen.findByRole("menuitem", { name: "Sign out" }),
  );
  expect(signOut).toHaveBeenCalled();
  expect(router.push).toHaveBeenCalledWith("/");
  expect(router.refresh).toHaveBeenCalled();
});

test("guests see a Sign in link and a menu with only Theme and Sign in", async () => {
  render(<AccountMenu user={null} />);
  expect(
    screen.getByRole("link", { name: "Sign in" }).getAttribute("href"),
  ).toBe("/sign-in");

  await userEvent.click(screen.getByRole("button", { name: "Menu" }));
  await screen.findByRole("menu");
  expect(
    screen.getAllByRole("menuitem").map((item) => item.textContent),
  ).toEqual(["Theme", "Sign in"]);
});

test("both guest header sign-in entries retain current Home browsing after URL updates", async () => {
  const user = userEvent.setup();
  pathname = "/";
  params = new URLSearchParams("q=Home&year=2027&platform=PC&all=1&filters=1");
  const { rerender } = render(<AccountMenu user={null} />);
  const destination = (element: HTMLElement) =>
    new URL(
      element.getAttribute("href") ?? "",
      "http://localhost",
    ).searchParams.get("returnTo");
  expect(destination(screen.getByRole("link", { name: "Sign in" }))).toBe(
    "/?q=Home&year=2027&platform=PC&all=1&filters=1",
  );
  await user.click(screen.getByRole("button", { name: "Menu" }));
  expect(
    destination(await screen.findByRole("menuitem", { name: "Sign in" })),
  ).toBe("/?q=Home&year=2027&platform=PC&all=1&filters=1");
  await user.keyboard("{Escape}");
  params = new URLSearchParams("q=Celeste&filters=1");
  rerender(<AccountMenu user={null} />);
  expect(destination(screen.getByRole("link", { name: "Sign in" }))).toBe(
    "/?q=Celeste&filters=1",
  );
});

test.each([
  "/",
  "/games/celeste",
  "/sign-up",
])("guest header keeps ordinary sign-in bare on %s without Home context", async (path) => {
  const user = userEvent.setup();
  pathname = path;
  params = new URLSearchParams(
    path === "/" ? "" : "q=Home&returnTo=https://evil.example",
  );
  render(<AccountMenu user={null} />);
  expect(
    screen.getByRole("link", { name: "Sign in" }).getAttribute("href"),
  ).toBe("/sign-in");
  await user.click(screen.getByRole("button", { name: "Menu" }));
  expect(
    (await screen.findByRole("menuitem", { name: "Sign in" })).getAttribute(
      "href",
    ),
  ).toBe("/sign-in");
});
