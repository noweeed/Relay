import { describe, expect, it } from "vitest";
import {
  hashToken,
  signAccessToken,
  signRefreshToken,
  tokenHashesMatch,
  verifyAccessToken,
  verifyRefreshToken
} from "../../src/utils/tokens";

describe("token utilities", () => {
  it("signs and verifies an access token for the intended user", () => {
    const token = signAccessToken("507f1f77bcf86cd799439011");
    const payload = verifyAccessToken(token);

    expect(payload.sub).toBe("507f1f77bcf86cd799439011");
    expect(payload.type).toBe("access");
  });

  it("creates unique refresh tokens for the same session", () => {
    const first = signRefreshToken("507f1f77bcf86cd799439011", "507f1f77bcf86cd799439012");
    const second = signRefreshToken("507f1f77bcf86cd799439011", "507f1f77bcf86cd799439012");

    expect(first).not.toBe(second);
    expect(verifyRefreshToken(first).sessionId).toBe("507f1f77bcf86cd799439012");
  });

  it("compares stored token hashes without storing the raw token", () => {
    const digest = hashToken("secret-refresh-token");

    expect(digest).not.toContain("secret-refresh-token");
    expect(tokenHashesMatch(digest, hashToken("secret-refresh-token"))).toBe(true);
    expect(tokenHashesMatch(digest, hashToken("different-token"))).toBe(false);
  });

  it("rejects an access token at the refresh-token boundary", () => {
    const accessToken = signAccessToken("507f1f77bcf86cd799439011");
    expect(() => verifyRefreshToken(accessToken)).toThrow();
  });
});
