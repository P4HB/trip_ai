"""SPEC-108 Gemini adapter and provider selection: no network, no real keys."""
import contextlib
import io
import json
import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch
from urllib.error import HTTPError

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import feedback_api
from fake_llm_scheduler import GeminiGenerateStub
from itinerary_service import PROPOSAL_SCHEMA
from llm_client import (GeminiClient, OpenAIClient, ProviderError, create_llm_client, json_schema_to_gemini,
                        llm_key_configured, resolve_llm_provider, task_instructions)
from restaurant_candidates import FIT_SCHEMA
from visit_insights import INSIGHTS_SCHEMA

SCHEMA = {"type": "object", "additionalProperties": False, "required": ["x"], "properties": {"x": {"type": "integer"}}}
MODEL = {"name": "models/gemini-3.8-flash", "supportedGenerationMethods": ["generateContent"]}


class FakeHTTP:
    def __init__(self, responses):
        self.responses, self.requests = list(responses), []

    def __call__(self, request, timeout):
        self.requests.append(request)
        value = self.responses.pop(0)
        if isinstance(value, Exception):
            raise value

        class Response:
            def __enter__(self):
                return self

            def __exit__(self, *args):
                return False

            def read(self, limit):
                return json.dumps(value).encode()
        return Response()


def reply(value, reason="STOP", extra=None):
    body = {"candidates": [{"content": {"parts": [{"text": json.dumps(value)}]}, "finishReason": reason}],
            "usageMetadata": {"promptTokenCount": 10, "candidatesTokenCount": 4, "thoughtsTokenCount": 7, "totalTokenCount": 21}}
    body.update(extra or {})
    return body


def http_error(code):
    return HTTPError("https://generativelanguage.googleapis.com/x", code, "secret body with key", {}, None)


