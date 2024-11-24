import { zValidator } from "@hono/zod-validator";
import type { ZodSchema } from "zod";

export function GenerateValidatorFromSchema(schema: ZodSchema) {
 const validator =  zValidator("json", schema, (result, c) => {
    if (!result.success) {
      const errorMessages = result.error.errors.map((error) => ({
        field: error.path[0],
        message: error.message,
      }));
      return c.json({ messages: errorMessages }, 400);
    }
  });
  return validator
}
