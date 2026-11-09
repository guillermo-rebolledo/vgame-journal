import type { Instrumentation } from "next";
import {
  operationalCode,
  reportOperationalError,
} from "@/lib/operational-errors";

export const onRequestError: Instrumentation.onRequestError = (
  error,
  _request,
  context,
) => {
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
