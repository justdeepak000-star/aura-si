import { describe, it, expect } from "vitest";
import { localAnswer } from "./auraBrain";

describe("AURA local brain", () => {
  it("answers identity with creator Deepak", () => expect(localAnswer("who made you")).toContain("Deepak"));
  it("solves math locally", () => expect(localAnswer("125 * 45")).toBe("125 * 45 = 5625"));
  it("square root", () => expect(localAnswer("square root of 256")).toBe("√256 = 16"));
  it("passes complex questions to the model", () => expect(localAnswer("explain quantum computing in detail")).toBeNull());
});
