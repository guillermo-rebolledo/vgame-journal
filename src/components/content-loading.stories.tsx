import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import { CollectionLoading } from "./collection-loading";
import {
  HeaderLoading,
  HomeCollectionsLoading,
  HomeLoading,
  ListLoading,
  ListsLoading,
  ProfileLoading,
  SettingLoading,
  StatsLoading,
} from "./content-loading";

const meta = {
  title: "Product/Loading content",
  component: HomeLoading,
  subcomponents: {
    HeaderLoading,
    HomeCollectionsLoading,
    ListLoading,
    ListsLoading,
    ProfileLoading,
    SettingLoading,
    StatsLoading,
    CollectionLoading,
  },
  parameters: {
    docs: {
      description: {
        component:
          "Static skeleton compositions for the first content read on Home, lists, profiles, Stats, Settings and account navigation. Reuses UI/Skeleton and the compact cover-row pattern from CollectionLoading. Each composition has one readable output and hides decorative shapes; placeholders have no focusable actions or invented data. Keep existing content during refreshes and use the Compass spinner for search, retry and mutation feedback. The catalog stays local/CI-only.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="w-full max-w-5xl">
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getAllByRole("status")).toHaveLength(1);
    await expect(
      canvasElement.querySelector('[data-slot="skeleton"]'),
    ).toBeVisible();
    await expect(canvasElement.querySelector("button, a, input")).toBeNull();
  },
} satisfies Meta<typeof HomeLoading>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Home: Story = {};
export const PersonalShelves: Story = {
  render: () => <HomeCollectionsLoading />,
};
export const Lists: Story = { render: () => <ListsLoading /> };
export const OwnedList: Story = { render: () => <ListLoading /> };
export const PublicList: Story = {
  render: () => <ListLoading label="Loading list…" />,
};
export const Profile: Story = { render: () => <ProfileLoading /> };
export const Stats: Story = { render: () => <StatsLoading /> };
export const Setting: Story = {
  render: () => <SettingLoading label="Loading release region…" />,
};
export const Header: Story = { render: () => <HeaderLoading /> };
export const LightTheme: Story = { ...Lists, globals: { theme: "light" } };
export const NarrowProfile: Story = {
  render: () => (
    <div className="w-full max-w-64">
      <ProfileLoading />
    </div>
  ),
};
