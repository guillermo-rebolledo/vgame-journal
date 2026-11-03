import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Skeleton } from "./skeleton";

const meta = {
  title: "UI/Skeleton",
  component: Skeleton,
  parameters: {
    docs: {
      description: {
        component:
          "Placeholder for content that is loading. Hide decorative shapes from assistive technology and provide one readable loading status. Use CollectionLoading for Library and Wishlist. Source: src/components/ui/skeleton.tsx.",
      },
    },
  },
  render: () => (
    <div className="max-w-sm space-y-4">
      <output className="text-sm text-muted-foreground">Loading games…</output>
      <div aria-hidden="true" className="flex gap-4">
        <Skeleton className="aspect-[264/374] w-20" />
        <div className="flex flex-1 flex-col gap-3">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
    </div>
  ),
} satisfies Meta<typeof Skeleton>;
export default meta;
type Story = StoryObj<typeof meta>;
export const LoadingGame: Story = {};
