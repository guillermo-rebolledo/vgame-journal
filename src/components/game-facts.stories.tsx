import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { AgeRatingFact, LanguagesFact } from "./game-facts";

const meta = {
  title: "Product/Game facts",
  component: LanguagesFact,
  subcomponents: { AgeRatingFact },
  args: {
    languages: Array.from({ length: 28 }, (_, index) => ({
      name: index === 0 ? "English" : `Language ${index + 1}`,
      voices: index === 0,
      subtitles: true,
      interface: true,
    })),
  },
  render: (args) => (
    <dl className="grid max-w-xl grid-cols-2 gap-3">
      <AgeRatingFact
        headline={{
          board: "ESRB",
          rating: "T",
          descriptors: ["Fantasy Violence"],
        }}
        others={[]}
      />
      <LanguagesFact {...args} />
    </dl>
  ),
  parameters: {
    docs: {
      description: {
        component:
          "Game-fact details reuse HoverCard with keyboard, hover, and touch access. Languages owns its contained scroll area. Floating boundaries survive forced colors; reduced motion retains an opacity transition.",
      },
    },
  },
} satisfies Meta<typeof LanguagesFact>;
export default meta;
type Story = StoryObj<typeof meta>;
export const LongLanguages: Story = {
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole("button", {
      name: /^Languages:/,
    });
    trigger.focus();
    const body = within(canvasElement.ownerDocument.body);
    const table = await body.findByRole("table");
    await waitFor(() => expect(table).toBeVisible());
    await userEvent.keyboard("{Escape}");
    await waitFor(() =>
      expect(body.queryByRole("table")).not.toBeInTheDocument(),
    );
  },
};
export const LightTheme: Story = { globals: { theme: "light" } };
