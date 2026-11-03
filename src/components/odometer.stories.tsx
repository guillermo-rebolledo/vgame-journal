import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { Odometer } from "./odometer";
import { Button } from "./ui/button";

async function expectAlignedDigits(canvasElement: HTMLElement) {
  await canvasElement.ownerDocument.fonts.ready;
  const odometers =
    canvasElement.querySelectorAll<HTMLElement>(".tabular-nums");
  await expect(odometers.length).toBeGreaterThan(0);
  for (const odometer of odometers) {
    await Promise.all(
      odometer
        .getAnimations({ subtree: true })
        .map((animation) => animation.finished),
    );
    const visual = odometer.querySelector<HTMLElement>("[aria-hidden]");
    if (!visual) throw new Error("Missing visual odometer");
    const values =
      odometer.querySelector(".sr-only")?.textContent?.match(/\d/g) ?? [];
    const clips = [...visual.children].filter((element) =>
      element.querySelector(".flex-col"),
    );
    await expect(clips).toHaveLength(values.length);
    for (const [index, clip] of clips.entries()) {
      let label = clip.nextElementSibling;
      while (label?.querySelector(".flex-col"))
        label = label.nextElementSibling;
      if (!label) continue;
      const glyph = clip.firstElementChild?.children[Number(values[index])];
      if (!glyph) throw new Error("Missing odometer digit");
      const range = canvasElement.ownerDocument.createRange();
      range.selectNodeContents(glyph);
      const digitTop = range.getBoundingClientRect().top;
      range.selectNodeContents(label);
      await expect(
        Math.abs(digitTop - range.getBoundingClientRect().top),
      ).toBeLessThanOrEqual(1);
    }
  }
}

const meta = {
  title: "Product/Odometer",
  component: Odometer,
  args: { text: "24 games" },
  play: async ({ canvasElement }) => expectAlignedDigits(canvasElement),
  parameters: {
    docs: {
      description: {
        component:
          "Rolling numeric text with a single accessible text value. Use for meaningful changing counts; reduced motion removes rolling transitions. Source: src/components/odometer.tsx.",
      },
    },
  },
} satisfies Meta<typeof Odometer>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Count: Story = {};
export const LargeCount: Story = { args: { text: "10000 games" } };
export const TypographySizes: Story = {
  render: () => (
    <div className="grid gap-4">
      {["text-sm", "text-lg", "text-3xl"].map((size) => (
        <p key={size} className={size}>
          <Odometer text="24 games" />
        </p>
      ))}
    </div>
  ),
};
export const ChangingCount: Story = {
  render: function Render() {
    const [count, setCount] = useState(24);
    return (
      <div className="flex items-center gap-4">
        <output>
          <Odometer text={`${count} games`} />
        </output>
        <Button variant="outline" onClick={() => setCount(count + 1)}>
          Add one game
        </Button>
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Add one game" }));
    await expect(canvas.getByRole("status")).toHaveTextContent("25 games");
    await expectAlignedDigits(canvasElement);
  },
};
