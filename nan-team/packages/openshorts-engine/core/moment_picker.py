"""AI Moment Picker and Vision Fallback pipeline.

Handles:
- Two-pass viral clip detection: scoring 90s transcript windows, ranking shortlist,
  and detailed moment extraction.
- Gemini 3.1 Flash-Lite with Local LLM (OpenAI-compatible) fallback.
- Snapping cuts to word boundaries and deduping overlapping clips.
- Vision fallback (get_visual_clips) for silent videos without usable speech.
"""

import json
import os
import time
from typing import Optional

import agy_compat as genai
from agy_compat import types as genai_types

import gemini_worker
import llm_backend
from clip_selection import (
    build_transcript_windows,
    clip_count_targets,
    clip_duration_bounds,
    dedupe_overlapping,
    score_batches,
    shortlist_target,
    snap_clip_to_words,
    trim_to_best,
)


def _run_gemini_stage(client, model_name, prompt, schema):
    """One schema-enforced model call with transient-error backoff.
    Returns (parsed_dict, cost_analysis).

    With an OpenAI-compatible server configured (``llm_backend.active()``)
    the call goes there instead of Gemini and ``client`` is unused; the
    retry policy is shared because a local server has the same failure
    shapes (connection refused while the model loads, a truncated body,
    a 5xx from a busy vLLM)."""
    use_local = llm_backend.active()
    config = None if use_local else genai_types.GenerateContentConfig(
        response_mime_type="application/json",
        response_schema=schema,
    )
    max_attempts = 3
    for attempt in range(1, max_attempts + 1):
        try:
            if use_local:
                return llm_backend.generate_json(prompt, schema, model=model_name)
            response = client.models.generate_content(model=model_name, contents=prompt, config=config)
            # Policy blocks are deterministic — retrying only burns quota and
            # time, and the user deserves the real reason instead of a generic
            # "empty response" (prod 23-jul: PROHIBITED_CONTENT on every try).
            gemini_worker.raise_if_blocked(response)
            # Parsing lives inside the retry loop on purpose: Gemini sometimes
            # returns 200 with an empty body, which raises here rather than at
            # the call. Retrying that recovered every occurrence seen in prod
            # (22-jul-2026) — the same payload succeeds on the next attempt.
            parsed_obj = getattr(response, "parsed", None)
            if parsed_obj is not None:
                parsed = parsed_obj.model_dump() if hasattr(parsed_obj, "model_dump") else parsed_obj
            else:
                parsed = gemini_worker._parse_json_response_text(
                    gemini_worker._get_response_text(response))
            return parsed, gemini_worker._calculate_cost_analysis(response, model_name)
        except gemini_worker.GeminiBlockedError:
            raise  # deterministic policy block — never retry
        except Exception as e:
            msg = str(e)
            transient = any(tok in msg for tok in (
                '503', 'UNAVAILABLE', '429', 'RESOURCE_EXHAUSTED',
                '500', 'INTERNAL', 'overloaded', 'Deadline',
                'empty response body', 'did not contain a JSON object',
                'Failed to parse Gemini JSON response',
                # OpenAI-compatible servers: model still loading, busy, or a
                # small model that skipped a required field this time.
                'ConnectError', 'ReadTimeout', 'RemoteProtocolError', '502', '504',
                'validation error'))
            if attempt == max_attempts or not transient:
                raise
            wait = 5 * (2 ** (attempt - 1))
            who = "LLM server" if use_local else "Gemini"
            print(f"⚠️ {who} transient error (attempt {attempt}/{max_attempts}), retrying in {wait}s: {msg[:150]}")
            time.sleep(wait)


