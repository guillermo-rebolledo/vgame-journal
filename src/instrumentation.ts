import type { Instrumentation } from "next";
import { ExpectedError } from "@/lib/expected-error";
import {
  operationalCode,
  reportOperationalError,
} from "@/lib/operational-errors";

export const onRequestError: Instrumentation.onRequestError = (
  error,
  _request,
  context,
) => {
  if (error instanceof ExpectedError) return;
  const operation =
    context.routeType === "render"
      ? "server.render"
      : context.routeType === "action"
        ? "server.action"
        : context.routeType === "proxy"
          ? "server.proxy"
          : "server.route";
  reportOperationalError(operation, operationalCode(error));
};
