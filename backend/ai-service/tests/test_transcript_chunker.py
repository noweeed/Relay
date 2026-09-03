from relay_ai.schemas.meetings import TranscriptSegmentInput
from relay_ai.services.transcript_chunker import chunk_transcript


def segment(order: int, text: str) -> TranscriptSegmentInput:
    return TranscriptSegmentInput(
        segmentId=f"segment-{order}",
        order=order,
        speaker="Naveed",
        text=text,
    )


def test_chunks_whole_segments_with_contextual_overlap() -> None:
    segments = [segment(order, "x" * 35) for order in range(3)]

    chunks = chunk_transcript(segments, max_chars=80, overlap_segments=1)

    assert [[item.order for item in chunk] for chunk in chunks] == [[0, 1], [1, 2]]


def test_splits_one_oversized_segment_without_losing_traceability() -> None:
    source = segment(7, "alpha beta gamma delta epsilon")

    chunks = chunk_transcript([source], max_chars=12, overlap_segments=1)

    fragments = [item for chunk in chunks for item in chunk]
    assert len(fragments) == 3
    assert all(item.segment_id == "segment-7" and item.order == 7 for item in fragments)
    assert all(item.text in source.text for item in fragments)
    assert all(len(item.text) <= 12 for item in fragments)