def _run_stage_split(client, model_name, items, build_prompt, schema, key, costs, label):
    """Run a Gemini stage over ``items``; on a policy block, bisect.

    Google's prompt filter (PROHIBITED_CONTENT) fires on some COMBINATIONS of
    transcript windows that pass individually (27-aug-2026: windows 5+6 of a
    software walkthrough blocked 3/3, each alone fine, all three models).
    A block is deterministic for a given prompt, so instead of failing the
    job the batch is split in halves until the offending combination is
    isolated; a single item that still blocks is dropped with a log line.
    Returns the merged list found under ``key`` in each response."""
    if not items:
        return []
    prompt = build_prompt(items)
    try:
        parsed, cost = _run_gemini_stage(client, model_name, prompt, schema)
        if cost:
            costs.append(cost)
        return list(parsed.get(key) or [])
    except gemini_worker.GeminiBlockedError as e:
        if len(items) == 1:
            print(f"   🚫 {label}: Gemini blocked window {items[0].get('id')} on its own; skipping it ({e})")
            return []
        mid = len(items) // 2
        print(f"   🚫 {label}: Gemini blocked a batch of {len(items)}; retrying as {mid} + {len(items) - mid}")
        return (_run_stage_split(client, model_name, items[:mid], build_prompt, schema, key, costs, label)
                + _run_stage_split(client, model_name, items[mid:], build_prompt, schema, key, costs, label))


def score_batch_size():
    """Transcript windows per scoring call: ``LLM_SCORE_BATCH`` if set, else
    8 for Gemini (1M context) and 3 for an OpenAI-compatible server."""
    raw = os.environ.get("LLM_SCORE_BATCH", "").strip()
    if raw:
        try:
            return max(1, int(raw))
        except ValueError:
            pass
    return 3 if llm_backend.active() else 8


