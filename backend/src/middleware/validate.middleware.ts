import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { ZodType } from "zod";

interface RequestSchemas {
  body?: ZodType;
  params?: ZodType;
  query?: ZodType;
}

/**
 * Validates selected request sections and replaces them with normalized Zod output.
 * Keeping this at the route boundary means services receive trusted shapes.
 */
export function validateRequest(schemas: RequestSchemas): RequestHandler {
  return (request: Request, _response: Response, next: NextFunction): void => {
    try {
      if (schemas.body) request.body = schemas.body.parse(request.body);
      if (schemas.params) Object.assign(request.params, schemas.params.parse(request.params));
      if (schemas.query) Object.assign(request.query, schemas.query.parse(request.query));
      next();
    } catch (error: unknown) {
      next(error);
    }
  };
}
