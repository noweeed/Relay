import pino from "pino";
import { env } from "./env";

export const logger = pino({
  level: env.LOG_LEVEL,
  serializers: {
    req(request) {
      const serialized = pino.stdSerializers.req(request);
      if (typeof serialized.url === "string") {
        serialized.url = serialized.url.split("?", 1)[0] ?? serialized.url;
      }
      return serialized;
    },
  },
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "req.headers['set-cookie']",
      "req.headers['x-api-key']",
      "res.headers['set-cookie']",
      "body.password",
      "body.currentPassword",
      "body.newPassword",
      "password",
      "passwordHash",
      "accessToken",
      "refreshToken",
      "apiKey",
      "secretAccessKey",
      "signature",
    ],
    censor: "[REDACTED]"
  }
});
