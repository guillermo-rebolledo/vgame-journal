"use client";

import { catchError } from "next/error";
import { DiscoveryError } from "@/components/discovery-content";

/** Discovery is optional: render failures must leave the rest of the page usable. */
export const DiscoveryBoundary = catchError((_props, { retry }) => (
  <DiscoveryError retry={retry} />
));