class GeminiAdapterTests(unittest.TestCase):
    def test_request_shape_header_key_and_result(self):
        http = FakeHTTP([MODEL, reply({"x": 1}), reply({"x": 2})])
        client = GeminiClient("secret-key", opener=http)
        self.assertEqual(client.generate_structured("restaurant_fit", {"slots": []}, SCHEMA, 20), {"x": 1})
        self.assertEqual(client.generate_structured("itinerary", {"day": 1}, SCHEMA, 20), {"x": 2})
        self.assertEqual(len(http.requests), 3, "model checked once")
        check, call = http.requests[0], http.requests[1]
        self.assertTrue(check.full_url.endswith("/v1beta/models/gemini-3.8-flash"))
        self.assertTrue(call.full_url.endswith("/v1beta/models/gemini-3.8-flash:generateContent"))
        for request in http.requests:
            self.assertNotIn("secret-key", request.full_url)
            self.assertEqual(request.get_header("X-goog-api-key"), "secret-key")
        body = json.loads(call.data)
        self.assertEqual(body["systemInstruction"]["parts"][0]["text"], task_instructions("restaurant_fit"))
        self.assertEqual(json.loads(body["contents"][0]["parts"][0]["text"]), {"slots": []})
        config = body["generationConfig"]
        self.assertEqual((config["responseMimeType"], config["responseJsonSchema"], config["maxOutputTokens"]), ("application/json", SCHEMA, 8192))
        self.assertNotIn("thinkingConfig", config)
        self.assertEqual(client.last_usage, {"input_tokens": 10, "output_tokens": 4, "thought_tokens": 7, "total_tokens": 21})

    def test_thought_parts_are_ignored_and_thinking_level_is_optional(self):
        response = {"candidates": [{"content": {"parts": [{"text": "{not json", "thought": True}, {"text": json.dumps({"x": 3})}]},
                                    "finishReason": "STOP"}]}
        http = FakeHTTP([MODEL, response])
        client = GeminiClient("k", opener=http, thinking_level="low")
        self.assertEqual(client.generate_structured("itinerary", {}, SCHEMA), {"x": 3})
        self.assertEqual(json.loads(http.requests[1].data)["generationConfig"]["thinkingConfig"], {"thinkingLevel": "low"})

    def test_json_schema_rejection_falls_back_once_and_sticks(self):
        http = FakeHTTP([MODEL, http_error(400), reply({"x": 1}), reply({"x": 2})])
        client = GeminiClient("k", opener=http)
        self.assertEqual(client.generate_structured("itinerary", {}, SCHEMA), {"x": 1})
        self.assertEqual(client.generate_structured("itinerary", {}, SCHEMA), {"x": 2})
        self.assertEqual(len(http.requests), 4)
        retry = json.loads(http.requests[2].data)["generationConfig"]
        self.assertNotIn("responseJsonSchema", retry)
        self.assertEqual(retry["responseSchema"]["type"], "OBJECT")
        self.assertNotIn("responseJsonSchema", json.loads(http.requests[3].data)["generationConfig"])

    def test_refusals_incomplete_and_invalid_outputs(self):
        cases = [(reply({"x": 1}, extra={"promptFeedback": {"blockReason": "SAFETY"}}), "llm_refused"),
                 ({"candidates": []}, "llm_refused"),
                 (reply({"x": 1}, reason="SAFETY"), "llm_refused"),
                 (reply({"x": 1}, reason="MAX_TOKENS"), "llm_incomplete"),
                 ({"candidates": [{"content": {"parts": [{"text": "{broken"}]}, "finishReason": "STOP"}]}, "llm_invalid_output"),
                 (reply({"x": "nope"}), "llm_invalid_output"),
                 (reply({"x": 1, "invented": "hours"}), "llm_invalid_output")]
        for response, code in cases:
            with self.subTest(code=code):
                with self.assertRaisesRegex(ProviderError, code):
                    GeminiClient("k", opener=FakeHTTP([MODEL, response])).generate_structured("itinerary", {}, SCHEMA)

    def test_model_access_and_errors_do_not_leak(self):
        for responses, code in (([{"displayName": "no resource name"}], "llm_model_unavailable"),
                                ([{"name": "models/gemini-3.8-flash", "supportedGenerationMethods": ["embedContent"]}], "llm_model_unavailable"),
                                ([http_error(404)], "llm_model_unavailable"),
                                ([http_error(403)], "provider_http_403"),
                                ([MODEL, http_error(429)], "provider_http_429")):
            with self.subTest(code=code):
                with self.assertRaises(ProviderError) as caught:
                    GeminiClient("secret-key", opener=FakeHTTP(responses)).generate_structured("itinerary", {}, SCHEMA)
                self.assertEqual(str(caught.exception), code)
                self.assertNotIn("secret", str(caught.exception))

    def test_missing_key_deadline_and_size_limits_prevent_calls(self):
        http = FakeHTTP([])
        with self.assertRaisesRegex(ProviderError, "llm_not_configured"):
            GeminiClient("", opener=http).generate_structured("itinerary", {}, SCHEMA)
        with self.assertRaisesRegex(ProviderError, "provider_deadline"):
            GeminiClient("k", opener=http).generate_structured("itinerary", {}, SCHEMA, 0)
        with self.assertRaisesRegex(ProviderError, "llm_input_too_large"):
            GeminiClient("k", opener=http).generate_structured("itinerary", {"x": "x" * 120_000}, SCHEMA)
        self.assertEqual(http.requests, [])

    def test_schema_conversion_for_real_contracts(self):
        def walk(node):
            if isinstance(node, dict):
                self.assertNotIn("additionalProperties", node)
                self.assertNotIn("anyOf", node) if node.get("nullable") else None
                if "type" in node:
                    self.assertTrue(node["type"].isupper())
                for value in node.values():
                    walk(value)
            elif isinstance(node, list):
                for value in node:
                    walk(value)
        for schema in (PROPOSAL_SCHEMA, FIT_SCHEMA, INSIGHTS_SCHEMA):
            converted = json_schema_to_gemini(schema)
            walk(converted)
            self.assertEqual(converted["required"], schema["required"])
            self.assertEqual(converted["propertyOrdering"], list(schema["properties"]))
        dwell = json_schema_to_gemini(INSIGHTS_SCHEMA)["properties"]["dwellMinutes"]
        self.assertEqual((dwell["type"], dwell["nullable"]), ("OBJECT", True))
        self.assertEqual(json_schema_to_gemini(FIT_SCHEMA)["properties"]["judgements"]["items"]["properties"]["verdict"]["enum"],
                         FIT_SCHEMA["properties"]["judgements"]["items"]["properties"]["verdict"]["enum"])


