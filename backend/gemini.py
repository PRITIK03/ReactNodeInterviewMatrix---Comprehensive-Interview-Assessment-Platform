"""Bounded Gemini transport. Callers validate all returned JSON against their contracts."""

import json
import os
import re
import time
import urllib.error
import urllib.request


class ProviderError(Exception):
    pass


def request_json(system, content, schema, max_tokens, model, correlation, usage):
    key = os.getenv("MATRIX_REVIEW_KEY")
    if not key or not re.fullmatch(r"[\w.-]{1,100}", model):
        raise ProviderError("configuration")
    payload = {
        "systemInstruction": {"parts": [{"text": system}]},
        "contents": [{"parts": [{"text": json.dumps(content)}]}],
        "generationConfig": {
            "temperature": 0,
            "maxOutputTokens": max_tokens,
            "responseMimeType": "application/json",
            "responseJsonSchema": schema,
        },
    }
    request = urllib.request.Request(
        "https://generativelanguage.googleapis.com/v1beta/models/"
        + model
        + ":generateContent",
        data=json.dumps(payload).encode(),
        headers={
            "Content-Type": "application/json",
            "x-goog-api-key": key,
            "X-Request-ID": correlation,
        },
    )
    for attempt in range(3):
        try:
            with urllib.request.urlopen(request, timeout=10) as reply:
                doc = json.loads(reply.read(100000))
            counts = doc.get("usageMetadata", {})
            usage[0] += int(counts.get("promptTokenCount", 0))
            usage[1] += int(counts.get("candidatesTokenCount", 0)) + int(
                counts.get("thoughtsTokenCount", 0)
            )
            answer = doc["candidates"][0]
            if answer.get("finishReason") != "STOP":
                raise ProviderError("incomplete")
            return json.loads(answer["content"]["parts"][-1]["text"])
        except urllib.error.HTTPError as exc:
            if exc.code not in (429, 500, 502, 503, 504):
                raise ProviderError("provider_rejected") from None
        except (urllib.error.URLError, TimeoutError):
            pass
        except (ValueError, KeyError, IndexError, TypeError):
            raise ProviderError("invalid_response") from None
        if attempt < 2:
            time.sleep(0.3 * 2**attempt)
    raise ProviderError("unavailable")
