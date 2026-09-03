"""Deterministic, traceability-safe chunking for long meeting transcripts."""

from collections.abc import Sequence

from relay_ai.schemas.meetings import TranscriptSegmentInput

DEFAULT_TRANSCRIPT_CHUNK_MAX_CHARS = 12_000
DEFAULT_TRANSCRIPT_CHUNK_OVERLAP_SEGMENTS = 1


def _split_oversized_segment(
    segment: TranscriptSegmentInput,
    max_chars: int,
) -> list[TranscriptSegmentInput]:
    """Split one oversized segment at whitespace while retaining its source identity."""
    text = segment.text
    fragments: list[TranscriptSegmentInput] = []
    cursor = 0

    while len(text) - cursor > max_chars:
        boundary = text.rfind(" ", cursor, cursor + max_chars + 1)
        if boundary <= cursor:
            boundary = cursor + max_chars
        fragment = text[cursor:boundary].strip()
        if fragment:
            fragments.append(segment.model_copy(update={"text": fragment}))
        cursor = boundary
        while cursor < len(text) and text[cursor].isspace():
            cursor += 1

    remainder = text[cursor:].strip()
    if remainder:
        fragments.append(segment.model_copy(update={"text": remainder}))
    return fragments


def _segment_size(segment: TranscriptSegmentInput) -> int:
    """Measure normalized transcript text independently of provider tokenization."""
    return len(segment.text)


def chunk_transcript(
    segments: Sequence[TranscriptSegmentInput],
    *,
    max_chars: int = DEFAULT_TRANSCRIPT_CHUNK_MAX_CHARS,
    overlap_segments: int = DEFAULT_TRANSCRIPT_CHUNK_OVERLAP_SEGMENTS,
) -> list[list[TranscriptSegmentInput]]:
    """Group ordered segments into bounded chunks with small contextual overlap.

    Whole transcript segments are kept together whenever possible. An individual segment
    larger than the budget is split at a whitespace boundary, but every fragment retains
    the original segment ID and order so extracted evidence still resolves in Node.
    """
    if max_chars < 1:
        raise ValueError("max_chars must be greater than zero")
    if overlap_segments < 0:
        raise ValueError("overlap_segments cannot be negative")
    if not segments:
        raise ValueError("cannot chunk an empty transcript")

    pieces = [
        piece
        for segment in segments
        for piece in _split_oversized_segment(segment, max_chars)
    ]
    chunks: list[list[TranscriptSegmentInput]] = []
    current: list[TranscriptSegmentInput] = []
    current_size = 0

    for piece in pieces:
        piece_size = _segment_size(piece)
        if current and current_size + piece_size > max_chars:
            chunks.append(current)
            overlap: list[TranscriptSegmentInput] = []
            overlap_size = 0
            for candidate in reversed(current):
                if len(overlap) >= overlap_segments:
                    break
                if candidate.order == piece.order:
                    continue
                candidate_size = _segment_size(candidate)
                if overlap_size + candidate_size + piece_size > max_chars:
                    break
                overlap.insert(0, candidate)
                overlap_size += candidate_size
            current = overlap
            current_size = overlap_size

        current.append(piece)
        current_size += piece_size

    if current:
        chunks.append(current)
    return chunks
