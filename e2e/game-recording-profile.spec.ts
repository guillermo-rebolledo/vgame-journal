import { writeFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { signUp } from "./support/sign-up";

test.use({ video: "on" });
test("record production cold navigation and drawer separately at 4x CPU", async ({
  page,
  request,
}, testInfo) => {
  await signUp(page, request, `profile_record_${Date.now()}`);
  await page.getByRole("searchbox").fill("Celeste");
  await expect(page.getByRole("link", { name: /Celeste/ })).toBeVisible();
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await page.evaluate(() => {
    const samples: {
      phase: string;
      type: string;
      value: number;
      recentInput?: boolean;
    }[] = [];
    let phase = "idle";
    let previous = 0;
    let active = false;
    let generation = 0;
    function frame(time: number, run: number) {
      if (!active || run !== generation) return;
      if (previous)
        samples.push({ phase, type: "frame-gap", value: time - previous });
      previous = time;
      requestAnimationFrame((time) => frame(time, run));
    }
    for (const type of ["longtask", "layout-shift"]) {
      new PerformanceObserver((list) => {
        if (!active) return;
        for (const entry of list.getEntries()) {
          const shift = entry as PerformanceEntry & {
            value: number;
            hadRecentInput: boolean;
          };
          samples.push({
            phase,
            type,
            value: type === "longtask" ? entry.duration : shift.value,
            recentInput: shift.hadRecentInput,
          });
        }
      }).observe({ type });
    }
    Object.assign(window, {
      recordingProfile: {
        start(name: string) {
          phase = name;
          previous = 0;
          active = true;
          const run = ++generation;
          requestAnimationFrame((time) => frame(time, run));
        },
        stop() {
          active = false;
          return samples;
        },
      },
    });
  });
  const profile = async (command: "start" | "stop", name = "") =>
    page.evaluate(
      ({ command, name }) => {
        const recorder = (
          window as unknown as {
            recordingProfile: {
              start: (name: string) => void;
              stop: () => unknown;
            };
          }
        ).recordingProfile;
        return command === "start" ? recorder.start(name) : recorder.stop();
      },
      { command, name },
    );
  const settle = () =>
    page.evaluate(async () => {
      await Promise.allSettled(
        document
          .getAnimations()
          .filter((animation) => {
            const timing = animation.effect?.getTiming();
            return timing?.iterations !== Infinity;
          })
          .map((animation) => animation.finished),
      );
    });
  await profile("start", "cold-navigation");
  await page.getByRole("link", { name: /Celeste/ }).click();
  await expect(
    page.getByRole("button", { name: "Add playthrough", exact: true }),
  ).toBeVisible();
  await settle();
  await profile("stop");
  await profile("start", "drawer");
  await page
    .getByRole("button", { name: "Add playthrough", exact: true })
    .click();
  await expect(page.getByLabel("Started", { exact: true })).toBeVisible();
  await settle();
  const samples = await profile("stop");
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  const path = testInfo.outputPath("production-profile.json");
  await writeFile(path, JSON.stringify(samples, null, 2));
  await testInfo.attach("Production profile", {
    path,
    contentType: "application/json",
  });
});
