import { describe, it, expect } from "vitest";
import { mapTimeRemaining } from "../src/map/time.js";

describe("mapTimeRemaining", () => {
  const now = new Date("2026-01-01T12:00:00.000Z");

  it("returns Expired for past dates", () => {
    expect(mapTimeRemaining("2026-01-01T11:00:00.000Z", now)).toBe("Expired");
  });

  it("formats minutes", () => {
    expect(mapTimeRemaining("2026-01-01T12:30:00.000Z", now)).toBe("30m left");
  });

  it("formats hours and minutes", () => {
    expect(mapTimeRemaining("2026-01-01T14:15:00.000Z", now)).toBe("2h 15m left");
  });
});