def get_viral_clips(transcript_result, video_duration):
    """Two-pass clip selection: score transcript windows, then detail the best.

    Windowing gives even coverage on long videos (a single call over the whole
    transcript clusters picks near the start), and the cheap scoring pass keeps
    the expensive detail reasoning focused on the shortlist. Cuts are snapped to
    word boundaries so clips don't start/end mid-word.
    """
    language = str(transcript_result.get('language') or 'unknown')
    if llm_backend.active():
        # Self-hosted text model: no Google key needed for this stage.
        client = None
        model_name = llm_backend.model_name()
        print(f"🤖  Analyzing with local LLM at {llm_backend.base_url()} (2-pass: score → detail)...")
    else:
        print("🤖  Analyzing with Gemini (2-pass: score → detail)...")
        api_key = "agy-job-rpc"
        if not api_key:
            print("❌ Error: GEMINI_API_KEY not found in environment variables "
                  "(set it, or point LLM_BASE_URL at an OpenAI-compatible server).")
            return None
        client = genai.Client(api_key=api_key)
        model_name = os.environ.get("GEMINI_MODEL") or 'gemini-3.1-flash-lite'
    print(f"🤖  Model: {model_name} | language: {language}")

    # Full word list — ground truth for snapping cut points.
    words = []
    for segment in transcript_result.get('segments', []):
        for word in segment.get('words', []):
            words.append({'w': word['word'], 's': word['start'], 'e': word['end']})

    try:
        # Scoring windows must be able to CONTAIN a max-length clip (the detail
        # prompt keeps clips inside their candidate window), so scale them with
        # the requested band — a user asking for 60-90s clips on the default
        # 90s windows would get clips squeezed against the window walls.
        min_secs, max_secs = clip_duration_bounds()
        # NaN: a band past the source length cannot be met; cap it there.
        max_secs = min(max_secs, round(float(video_duration), 3))
        min_secs = min(min_secs, max_secs)
        windows = build_transcript_windows(
            transcript_result, video_duration,
            window_seconds=max(90, int(max_secs * 1.5)))
        print(f"   Built {len(windows)} scoring window(s).")
        costs = []

        # --- Pass 1: score windows in batches, keep the highest-scoring ---
        scored = []
        # Local models usually run with a 4-8k context (Ollama defaults to
        # 4096 unless OLLAMA_CONTEXT_LENGTH says otherwise) and 8 windows of
        # transcript do not fit; a silently truncated prompt scores garbage.
        SCORE_BATCH = score_batch_size()
        # The batches only split the work: the prompt scores every window it
        # is given and the shortlist below is the global top `target`. Letting
        # each batch SELECT instead (the old "up to 3 per batch") capped the
        # shortlist at 3 * n_batches, under the target for any source shorter
        # than ~30 min. See clip_selection.score_batches.
        target = shortlist_target(video_duration)

        # NaN: timestamped sentence units, so the model picks unit edges
        # instead of guessing times (upstream sends window text only).
        try:
            import timelines
            units = timelines.sentences(transcript_result)
        except ImportError:
            units = []

        def _payload(ws):
            result = []
            for w in ws:
                inside = [u for u in units if u["end"] > w["start"] and u["start"] < w["end"]]
                text = "\n".join("[%.2f-%.2f] %s" % (u["start"], u["end"], u["text"]) for u in inside) or w["text"]
                result.append({"id": w["id"], "start": w["start"], "end": w["end"], "text": text})
            return result

        def _score_prompt(ws):
            return gemini_worker.SCORE_PROMPT_TEMPLATE.format(
                video_duration=video_duration, language=language,
                windows_json=json.dumps(_payload(ws), ensure_ascii=False))

        if len(windows) <= target:
            # NaN: every window is shortlisted anyway, so a score pass cannot change
            # the detail input; skip that AGY session (short sources, U1 patch 10a).
            print(f"   {len(windows)} window(s) <= shortlist {target}: score pass skipped.")
            shortlist = list(windows)
        else:
            # NaN: batches are independent AGY sessions; overlap them when the
            # job owner runs more than one AGY request at once.
            import ai_provider
            batches = list(score_batches(windows, SCORE_BATCH))
            for part in ai_provider.gather(
                    [lambda batch=batch: _run_stage_split(
                        client, model_name, batch, _score_prompt,
                        gemini_worker.ScoreResponse, "windows", costs, "score")
                     for batch in batches]):
                scored.extend(part)

            # Shortlist the top windows; scale with duration so long videos surface
            # more candidates without exploding the detail call.
            scored.sort(key=lambda w: w.get("score", 0), reverse=True)
            by_id = {w["id"]: w for w in windows}
            shortlist = [by_id[w["id"]] for w in scored[:target] if w.get("id") in by_id]
            if not shortlist:
                shortlist = windows[:target]  # scoring returned nothing usable
        print(f"   Shortlisted {len(shortlist)} window(s) for detail.")

        # --- Pass 2: detailed clip extraction on the shortlist ---
        min_clips, max_clips = clip_count_targets(len(shortlist))

        def _detail_prompt_for(lo, hi):
            # A split batch keeps the full clip-count band: a short list can
            # still hold the best clips, and the model returns fewer anyway.
            def build(ws):
                return gemini_worker.DETAIL_PROMPT_TEMPLATE.format(
                    video_duration=video_duration, language=language,
                    min_clips=lo, max_clips=hi,
                    min_secs=min_secs, max_secs=max_secs,
                    windows_json=json.dumps(_payload(ws), ensure_ascii=False)) + (
                    "\nSENTENCE UNITS: each window text lists timestamped units \"[start-end] text\". "
                    "A clip's start MUST equal one unit's start and its end MUST equal a later unit's end, "
                    "covering whole consecutive units, with end - start between %g and %g seconds.\n"
                    % (min_secs, max_secs) if units else "")
            return build

        shorts = _run_stage_split(client, model_name, shortlist,
                                  _detail_prompt_for(min_clips, max_clips),
                                  gemini_worker.DetailResponse, "shorts", costs, "detail")

        # The floor lived only in the prompt, and a prompt is not a contract:
        # the model regularly returned half of it and the job shipped that.
        # The windows it passed over are the cheap second chance — they are
        # already the best-scoring ones in the video — so they get one more
        # call for the missing clips. It may still come back empty, which is
        # the honest answer for material that does not hold more.
        if len(shorts) < min_clips:
            used = {str(s.get("source_window_id") or "") for s in shorts}
            spare = [w for w in shortlist if w["id"] not in used]
            if spare:
                missing = min_clips - len(shorts)
                print(f"   Detail returned {len(shorts)} clip(s) of {min_clips}; "
                      f"asking the {len(spare)} unused window(s) for {missing} more.")
                extra = _run_stage_split(
                    client, model_name, spare,
                    _detail_prompt_for(missing, max(missing, len(spare))),
                    gemini_worker.DetailResponse, "shorts", costs, "detail-floor")
                if extra:
                    shorts = sorted(shorts + extra,
                                    key=lambda s: float(s.get("start") or 0))
                    print(f"   Recovered {len(extra)} clip(s) from them.")

        if len(shorts) > max_clips:
            # By score, never by position: the results arrive in transcript
            # order, so slicing kept the earliest clips and silently dropped
            # the back half of the video. See trim_to_best.
            dropped = len(shorts) - max_clips
            shorts = trim_to_best(shorts, max_clips)
            print(f"   Kept the {max_clips} best-scoring clip(s) of "
                  f"{max_clips + dropped}.")
        # Snap each proposed clip onto real word boundaries (+ a bit of silence).
        for s in shorts:
            # Keep the model's raw proposal: it is how boundary accuracy is
            # measured (distance to the nearest word before the snap; p90 was
            # 0.4-0.5 s on 8 talks, 21-sep-2026, so the snap reaches it).
            s["proposed"] = [s.get("start", 0), s.get("end", 0)]
            ns, ne = snap_clip_to_words(s.get("start", 0), s.get("end", 0), words, video_duration,
                                        min_duration=min_secs, max_duration=max_secs)
            s["start"], s["end"] = ns, ne
        deduped = dedupe_overlapping(shorts)
        if len(deduped) < len(shorts):
            print(f"   Dropped {len(shorts) - len(deduped)} clip(s) overlapping a "
                  f"better-scored one.")
            shorts = deduped

        # Aggregate cost across both passes.
        cost_analysis = None
        if costs:
            cost_analysis = {
                "input_tokens": sum(c.get("input_tokens", 0) for c in costs),
                "output_tokens": sum(c.get("output_tokens", 0) for c in costs),
                "total_cost": sum(c.get("total_cost", 0) for c in costs),
                "model": model_name,
            }
            print(f"💰 Total cost ({model_name}, 2-pass, {len(costs)} calls): ${cost_analysis['total_cost']:.6f}")

        if not shorts:
            print("⚠️ 2-pass returned no clips.")
            return None

        result = {"shorts": shorts}
        if cost_analysis:
            result["cost_analysis"] = cost_analysis
        return result
    except gemini_worker.GeminiBlockedError as e:
        # Content-policy rejection: propagate so the job fails with the real
        # reason instead of a generic "no clips found".
        print(f"🚫 {e}")
        raise
    except Exception as e:
        if llm_backend.active():
            print(f"❌ AGY MCP clip analysis error: {e}")
            raise RuntimeError(f'AGY MCP clip analysis failed: {e}') from e
        print(f"❌ Gemini Error: {e}")
        return None


