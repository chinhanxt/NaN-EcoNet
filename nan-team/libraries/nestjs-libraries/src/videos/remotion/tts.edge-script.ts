/** Embedded so TypeScript builds do not need to copy a separate Python asset.
 * Requires edge-tts >= 7.2.3. The CLI defaults to sentence boundaries.
 */
export const EDGE_WORD_SCRIPT = String.raw`
import asyncio, json, sys
import edge_tts
import aiohttp

async def main():
    request = json.load(sys.stdin)
    for attempt in range(5):
        captions = []
        stream = edge_tts.Communicate(
            request["text"], request["voice"], boundary="WordBoundary",
            connect_timeout=10, receive_timeout=25,
        )
        try:
            with open(request["audioPath"], "wb") as audio:
                async for chunk in stream.stream():
                    if chunk["type"] == "audio":
                        audio.write(chunk["data"])
                    elif chunk["type"] == "WordBoundary":
                        captions.append({
                            "text": chunk["text"],
                            "startMs": chunk["offset"] / 10000,
                            "endMs": (chunk["offset"] + chunk["duration"]) / 10000,
                        })
            break
        except (edge_tts.exceptions.NoAudioReceived, aiohttp.ClientError, asyncio.TimeoutError):
            if attempt == 4:
                raise
            await asyncio.sleep(min(8, 2 ** attempt))
    if not captions:
        raise RuntimeError("Edge TTS returned no word timing metadata")
    print(json.dumps(captions, ensure_ascii=False))

asyncio.run(main())
`;
