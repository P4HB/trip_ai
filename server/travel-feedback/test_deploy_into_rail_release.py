import importlib.util
from pathlib import Path
import unittest


MODULE_PATH = Path(__file__).with_name("deploy_into_rail_release.py")
SPEC = importlib.util.spec_from_file_location("travel_feedback_deploy", MODULE_PATH)
assert SPEC and SPEC.loader
DEPLOY = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(DEPLOY)


class ConfigureReferrerPolicyTest(unittest.TestCase):
    def test_existing_api_route_upgraded_and_idempotent(self):
        result = DEPLOY.configure_itinerary_route(DEPLOY.PRE_ITINERARY_CADDY_BLOCK)
        self.assertEqual(result, DEPLOY.CADDY_BLOCK)
        self.assertEqual(DEPLOY.configure_itinerary_route(result), result)
        self.assertIn('/travel/api/places/*/reviews', result)
        self.assertIn('header_up X-Travel-Client-IP {remote_host}', result)

    def test_sidecar_upgrade_preserves_other_settings(self):
        old = DEPLOY.SERVICE_BLOCK
        old = '\n'.join(line for line in old.split('\n') if not any(key in line for key in (
            'ITINERARY_', 'OPENAI_API_KEY', 'KAKAO_MOBILITY_API_KEY')))
        old = old.replace('    mem_limit: 192m', '    mem_limit: 256m')
        source = 'services:\n' + old + '  edge:\n    image: custom-edge\nvolumes:\n  data:\n'
        result = DEPLOY.configure_itinerary_service(source)
        self.assertIn('ITINERARY_ENABLED: ${ITINERARY_ENABLED:-0}', result)
        self.assertIn('    mem_limit: 256m', result)
        self.assertTrue(result.endswith('  edge:\n    image: custom-edge\nvolumes:\n  data:\n'))
        self.assertEqual(result, DEPLOY.configure_itinerary_service(result))

    def test_splits_travel_and_non_travel_policies(self):
        source = """example.test {
\troute {
\t\theader {
\t\t\tReferrer-Policy "same-origin"
\t\t}
\t}
}
"""

        configured = DEPLOY.configure_referrer_policy(source)

        self.assertIn(
            '\t\theader @travel_referrer_policy Referrer-Policy "strict-origin-when-cross-origin"',
            configured,
        )
        self.assertIn(
            '\t\theader @non_travel_referrer_policy Referrer-Policy "same-origin"',
            configured,
        )
        self.assertNotIn(DEPLOY.GLOBAL_REFERRER_POLICY, configured)

    def test_is_idempotent(self):
        source = """example.test {
\troute {
""" + DEPLOY.TRAVEL_REFERRER_POLICY_BLOCK + """\t\theader {
\t\t}
\t}
}
"""

        self.assertEqual(source, DEPLOY.configure_referrer_policy(source))

    def test_rejects_ambiguous_missing_anchor(self):
        with self.assertRaisesRegex(RuntimeError, "global Referrer-Policy"):
            DEPLOY.configure_referrer_policy("example.test {}\n")


if __name__ == "__main__":
    unittest.main()
