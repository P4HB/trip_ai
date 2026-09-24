"""HTTP boundary and deployment regressions; no supplier calls or persistent logs."""
import contextlib
import http.client
import importlib.util
import io
import json
import os
import sys
import tempfile
import threading
import unittest
from unittest.mock import patch
from pathlib import Path

ROOT = Path(__file__).parent
spec = importlib.util.spec_from_file_location('itinerary_http_api', ROOT / 'feedback_api.py')
api = importlib.util.module_from_spec(spec)
spec.loader.exec_module(api)

class FakeService:
    def __init__(self):
        self.calls = []
        self.failure = None
    def validate_request(self, payload):
        if not payload.get('travelWindow', {}).get('startDate'):
            raise ValueError('actual_dates_required')
    def generate(self, payload):
        self.calls.append(payload)
        if self.failure:
            raise self.failure
        return {'schemaVersion':'itinerary-result-v1','status':'verification_required',
                'requestId':payload['requestId'],'days':[]}

class ItineraryHTTPTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.service = FakeService()
        self.server = api.FeedbackHTTPServer(('127.0.0.1',0),
            api.FeedbackStore(str(Path(self.temp.name)/'feedback.sqlite3')),
            'http://localhost', itinerary_service=self.service)
        self.thread = threading.Thread(target=self.server.serve_forever,daemon=True)
        self.thread.start()
    def tearDown(self):
        self.server.shutdown(); self.server.server_close(); self.thread.join(); self.temp.cleanup()
    def post(self, payload=None, headers=None, path=api.ITINERARY_PATH):
        body = json.dumps(payload if payload is not None else {
            'requestId':'current', 'travelWindow':{'startDate':'2026-10-01','endDate':'2026-10-01'}})
        connection = http.client.HTTPConnection(*self.server.server_address, timeout=5)
        with contextlib.redirect_stdout(io.StringIO()):
            connection.request('POST',path,body,headers or {'Origin':'http://localhost','Content-Type':'application/json'})
            response = connection.getresponse(); status = response.status; result=json.loads(response.read())
        connection.close()
        return status,result
    def test_separate_endpoint_does_not_write_feedback(self):
        status,body=self.post()
        self.assertEqual(status,200); self.assertEqual(body['requestId'],'current')
        with self.server.store.connect() as connection:
            self.assertEqual(connection.execute('SELECT COUNT(*) FROM feedback_sessions').fetchone()[0],0)
    def test_missing_date_never_generates(self):
        self.assertEqual(self.post({'requestId':'none'})[0],422)
        self.assertEqual(self.service.calls,[])
    def test_exact_origin_required(self):
        for origin in (None,'https://untrusted.example','http://localhost.evil'):
            headers={'Content-Type':'application/json'}
            if origin: headers['Origin']=origin
            self.assertEqual(self.post(headers=headers)[0],403)
        self.assertEqual(self.service.calls,[])
    def test_disabled_and_supplier_failure_are_safe(self):
        self.server.itinerary_service=None
        self.assertEqual(self.post()[1]['error'],'itinerary_not_configured')
        self.server.itinerary_service=self.service
        self.service.failure=RuntimeError('secret header and private prompt')
        _,body=self.post()
        self.assertEqual(body['error'],'itinerary_unavailable')
        self.assertNotIn('secret',json.dumps(body))
    def test_body_and_concurrency_caps(self):
        self.assertEqual(self.post({'large':'x'*65536})[0],413)
        self.server.itinerary_slots.acquire(); self.server.itinerary_slots.acquire()
        self.assertEqual(self.post()[0],429)
        self.server.itinerary_slots.release(); self.server.itinerary_slots.release()
        self.assertEqual(self.service.calls,[])
    def test_global_rate_cap_cannot_be_bypassed_by_forwarded_ip(self):
        self.server.itinerary_minute_limiter=api.MemoryRateLimiter(1)
        self.assertEqual(self.post()[0],200)
        self.assertEqual(self.post(headers={'Origin':'http://localhost','Content-Type':'application/json',
            'X-Travel-Client-IP':'another-ip'})[0],429)
        self.assertEqual(len(self.service.calls),1)
    def test_daily_cap(self):
        self.server.itinerary_daily_limiter=api.MemoryRateLimiter(0,86400)
        self.assertEqual(self.post()[0],429)
        self.assertEqual(self.service.calls,[])
    def test_wrong_path_not_forwarded(self):
        self.assertEqual(self.post(path=api.ITINERARY_PATH+'?sensitive=hidden')[0],404)

class ProxyContracts(unittest.TestCase):
    def test_vercel_scopes_origin_transform_to_exact_path_method_origin(self):
        routes=json.loads((ROOT.parents[1]/'map-ui/vercel.json').read_text())['routes']
        itinerary=[route for route in routes if route.get('src')=='^/travel/api/itineraries$']
        self.assertEqual(len(itinerary),2)
        guarded,fallback=itinerary
        self.assertEqual(guarded['methods'],['POST'])
        self.assertEqual(guarded['has'][0]['value']['eq'],'https://trip-ai-wine-eight.vercel.app')
        self.assertNotIn('transforms',fallback)
        self.assertTrue(guarded['dest'].endswith('/travel/api/itineraries'))

class StartupContracts(unittest.TestCase):
    def test_disabled_never_requires_catalog_or_keys(self):
        with patch.dict(os.environ, {'ITINERARY_ENABLED':'0', 'ITINERARY_CATALOG_PATH':'/missing'}, clear=False):
            self.assertIsNone(api.load_itinerary_service())

    def test_stale_sidecar_disables_only_itinerary(self):
        sys.path.insert(0, str(ROOT))
        try:
            with tempfile.TemporaryDirectory() as directory:
                catalog=Path(directory)/'catalog.json'; insights=Path(directory)/'insights.json'
                catalog.write_text(json.dumps({'schemaVersion':'itinerary-catalog-v1','places':[], 'reviewVersion':'old'}))
                insights.write_text(json.dumps({'version':'new', 'places':{}}))
                with patch.dict(os.environ, {'ITINERARY_ENABLED':'1','ITINERARY_CATALOG_PATH':str(catalog),
                     'ITINERARY_INSIGHTS_PATH':str(insights)}, clear=False), contextlib.redirect_stdout(io.StringIO()):
                    self.assertIsNone(api.load_itinerary_service())
                    catalog.write_text('{"schemaVersion":"itinerary-catalog-v1","places":[{}]}')
                    insights.write_text('null')
                    self.assertIsNone(api.load_itinerary_service())
        finally:
            sys.path.pop(0)

if __name__=='__main__': unittest.main()