# --- Speech too sparse to clip by transcript -------------------------------
# The vision path used to fire only on a missing audio TRACK. A nursery-rhyme
# video or a dashcam drive has audio, so it went through transcription, came
# back as one segment ("Uh uh"), produced one scoring window and Gemini
# returned no clips — three failed jobs on 25-aug-2026, one user twice. Speech
# is ~120-160 words/min; below these floors there is nothing to clip by words.
MIN_SPEECH_WORDS_PER_MIN = float(os.environ.get("MIN_SPEECH_WORDS_PER_MIN", "5"))
MIN_SPEECH_WORDS = int(os.environ.get("MIN_SPEECH_WORDS", "8"))


def speech_is_sparse(transcript, duration):
    """True when the transcript is too thin to drive clip selection."""
    words = sum(len((seg.get("text") or "").split())
                for seg in (transcript or {}).get("segments", []))
    minutes = max(float(duration or 0) / 60.0, 1e-6)
    return words < MIN_SPEECH_WORDS or words / minutes < MIN_SPEECH_WORDS_PER_MIN


def get_visual_clips(video_path, video_duration, language="vi"):
    """Clip a SILENT video by vision: Gemini watches the footage and picks the
    most engaging visual moments (no transcript). Returns the same
    {"shorts", "cost_analysis"} shape as get_viral_clips, or None."""
    print("🎥  Silent video — analyzing with Gemini vision (no transcript)...")
    api_key = "agy-job-rpc"
    if not api_key:
        if llm_backend.active():
            print("❌ This video has no usable speech, so it has to be clipped by "
                  "watching it, and that needs Gemini (a text-only LLM server "
                  "cannot see the footage). Add a GEMINI_API_KEY for silent videos.")
        else:
            print("❌ Error: GEMINI_API_KEY not found.")
        return None
    client = genai.Client(api_key=api_key)
    model_name = os.environ.get("GEMINI_MODEL") or 'gemini-3.1-flash-lite'
    print(f"🎥  Model: {model_name} | uploading {os.path.basename(video_path)}…")

    file_upload = None
    try:
        file_upload = gemini_worker.upload_media(client, video_path)
        deadline = time.time() + 180
        while True:
            info = client.files.get(name=file_upload.name)
            state = str(getattr(getattr(info, "state", info), "name", "")).upper()
            if state == "ACTIVE":
                break
            if state == "FAILED":
                print("❌ Gemini could not process the video.")
                return None
            if time.time() > deadline:
                print("❌ Gemini video processing timed out.")
                return None
            time.sleep(2)

        # The vision path has no scoring windows to derive a count from, so the
        # env targets (user request) apply directly over the classic 3-15.
        def _env_int(name, default):
            try:
                return max(1, int(os.environ.get(name, "")))
            except ValueError:
                return default
        v_min_clips = _env_int("CLIP_TARGET_MIN", 3)
        v_max_clips = max(v_min_clips, _env_int("CLIP_TARGET_MAX", 15))
        v_min_secs, v_max_secs = clip_duration_bounds()
        prompt = gemini_worker.VISUAL_PROMPT_TEMPLATE.format(
            video_duration=video_duration, language=language,
            min_clips=v_min_clips, max_clips=v_max_clips,
            min_secs=v_min_secs, max_secs=v_max_secs)
        config = genai_types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=gemini_worker.VisualResponse,
        )
        response = client.models.generate_content(
            model=model_name, contents=[file_upload, prompt], config=config)
        gemini_worker.raise_if_blocked(response)
        parsed = json.loads(response.text)
        shorts = parsed.get("shorts") or []
        # Clamp to the real duration; drop anything degenerate.
        clean = []
        for s in shorts:
            s["start"] = max(0.0, float(s.get("start", 0)))
            s["end"] = min(float(video_duration), float(s.get("end", 0)))
            if s["end"] - s["start"] >= 1.0:
                clean.append(s)
        if not clean:
            print("⚠️ Vision pass returned no usable clips.")
            return None

        cost = gemini_worker._calculate_cost_analysis(response, model_name)
        if cost:
            print(f"💰 Vision cost ({model_name}): ${cost.get('total_cost', 0):.6f}")
        result = {"shorts": clean}
        if cost:
            result["cost_analysis"] = cost
        return result
    except gemini_worker.GeminiBlockedError as e:
        print(f"🚫 {e}")
        raise
    except Exception as e:
        if llm_backend.active():
            print(f"❌ AGY MCP visual analysis error: {e}")
            raise RuntimeError(f'AGY MCP visual analysis failed: {e}') from e
        print(f"❌ Gemini vision error: {e}")
        return None
    finally:
        if file_upload is not None:
            try:
                client.files.delete(name=file_upload.name)
            except Exception:
                pass
