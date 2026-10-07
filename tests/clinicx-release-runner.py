"""Offline aggregate contract tests. Never starts children, databases or network."""
import ast
import importlib.util
from pathlib import Path
import unittest
ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('release', ROOT/'scripts/clinicx-release-verify.py')
release = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(release)

class RunnerContracts(unittest.TestCase):
    def test_all_new_workstream_runners_are_reviewed_before_execution(self):
        for name in ['test-clinicx-admin.cjs','test-clinicx-admin-db.py','test-clinicx-admin-readbacks.cjs',
                     'test-clinicx-engagement.cjs','test-clinicx-engagement-db.py',
                     'test-clinicx-recurring.cjs','test-clinicx-recurring-db.py',
                     'test-clinicx-recurring-handlers.cjs','test-clinicx-recurring-integration.cjs']:
            self.assertIn(name, release.REVIEWED, name)
    def test_zero_test_setup_error_does_not_invent_passes(self):
        counts=release.parse_counts('Ran 0 tests in 0.001s\nFAILED (errors=1)', 'unittest', 1)
        self.assertEqual((counts['tests'],counts['passed'],counts['errors']),(0,0,1))
    def test_failures_and_assertions_are_not_discovered_e2e(self):
        self.assertIsNone(release.parse_counts('Total: 5 tests', 'discovery', 0)['passed'])
        self.assertEqual(release.parse_counts('# tests 3\n# pass 2\n# fail 1', 'node', 1)['failed'],1)
    def test_sensitive_output_is_sanitized(self):
        value=release.sanitize('postgres://sensitive:secret@remote/db\nAuthorization: bearer private\nAPI_KEY=private')
        self.assertNotIn('private',value); self.assertNotIn('sensitive',value)
    def test_fresh_input_snapshot_includes_documentation_and_runner_hash_provenance(self):
        tree=ast.parse((ROOT/'scripts/clinicx-release-verify.py').read_text())
        assignments=[n for n in ast.walk(tree) if isinstance(n,ast.Assign)]
        inputs=next(ast.literal_eval(n.value) for n in assignments if any(isinstance(t,ast.Name) and t.id=='inputs' for t in n.targets))
        self.assertIn('docs',inputs)
        self.assertIn('aggregate_runner_sha256',(ROOT/'scripts/clinicx-release-verify.py').read_text())

if __name__=='__main__': unittest.main(verbosity=2)
