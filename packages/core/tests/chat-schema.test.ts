import { describe, it, expect } from "vitest";
import { CreateChatInput, JoinChatInput, PostChatMessageInput } from "../src/chat/schemas.js";

describe("CreateChatInput", () => {
  it("accepts a valid room", () => {
    const parsed = CreateChatInput.parse({
      ttlSeconds: 3600,
      maxMembers: 10,
      pin: "123456",
      displayName: "anon",
    });
    expect(parsed.maxMembers).toBe(10);
  });

  it("rejects a non-digit PIN", () => {
    expect(() =>
      CreateChatInput.parse({ ttlSeconds: 3600, maxMembers: 5, pin: "12ab" }),
    ).toThrow();
  });
});

describe("JoinChatInput", () => {
  it("requires a display name", () => {
    expect(() => JoinChatInput.parse({ displayName: "" })).toThrow();
    expect(JoinChatInput.parse({ displayName: "  nico  " }).displayName).toBe("nico");
  });
});

describe("PostChatMessageInput", () => {
  it("requires ciphertext and nonce", () => {
    expect(() => PostChatMessageInput.parse({ ciphertext: "", nonce: "n" })).toThrow();
    expect(PostChatMessageInput.parse({ ciphertext: "abc", nonce: "n" }).ciphertext).toBe("abc");
  });
});
