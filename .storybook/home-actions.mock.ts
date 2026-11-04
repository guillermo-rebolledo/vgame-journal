import { fn } from "storybook/test";
import type * as actions from "../src/app/home-actions";

export const homeIntentGame = fn<typeof actions.homeIntentGame>();
export const readHomeJournal = fn<typeof actions.readHomeJournal>();
export const saveHomeStatus = fn<typeof actions.saveHomeStatus>();
