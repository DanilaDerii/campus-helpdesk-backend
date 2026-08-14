import type { RequestHandler } from "express";

/** Temporary endpoint handler used while the application is being built. */
export function notImplemented(operation: string): RequestHandler {
  return (_request, response) => {
    response.status(501).json({
      status: "not_implemented",
      operation,
    });
  };
}