class ProviderSelectionTests(unittest.TestCase):
    def test_auto_selection_matrix(self):
        self.assertEqual(resolve_llm_provider({"GEMINI_API_KEY": "g"}), "gemini")
        self.assertEqual(resolve_llm_provider({"GOOGLE_API_KEY": "g"}), "gemini")
        self.assertEqual(resolve_llm_provider({"OPENAI_API_KEY": "o"}), "openai")
        self.assertEqual(resolve_llm_provider({"OPENAI_API_KEY": "o", "GEMINI_API_KEY": "g"}), "openai")
        self.assertEqual(resolve_llm_provider({"OPENAI_API_KEY": "o", "GEMINI_API_KEY": "g", "LLM_PROVIDER": "gemini"}), "gemini")
        self.assertEqual(resolve_llm_provider({}), "openai")
        with self.assertRaises(ValueError):
            resolve_llm_provider({"LLM_PROVIDER": "claude"})
        self.assertTrue(llm_key_configured({"GEMINI_API_KEY": "g"}))
        self.assertFalse(llm_key_configured({"LLM_PROVIDER": "gemini", "OPENAI_API_KEY": "o"}))
        self.assertFalse(llm_key_configured({"LLM_PROVIDER": "nope", "GEMINI_API_KEY": "g"}))

    def test_factory_models_tokens_and_stale_cross_provider_names(self):
        gemini = create_llm_client(environ={"GEMINI_API_KEY": "g"})
        self.assertIsInstance(gemini, GeminiClient)
        self.assertEqual((gemini.model, gemini.max_output_tokens, gemini.configured), ("gemini-3.8-flash", 8192, True))
        stale = create_llm_client(environ={"GEMINI_API_KEY": "g", "ITINERARY_LLM_MODEL": "gpt-5.6-terra", "ITINERARY_LLM_MAX_OUTPUT_TOKENS": ""})
        self.assertEqual(stale.model, "gemini-3.8-flash", "an OpenAI model name left in .env is ignored for Gemini")
        chosen = create_llm_client(model="gemini-3.5-flash-lite", max_output_tokens="2000", environ={"GEMINI_API_KEY": "g"})
        self.assertEqual((chosen.model, chosen.max_output_tokens), ("gemini-3.5-flash-lite", 2000))
        openai = create_llm_client(environ={"OPENAI_API_KEY": "o", "ITINERARY_LLM_MODEL": "gemini-3.8-flash"})
        self.assertIsInstance(openai, OpenAIClient)
        self.assertEqual(openai.model, "gpt-5.6-terra")

    def test_enable_flag_follows_selected_provider(self):
        self.assertTrue(feedback_api.itinerary_enabled({"GEMINI_API_KEY": "g"}))
        self.assertFalse(feedback_api.itinerary_enabled({"GEMINI_API_KEY": "g", "ITINERARY_ENABLED": "0"}))
        self.assertFalse(feedback_api.itinerary_enabled({"LLM_PROVIDER": "gemini"}))


class GeminiKeyOnlyStartupTests(unittest.TestCase):
    """AC-10805: only GEMINI_API_KEY (fake) — the real adapter talks to a generateContent stub."""

    def test_service_loads_and_generates_with_only_gemini_key(self):
        env = {key: value for key, value in os.environ.items()
               if key not in ("ITINERARY_ENABLED", "OPENAI_API_KEY", "LLM_PROVIDER", "ITINERARY_LLM_MODEL", "RESTAURANT_LLM_MODEL",
                              "GOOGLE_API_KEY", "ITINERARY_LLM_MAX_OUTPUT_TOKENS", "GEMINI_THINKING_LEVEL", "ITINERARY_ROUTE_PROVIDER")}
        env["GEMINI_API_KEY"] = "gm-test-not-a-real-key"
        stub = GeminiGenerateStub()
        request = {"schemaVersion": "itinerary-request-v2", "requestId": "gemini.day-1", "recommendationRevision": "1",
                   "courseVariantId": "v1", "travelWindow": {"startDate": "2026-10-20", "endDate": "2026-10-20"}, "routeMode": "car",
                   "generationScope": "day",
                   "days": [{"dayIndex": 1, "date": "2026-10-20", "placeIds": ["127490", "126455", "2660802", "741109"],
                             "requiredPlaceIds": [], "anchorPlaceId": "127490", "startLocation": {"placeId": "228853"},
                             "endLocation": {"placeId": "228853"}, "startTime": "09:00", "endTime": "20:30"}]}
        with patch.dict(os.environ, env, clear=True), patch.object(GeminiClient, "_request", autospec=True, side_effect=stub), \
                contextlib.redirect_stdout(io.StringIO()) as log:
            service = feedback_api.load_itinerary_service()
            self.assertIsNotNone(service, log.getvalue())
            self.assertIsInstance(service.llm, GeminiClient)
            self.assertIsInstance(service.recommender.llm, GeminiClient)
            result = service.generate(request)
        day = result["days"][0]
        self.assertIn(day["status"], ("validated", "verification_required", "partially_scheduled"), day["violations"])
        self.assertEqual({m["restaurantStatus"] for m in day["mealSlots"]}, {"candidates_ready"})
        generated = [suffix for suffix, data in stub.requests if suffix.endswith(":generateContent")]
        self.assertEqual(generated, ["models/gemini-3.8-flash:generateContent"] * 2, "timetable + restaurant judgement")
        self.assertEqual(result["provenance"]["model"], "gemini-3.8-flash")
        self.assertNotIn("gm-test", json.dumps(result) + log.getvalue())


if __name__ == "__main__":
    unittest.main()
