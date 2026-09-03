"""LangGraph workflow for turning a meeting payload into review candidates."""

import asyncio
from typing import NotRequired, TypedDict

from langgraph.graph import END, START, StateGraph
from langgraph.graph.state import CompiledStateGraph

from relay_ai.providers.task_extractor import TaskExtractor
from relay_ai.schemas.meetings import (
    ExtractedTask,
    MeetingExtractionResult,
    MeetingProcessPayload,
    TranscriptSegmentInput,
)
from relay_ai.services.task_reconciler import reconcile_task_batches
from relay_ai.services.transcript_chunker import (
    DEFAULT_TRANSCRIPT_CHUNK_MAX_CHARS,
    DEFAULT_TRANSCRIPT_CHUNK_OVERLAP_SEGMENTS,
    chunk_transcript,
)
from relay_ai.services.transcript_normalizer import normalize_transcript


class MeetingGraphState(TypedDict):
    """Explicit state passed between the meeting workflow's focused nodes."""

    payload: MeetingProcessPayload
    normalized_segments: NotRequired[list[TranscriptSegmentInput]]
    transcript_chunks: NotRequired[list[list[TranscriptSegmentInput]]]
    extracted_task_batches: NotRequired[list[list[ExtractedTask]]]
    extracted_tasks: NotRequired[list[ExtractedTask]]
    result: NotRequired[MeetingExtractionResult]


MeetingGraph = CompiledStateGraph[
    MeetingGraphState,
    None,
    MeetingGraphState,
    MeetingGraphState,
]


def build_meeting_graph(
    extractor: TaskExtractor,
    *,
    chunk_max_chars: int = DEFAULT_TRANSCRIPT_CHUNK_MAX_CHARS,
    chunk_overlap_segments: int = DEFAULT_TRANSCRIPT_CHUNK_OVERLAP_SEGMENTS,
    chunk_concurrency: int = 3,
) -> MeetingGraph:
    """Compile the v0.5 normalize → chunk → extract → reconcile workflow."""
    if chunk_concurrency < 1:
        raise ValueError("chunk_concurrency must be greater than zero")
    graph = StateGraph(MeetingGraphState)

    def normalize_node(state: MeetingGraphState) -> dict[str, object]:
        """Clean and order transcript text without changing traceability identifiers."""
        return {"normalized_segments": normalize_transcript(state["payload"])}

    def chunk_node(state: MeetingGraphState) -> dict[str, object]:
        """Bound provider context while retaining ordered segment evidence."""
        segments = state.get("normalized_segments")
        if segments is None:
            raise ValueError("normalized transcript is missing from graph state")
        return {
            "transcript_chunks": chunk_transcript(
                segments,
                max_chars=chunk_max_chars,
                overlap_segments=chunk_overlap_segments,
            )
        }

    async def extract_node(state: MeetingGraphState) -> dict[str, object]:
        """Extract each chunk concurrently through the provider-neutral protocol."""
        chunks = state.get("transcript_chunks")
        if chunks is None:
            raise ValueError("transcript chunks are missing from graph state")
        semaphore = asyncio.Semaphore(chunk_concurrency)

        async def extract_chunk(
            chunk: list[TranscriptSegmentInput],
        ) -> list[ExtractedTask]:
            async with semaphore:
                return await extractor.extract_tasks(state["payload"], chunk)

        batches = await asyncio.gather(*(extract_chunk(chunk) for chunk in chunks))
        return {"extracted_task_batches": list(batches)}

    def reconcile_node(state: MeetingGraphState) -> dict[str, object]:
        """Collapse repeated overlap results before evidence validation and persistence."""
        batches = state.get("extracted_task_batches")
        if batches is None:
            raise ValueError("extracted task batches are missing from graph state")
        return {"extracted_tasks": reconcile_task_batches(batches)}

    def prepare_result_node(state: MeetingGraphState) -> dict[str, object]:
        """Validate candidate evidence references and build the versioned result payload."""
        segments = state.get("normalized_segments")
        tasks = state.get("extracted_tasks")
        if segments is None or tasks is None:
            raise ValueError("meeting graph cannot prepare an incomplete result")

        segments_by_order = {segment.order: segment for segment in segments}
        invalid_orders = sorted(
            {task.segment_order for task in tasks if task.segment_order not in segments_by_order}
        )
        if invalid_orders:
            raise ValueError(f"extracted tasks reference unknown segment orders: {invalid_orders}")

        invented_quotes = [
            task.segment_order
            for task in tasks
            if task.source_quote not in segments_by_order[task.segment_order].text
        ]
        if invented_quotes:
            raise ValueError(
                f"extracted tasks contain non-verbatim source quotes at orders: {invented_quotes}"
            )

        result = MeetingExtractionResult(meetingId=state["payload"].meeting_id, tasks=tasks)
        return {"result": result}

    graph.add_node("normalize_transcript", normalize_node)
    graph.add_node("chunk_transcript", chunk_node)
    graph.add_node("extract_task_candidates", extract_node)
    graph.add_node("reconcile_task_candidates", reconcile_node)
    graph.add_node("prepare_review_result", prepare_result_node)
    graph.add_edge(START, "normalize_transcript")
    graph.add_edge("normalize_transcript", "chunk_transcript")
    graph.add_edge("chunk_transcript", "extract_task_candidates")
    graph.add_edge("extract_task_candidates", "reconcile_task_candidates")
    graph.add_edge("reconcile_task_candidates", "prepare_review_result")
    graph.add_edge("prepare_review_result", END)
    return graph.compile()


async def run_meeting_graph(
    payload: MeetingProcessPayload,
    extractor: TaskExtractor,
    *,
    chunk_max_chars: int = DEFAULT_TRANSCRIPT_CHUNK_MAX_CHARS,
    chunk_overlap_segments: int = DEFAULT_TRANSCRIPT_CHUNK_OVERLAP_SEGMENTS,
    chunk_concurrency: int = 3,
) -> MeetingExtractionResult:
    """Run one meeting through the graph and return its validated review result."""
    graph = build_meeting_graph(
        extractor,
        chunk_max_chars=chunk_max_chars,
        chunk_overlap_segments=chunk_overlap_segments,
        chunk_concurrency=chunk_concurrency,
    )
    final_state = await graph.ainvoke({"payload": payload})
    result = final_state.get("result")
    if result is None:
        raise RuntimeError("meeting graph completed without a result")
    return result
