"""LangGraph workflow for turning a meeting payload into review candidates."""

import asyncio
import logging
import re
from typing import NotRequired, TypedDict

from langgraph.graph import END, START, StateGraph
from langgraph.graph.state import CompiledStateGraph

from relay_ai.providers.duplicate_verifier import DuplicateVerifier
from relay_ai.providers.embedding import EmbeddingProvider
from relay_ai.providers.similarity_search import TaskSimilaritySearch
from relay_ai.providers.task_extractor import TaskExtractor
from relay_ai.schemas.meetings import (
    DuplicateProposal,
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

logger = logging.getLogger(__name__)
_GENERIC_TASK_TERMS = {
    "a",
    "an",
    "and",
    "for",
    "in",
    "of",
    "on",
    "the",
    "to",
    "up",
    "add",
    "build",
    "complete",
    "configure",
    "create",
    "finish",
    "implement",
    "make",
    "setup",
    "set",
    "update",
}
_ACTION_FAMILIES = {
    "add": "create",
    "build": "create",
    "create": "create",
    "implement": "create",
    "configure": "setup",
    "set": "setup",
    "setup": "setup",
    "complete": "finish",
    "finish": "finish",
    "update": "update",
}


def _title_tokens(title: str) -> list[str]:
    return re.findall(r"[a-z0-9]+", title.casefold())


def _important_terms(title: str) -> set[str]:
    return {
        token
        for token in _title_tokens(title)
        if len(token) >= 3 and token not in _GENERIC_TASK_TERMS
    }


def _action_family(title: str) -> str | None:
    tokens = _title_tokens(title)
    if len(tokens) >= 2 and tokens[:2] == ["set", "up"]:
        return "setup"
    return next((_ACTION_FAMILIES[token] for token in tokens if token in _ACTION_FAMILIES), None)


def _has_obvious_entity_conflict(candidate: ExtractedTask, match_title: str) -> bool:
    """Reject same-template titles whose important named subjects do not overlap."""
    candidate_terms = _important_terms(candidate.title)
    match_terms = _important_terms(match_title)
    return bool(
        candidate_terms
        and match_terms
        and candidate_terms.isdisjoint(match_terms)
        and _action_family(candidate.title) == _action_family(match_title)
    )


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
    project_id: str | None = None,
    embedding_provider: EmbeddingProvider | None = None,
    similarity_search: TaskSimilaritySearch | None = None,
    duplicate_verifier: DuplicateVerifier | None = None,
    duplicate_medium_threshold: float = 0.80,
    duplicate_high_threshold: float = 0.90,
    chunk_max_chars: int = DEFAULT_TRANSCRIPT_CHUNK_MAX_CHARS,
    chunk_overlap_segments: int = DEFAULT_TRANSCRIPT_CHUNK_OVERLAP_SEGMENTS,
    chunk_concurrency: int = 3,
) -> MeetingGraph:
    """Compile extraction plus optional v0.8 embedding and duplicate detection."""
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

    async def detect_duplicates_node(state: MeetingGraphState) -> dict[str, object]:
        """Embed candidates and search only authorized open tasks from this project."""
        tasks = state.get("extracted_tasks")
        if tasks is None:
            raise ValueError("extracted tasks are missing from graph state")
        if embedding_provider is None or similarity_search is None or project_id is None:
            return {"extracted_tasks": tasks}
        if duplicate_high_threshold < duplicate_medium_threshold:
            raise ValueError("high duplicate threshold must be at least the medium threshold")
        if not tasks:
            return {"extracted_tasks": tasks}

        texts = [
            "\n".join(part for part in (task.title, task.description) if part) for task in tasks
        ]
        embeddings = await embedding_provider.embed_texts(texts)
        if len(embeddings) != len(tasks):
            raise ValueError("embedding provider returned an unexpected vector count")

        enriched: list[ExtractedTask] = []
        for task, embedding in zip(tasks, embeddings, strict=True):
            matches = await similarity_search.search(
                project_id=project_id,
                open_column_ids=state["payload"].open_task_column_ids,
                embedding=embedding,
                limit=10,
            )
            threshold_matches = [
                match for match in matches if match.score >= duplicate_medium_threshold
            ]
            compatible_matches = [
                match
                for match in threshold_matches
                if not _has_obvious_entity_conflict(task, match.title)
            ]
            decisions: dict[str, str] = {}
            if compatible_matches and duplicate_verifier is not None:
                try:
                    verified = await duplicate_verifier.verify_duplicates(task, compatible_matches)
                    decisions = {result.existing_task_id: result.decision for result in verified}
                except Exception:
                    logger.exception(
                        "Duplicate reranking failed for project=%s candidate=%r; failing closed",
                        project_id,
                        task.title,
                    )
            elif duplicate_verifier is None:
                decisions = {match.task_id: "same_work" for match in compatible_matches}

            for match in matches:
                conflict = _has_obvious_entity_conflict(task, match.title)
                decision = (
                    "below_threshold"
                    if match.score < duplicate_medium_threshold
                    else "unrelated_entity_conflict"
                    if conflict
                    else decisions.get(match.task_id, "unverified")
                )
                logger.info(
                    "Duplicate candidate project=%s new=%r existing=%s title=%r score=%.4f decision=%s",
                    project_id,
                    task.title,
                    match.task_id,
                    match.title,
                    match.score,
                    decision,
                )

            best = next(
                (
                    match
                    for match in compatible_matches
                    if decisions.get(match.task_id) == "same_work"
                ),
                None,
            )
            duplicate = None
            if best is not None:
                duplicate = DuplicateProposal(
                    existingTaskId=best.task_id,
                    similarityLabel=(
                        "high" if best.score >= duplicate_high_threshold else "medium"
                    ),
                    similarityScore=best.score,
                    verification="same_work",
                )
            enriched.append(
                task.model_copy(
                    update={"embedding": list(embedding), "duplicate": duplicate},
                    deep=True,
                )
            )
        return {"extracted_tasks": enriched}

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
    graph.add_node("detect_duplicate_tasks", detect_duplicates_node)
    graph.add_node("prepare_review_result", prepare_result_node)
    graph.add_edge(START, "normalize_transcript")
    graph.add_edge("normalize_transcript", "chunk_transcript")
    graph.add_edge("chunk_transcript", "extract_task_candidates")
    graph.add_edge("extract_task_candidates", "reconcile_task_candidates")
    graph.add_edge("reconcile_task_candidates", "detect_duplicate_tasks")
    graph.add_edge("detect_duplicate_tasks", "prepare_review_result")
    graph.add_edge("prepare_review_result", END)
    return graph.compile()


