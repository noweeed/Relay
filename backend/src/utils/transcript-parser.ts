export interface ParsedSegment {
  speaker?: string;
  text: string;
}

/**
 * Attempts to extract a speaker label from the beginning of a line.
 *
 * Supported formats:
 * - `Speaker: text`
 * - `[Speaker] text`
 * - `Speaker (HH:MM): text`
 * - `Speaker (HH:MM:SS): text`
 *
 * Returns `undefined` when no recognized speaker prefix is found.
 */
function extractSpeaker(line: string): { speaker: string; text: string } | undefined {
  // Pattern: [Speaker] text
  const bracketMatch = line.match(/^\[([^\]]{1,80})\]\s*(.+)$/);
  if (bracketMatch) {
    return { speaker: bracketMatch[1]!.trim(), text: bracketMatch[2]!.trim() };
  }

  // Pattern: Speaker (HH:MM) : text  or  Speaker (HH:MM:SS): text
  const timestampMatch = line.match(
    /^([A-Za-z][A-Za-z0-9 .'_-]{0,78})\s*\(\d{1,2}:\d{2}(?::\d{2})?\)\s*:\s*(.+)$/
  );
  if (timestampMatch) {
    return { speaker: timestampMatch[1]!.trim(), text: timestampMatch[2]!.trim() };
  }

  // Pattern: Speaker: text  (speaker must start with a letter and contain no more than ~80 chars)
  const colonMatch = line.match(/^([A-Za-z][A-Za-z0-9 .'_-]{0,78})\s*:\s*(.+)$/);
  if (colonMatch) {
    return { speaker: colonMatch[1]!.trim(), text: colonMatch[2]!.trim() };
  }

  return undefined;
}

/**
 * Determines whether the majority of non-empty lines carry a speaker label.
 * When less than half of the lines carry a label the input is treated as
 * plain/unstructured text and no speaker detection is attempted.
 */
function hasSpeakerLabels(lines: string[]): boolean {
  if (lines.length === 0) return false;
  let labeled = 0;
  for (const line of lines) {
    if (extractSpeaker(line)) labeled++;
  }
  return labeled >= lines.length / 2;
}

/**
 * Parses raw transcript text into ordered segments with optional speaker labels.
 *
 * Consecutive lines from the same speaker are merged into a single segment.
 * Empty lines are skipped. When fewer than half of the lines carry a recognized
 * speaker label, every segment receives `speaker: undefined`.
 */
export function parseTranscript(rawInput: string): ParsedSegment[] {
  const lines = rawInput
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) return [];

  const useSpeakers = hasSpeakerLabels(lines);
  const segments: ParsedSegment[] = [];

  for (const line of lines) {
    const parsed = useSpeakers ? extractSpeaker(line) : undefined;
    const speaker = parsed?.speaker;
    const text = parsed?.text ?? line;

    // Merge consecutive lines from the same speaker.
    const previous = segments[segments.length - 1];
    if (previous && previous.speaker === speaker && speaker !== undefined) {
      previous.text += " " + text;
    } else {
      segments.push(speaker ? { speaker, text } : { text });
    }
  }

  return segments;
}
