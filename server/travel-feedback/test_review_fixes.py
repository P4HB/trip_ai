"""SPEC-111 regressions using synthetic data; no provider or production database access."""
from concurrent.futures import ThreadPoolExecutor
from contextlib import closing
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
import subprocess
import tempfile
import threading
from types import SimpleNamespace
import unittest
from unittest.mock import patch

import feedback_api
import itinerary_service
from llm_client import StructuredResponse, GeminiClient
from test_feedback_api import valid_v3_payload
from test_itinerary import catalog_fixture, request_fixture, proposal_fixture, FakeRouter
from test_llm_gemini import FakeHTTP, MODEL, reply, http_error, SCHEMA


class ReviewFixTests(unittest.TestCase):
    def test_connections_close_and_concurrent_first_save_is_serialized(self):
        with tempfile.TemporaryDirectory() as directory:
            db = Path(directory) / 'test.sqlite3'
            store = feedback_api.FeedbackStore(str(db))
            payload = valid_v3_payload()
            gate = threading.Barrier(2)
            def save():
                gate.wait(timeout=5)
                return store.save_session(payload)
            with ThreadPoolExecutor(2) as executor:
                futures = [executor.submit(save) for _ in range(2)]
                results = [future.result(timeout=10) for future in futures]
            self.assertEqual(sum(result[1] for result in results), 1)
            self.assertEqual(sum(result[2] for result in results), 1)
            db.unlink()  # also proves handles were released on Windows

    def test_idle_service_actions_prune_without_a_new_submission(self):
        with tempfile.TemporaryDirectory() as directory:
            store = feedback_api.FeedbackStore(str(Path(directory) / 'test.sqlite3'))
            initial = datetime(2026, 1, 1, tzinfo=timezone.utc)
            store.save_session(valid_v3_payload(), initial)
            server = SimpleNamespace(store=store, rate_limiter=feedback_api.MemoryRateLimiter(), _next_maintenance=0)
            with patch.object(feedback_api, 'utc_now', return_value=initial + timedelta(days=91)):
                feedback_api.FeedbackHTTPServer.service_actions(server)
            with closing(store.connect()) as connection:
                self.assertEqual(connection.execute('SELECT count(*) FROM feedback_sessions').fetchone()[0], 0)

    def test_rate_keys_expire_and_cannot_grow_without_bound(self):
        limiter = feedback_api.MemoryRateLimiter(limit=1, window_seconds=60, max_keys=2)
        self.assertTrue(limiter.allow('a', 0))
        self.assertTrue(limiter.allow('b', 0))
        self.assertFalse(limiter.allow('c', 1))
        self.assertFalse(limiter.allow('a', 1))
        self.assertTrue(limiter.allow('c', 61))
        self.assertEqual(set(limiter._events), {'c'})
        limiter.prune(122)
        self.assertEqual(limiter._events, {})

    def test_forwarded_ip_is_ignored_unless_peer_is_explicitly_trusted(self):
        server = SimpleNamespace(trusted_proxy_ips=frozenset({'10.0.0.2'}))
        key = lambda peer, header: feedback_api.FeedbackHTTPServer.client_rate_key(server, peer, header)
        self.assertEqual(key('127.0.0.1', '203.0.113.9'), '127.0.0.1')
        self.assertEqual(key('10.0.0.2', '203.0.113.9'), '203.0.113.9')
        self.assertEqual(key('10.0.0.2', 'arbitrary-key'), '10.0.0.2')
        self.assertEqual(key('10.0.0.2', '203.0.113.9, 203.0.113.10'), '10.0.0.2')

    def test_gemini_response_keeps_own_model_and_usage_after_fallback(self):
        http = FakeHTTP([MODEL, reply({'x':1}), http_error(503), MODEL, reply({'x':2})])
        client = GeminiClient('synthetic-placeholder', opener=http, model='primary', fallback_model='fallback')
        first = client.generate_structured('itinerary', {}, SCHEMA)
        second = client.generate_structured('itinerary', {}, SCHEMA)
        self.assertEqual((first.model, second.model), ('primary', 'fallback'))
        second.usage['total_tokens'] = 99
        self.assertEqual(first.usage['total_tokens'], 21)
        self.assertEqual(json.loads(json.dumps(first)), {'x':1})

    def test_concurrent_itinerary_validation_keeps_response_provenance(self):
        waiting, done = threading.Event(), threading.Event()
        class LLM:
            model = 'configured-primary'
            last_model = None
            def generate_structured(self, *args, **kwargs):
                name = threading.current_thread().name
                self.last_model = name
                return StructuredResponse(proposal_fixture(), name, {'total_tokens': 5})
        policy = itinerary_service.load_policy()
        policy['maxRepairCallsPerDay'] = 0
        service = itinerary_service.ItineraryService(catalog_fixture(), LLM(), FakeRouter(), policy=policy)
        validate = itinerary_service.validate_day
        def interleaved(*args, **kwargs):
            if threading.current_thread().name == 'primary-response':
                waiting.set()
                self.assertTrue(done.wait(5))
            return validate(*args, **kwargs)
        results = {}
        def work(name):
            try:
                results[name] = service.generate(request_fixture())
            finally:
                if name == 'fallback-response': done.set()
        with patch.object(itinerary_service, 'validate_day', side_effect=interleaved):
            first = threading.Thread(target=work, args=('primary-response',), name='primary-response')
            second = threading.Thread(target=work, args=('fallback-response',), name='fallback-response')
            first.start()
            self.assertTrue(waiting.wait(5))
            second.start(); second.join(8); first.join(8)
        for name, result in results.items():
            self.assertEqual(result['days'][0]['provenance']['llmModel'], name)
            self.assertEqual(result['days'][0]['provenance']['llmUsage'], {'total_tokens':5})
        self.assertEqual(set(results), {'primary-response','fallback-response'})

    def test_catalog_crlf_and_lf_produce_identical_output(self):
        root = Path(__file__).resolve().parents[2]
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / 'map.js'
            output = Path(directory) / 'catalog.json'
            original = (root / 'map-ui/data/jeju-places.js').read_text(encoding='utf-8')
            source.write_bytes(original.replace('\n', '\r\n').encode('utf-8'))
            result = subprocess.run(['node', str(root/'scripts/build_itinerary_catalog.mjs'), '--source', str(source), '--output', str(output)], capture_output=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(output.read_bytes(), (root/'server/travel-feedback/data/itinerary_catalog.json').read_bytes())
