import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./nativeAuth";

describe("native account passwords", () => {
  it("stores passwords as salted scrypt hashes and validates only the matching password", async () => {
    const hash = await hashPassword("correct-horse-battery-staple");
    expect(hash).toMatch(/^scrypt\$[0-9a-f]+\$[0-9a-f]+$/);
    await expect(verifyPassword("correct-horse-battery-staple", hash)).resolves.toBe(true);
    await expect(verifyPassword("wrong-password", hash)).resolves.toBe(false);
  });
});