async def run_meeting_graph(
    payload: MeetingProcessPayload,
    extractor: TaskExtractor,
    *,
    project_id: str | None = None,
    embedding_provider: EmbeddingProvider | None = None,
    similarity_search: TaskSimilaritySearch | None = None,
    duplicate_verifier: DuplicateVerifier | None = None,
    duplicate_medium_threshold: float = 0.80,
    duplicate_high_threshold: float = 0.90,
    chunk_max_chars: int = DEFAULT_TRANSCRIPT_CHUNK_MAX_CHARS,
    chunk_overlap_segments: int = DEFAULT_TRANSCRIPT_CHUNK_OVERLAP_SEGMENTS,
    chunk_concurrency: int = 3,
) -> MeetingExtractionResult:
    """Run one meeting through the graph and return its validated review result."""
    graph = build_meeting_graph(
        extractor,
        project_id=project_id,
        embedding_provider=embedding_provider,
        similarity_search=similarity_search,
        duplicate_verifier=duplicate_verifier,
        duplicate_medium_threshold=duplicate_medium_threshold,
        duplicate_high_threshold=duplicate_high_threshold,
        chunk_max_chars=chunk_max_chars,
        chunk_overlap_segments=chunk_overlap_segments,
        chunk_concurrency=chunk_concurrency,
    )
    final_state = await graph.ainvoke({"payload": payload})
    result = final_state.get("result")
    if result is None:
        raise RuntimeError("meeting graph completed without a result")
    return result
