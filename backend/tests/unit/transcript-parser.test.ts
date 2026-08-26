import { describe, expect, it } from "vitest";
import {
  parseTranscript,
  type ParsedSegment
} from "../../src/utils/transcript-parser";

describe("parseTranscript", () => {
  it("parses Speaker: text format", () => {
    const input = [
      "Naveed: I'll handle the auth refactor",
      "Sarah: I'll review the PR once it's up",
      "Naveed: Let's aim for Friday"
    ].join("\n");

    const result = parseTranscript(input);
    expect(result).toEqual<ParsedSegment[]>([
      { speaker: "Naveed", text: "I'll handle the auth refactor" },
      { speaker: "Sarah", text: "I'll review the PR once it's up" },
      { speaker: "Naveed", text: "Let's aim for Friday" }
    ]);
  });

  it("parses [Speaker] text format", () => {
    const input = [
      "[John] Let's talk about the roadmap",
      "[Sarah] Sure, what about the deadline?",
      "[John] We need to ship by Friday"
    ].join("\n");

    const result = parseTranscript(input);
    expect(result).toEqual<ParsedSegment[]>([
      { speaker: "John", text: "Let's talk about the roadmap" },
      { speaker: "Sarah", text: "Sure, what about the deadline?" },
      { speaker: "John", text: "We need to ship by Friday" }
    ]);
  });

  it("parses Speaker (HH:MM): text format", () => {
    const input = [
      "Naveed (14:30): Let's start the standup",
      "Sarah (14:31): I finished the auth work"
    ].join("\n");

    const result = parseTranscript(input);
    expect(result).toEqual<ParsedSegment[]>([
      { speaker: "Naveed", text: "Let's start the standup" },
      { speaker: "Sarah", text: "I finished the auth work" }
    ]);
  });

  it("falls back to speakerless segments for plain text", () => {
    const input = [
      "We need to fix the bug in production",
      "The deadline is next Friday",
      "Someone should look into the memory leak"
    ].join("\n");

    const result = parseTranscript(input);
    expect(result).toEqual<ParsedSegment[]>([
      { text: "We need to fix the bug in production" },
      { text: "The deadline is next Friday" },
      { text: "Someone should look into the memory leak" }
    ]);
  });

  it("skips empty lines", () => {
    const input = [
      "Naveed: First point",
      "",
      "   ",
      "Naveed: Second point"
    ].join("\n");

    const result = parseTranscript(input);
    expect(result).toEqual<ParsedSegment[]>([
      { speaker: "Naveed", text: "First point Second point" }
    ]);
  });

  it("merges consecutive same-speaker lines", () => {
    const input = [
      "Sarah: I have a couple of points",
      "Sarah: First, we need more tests",
      "Sarah: Second, the deploy script is broken",
      "Naveed: Got it, I'll look into both"
    ].join("\n");

    const result = parseTranscript(input);
    expect(result).toHaveLength(2);
    expect(result[0]!.speaker).toBe("Sarah");
    expect(result[0]!.text).toContain("First, we need more tests");
    expect(result[0]!.text).toContain("Second, the deploy script is broken");
    expect(result[1]!.speaker).toBe("Naveed");
  });

  it("returns empty array for empty input", () => {
    expect(parseTranscript("")).toEqual([]);
    expect(parseTranscript("   \n\n  ")).toEqual([]);
  });

  it("handles a single line", () => {
    const result = parseTranscript("Naveed: Just one point");
    expect(result).toEqual<ParsedSegment[]>([
      { speaker: "Naveed", text: "Just one point" }
    ]);
  });

  it("treats input as plain text when less than half of lines have speaker labels", () => {
    const input = [
      "Naveed: Here is the agenda",
      "We should review the timeline",
      "Let's check the budget too",
      "Also think about staffing"
    ].join("\n");

    const result = parseTranscript(input);
    // Only 1 out of 4 lines has a label → plain text mode
    expect(result.every((segment) => segment.speaker === undefined)).toBe(true);
  });
});
