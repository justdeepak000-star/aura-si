import { describe, it, expect } from "vitest";
import { isTeluguOrTanglish } from "./teluguDetect";

describe("isTeluguOrTanglish", () => {
  it("detects Telugu script", () => expect(isTeluguOrTanglish("ఎలా ఉన్నావ్?")).toBe(true));
  it("detects Tanglish", () => expect(isTeluguOrTanglish("Ela unnav bro? joke cheppu")).toBe(true));
  it("keeps English on the GPU brain", () =>
    expect(isTeluguOrTanglish("Write a Python function to reverse a string")).toBe(false));
});
