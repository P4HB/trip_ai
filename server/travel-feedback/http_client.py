"""Provider-neutral JSON over HTTP shared by the LLM and route adapters (SPEC-113 REQ-008)."""
from __future__ import annotations

import json
import re
from urllib.error import HTTPError, URLError
from urllib.request import urlopen


class ProviderError(RuntimeError):
    def __init__(self, code: str, reason: str | None = None):
        self.code = code
        # Provider enum such as API_KEY_INVALID / RESOURCE_EXHAUSTED / invalid_api_key — never a message.
        self.reason = reason if isinstance(reason, str) and re.fullmatch(r"[A-Za-z0-9_.]{1,60}", reason) else None
        super().__init__(code)


def provider_error_reason(body):
    """Extract only a machine enum from a provider error body (Google ErrorInfo reason/status, OpenAI code/type)."""
    try:
        error = json.loads(body).get("error")
    except (ValueError, AttributeError, TypeError):
        return None
    if not isinstance(error, dict):
        return None
    for detail in error.get("details") or []:
        if isinstance(detail, dict) and isinstance(detail.get("reason"), str):
            return detail["reason"]
    for key in ("status", "code", "type"):
        if isinstance(error.get(key), str):
            return error[key]
    return None


def request_json(request, timeout, opener=urlopen, max_bytes=2_000_000):
    if timeout <= 0:
        raise ProviderError("provider_deadline")
    try:
        with opener(request, timeout=timeout) as response:
            content = response.read(max_bytes + 1)
        if len(content) > max_bytes:
            raise ProviderError("provider_response_too_large")
        result = json.loads(content)
        if not isinstance(result, dict):
            raise ProviderError("provider_invalid_response")
        return result
    except ProviderError:
        raise
    except HTTPError as error:
        # Do not include URLs, authorization headers, response bodies or request text; keep only an enum reason.
        try:
            reason = provider_error_reason(error.read(65_536))
        except Exception:
            reason = None
        finally:
            error.close()
        raise ProviderError(f"provider_http_{error.code}", reason) from None
    except TimeoutError:
        raise ProviderError("provider_timeout") from None
    except URLError as error:
        raise ProviderError("provider_timeout" if isinstance(error.reason, TimeoutError) else "provider_unavailable") from None
    except OSError:
        raise ProviderError("provider_unavailable") from None
    except (ValueError, UnicodeError):
        raise ProviderError("provider_invalid_response") from None
