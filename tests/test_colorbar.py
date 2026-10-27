import importlib.machinery
import importlib.util
import json
import os
import subprocess
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPT = os.path.join(HERE, "..", "colorbar")
loader = importlib.machinery.SourceFileLoader("colorbar", SCRIPT)
spec = importlib.util.spec_from_loader("colorbar", loader)
colorbar = importlib.util.module_from_spec(spec)
loader.exec_module(colorbar)

SAMPLE = {
    "bar": {"position": "top", "layout": {
        "left": [{"id": "omarchy.menu"}, {"id": "omarchy.workspaces"}],
        "center": [{"id": "omarchy.clock", "format": "HH:mm"}],
        "right": [{"id": "blackcode.omadbngin", "label": "Icon only"}, {"id": "omarchy.power", "showPercentage": True},
                  {"id": "omarchy.audio"}, {"id": "someone.unknown"}]}},
    "idle": {"x": 1},
    "plugins": [{"id": "omarchy.audio", "step": 5}],
}


class SwappedTest(unittest.TestCase):
    def test_swaps_supported_ids_in_place(self):
        out = colorbar.swapped(SAMPLE)
        self.assertEqual(out["bar"]["layout"]["left"][0], {"id": "blackcode.omacolorbar", "icon": "omarchy.menu"})
        self.assertEqual([e.get("icon", e["id"]) for e in out["bar"]["layout"]["right"]],
                         ["blackcode.omadbngin", "omarchy.power", "omarchy.audio", "someone.unknown"])
        self.assertEqual(out["bar"]["layout"]["right"][1], {"id": "blackcode.omacolorbar", "icon": "omarchy.power"})

    def test_leaves_everything_else_alone(self):
        out = colorbar.swapped(SAMPLE)
        self.assertEqual(out["bar"]["layout"]["left"][1], {"id": "omarchy.workspaces"})
        self.assertEqual(out["bar"]["layout"]["center"], SAMPLE["bar"]["layout"]["center"])
        self.assertEqual(out["bar"]["layout"]["right"][0], {"id": "blackcode.omadbngin", "label": "Icon only"})
        self.assertEqual(out["bar"]["layout"]["right"][3], {"id": "someone.unknown"})
        self.assertEqual(out["idle"], {"x": 1})
        self.assertEqual(out["bar"]["position"], "top")

    def test_settings_move_to_plugins(self):
        plugins = {p["id"]: p for p in colorbar.swapped(SAMPLE)["plugins"]}
        self.assertEqual(plugins["omarchy.power"], {"id": "omarchy.power", "showPercentage": True})
        self.assertEqual(plugins["omarchy.audio"], {"id": "omarchy.audio", "step": 5})
        self.assertEqual(plugins["omarchy.menu"], {"id": "omarchy.menu"})

    def test_does_not_change_its_input_and_is_idempotent(self):
        before = json.dumps(SAMPLE, sort_keys=True)
        once = colorbar.swapped(SAMPLE)
        self.assertEqual(json.dumps(SAMPLE, sort_keys=True), before)
        self.assertEqual(colorbar.swapped(once), once)


class CliTest(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.TemporaryDirectory()
        self.addCleanup(self.dir.cleanup)
        self.path = os.path.join(self.dir.name, "shell.json")
        with open(self.path, "w") as f:
            json.dump(SAMPLE, f, indent=2)
            f.write("\n")
        with open(self.path, "rb") as f:
            self.original = f.read()

    def run_cli(self, *args):
        return subprocess.run([sys.executable, "-I", SCRIPT, *args], capture_output=True, text=True)

    def test_swap_then_restore_is_byte_identical(self):
        self.assertEqual(self.run_cli("swap", self.path).returncode, 0)
        with open(self.path) as f:
            self.assertEqual(json.load(f)["bar"]["layout"]["left"][0]["icon"], "omarchy.menu")
        self.assertTrue(os.path.exists(self.path + ".omacolorbar-backup"))
        self.assertEqual(self.run_cli("restore", self.path).returncode, 0)
        with open(self.path, "rb") as f:
            self.assertEqual(f.read(), self.original)
        self.assertFalse(os.path.exists(self.path + ".omacolorbar-backup"))

    def test_swap_refuses_to_overwrite_a_backup(self):
        self.run_cli("swap", self.path)
        r = self.run_cli("swap", self.path)
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("backup", r.stderr)
        self.assertEqual(self.run_cli("swap", self.path, "--force").returncode, 0)

    def test_restore_without_backup_fails(self):
        r = self.run_cli("restore", self.path)
        self.assertNotEqual(r.returncode, 0)
        with open(self.path, "rb") as f:
            self.assertEqual(f.read(), self.original)

    def test_keeps_the_file_mode(self):
        os.chmod(self.path, 0o600)
        self.run_cli("swap", self.path)
        self.assertEqual(os.stat(self.path).st_mode & 0o777, 0o600)


class ManifestSyncTest(unittest.TestCase):
    def test_supported_matches_the_manifest_icon_options(self):
        with open(os.path.join(HERE, "..", "manifest.json")) as f:
            manifest = json.load(f)
        icon = next(s for s in manifest["barWidget"]["schema"] if s["key"] == "icon")
        self.assertEqual(colorbar.SUPPORTED, icon["options"])


if __name__ == "__main__":
    unittest.main()
