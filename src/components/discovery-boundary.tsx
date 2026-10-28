"use client";

import { catchError } from "next/error";

/** Discovery is optional: render failures must leave the rest of Home usable. */
export const DiscoveryBoundary = catchError(() => null);
