import { fn } from "storybook/test";
import type * as actions from "../src/app/lists/actions";

// Catalog-only boundary: list picker examples must never load server persistence.
export const readOwnerLists = fn<typeof actions.readOwnerLists>();
export const readOwnerList = fn<typeof actions.readOwnerList>();
export const createOwnerList = fn<typeof actions.createOwnerList>();
export const editOwnerList = fn<typeof actions.editOwnerList>();
export const changeOwnerList = fn<typeof actions.changeOwnerList>();
