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
    def test_swaps_weather_and_leaves_indicators_alone(self):
        config = {"bar": {"layout": {"left": [], "center": [
            {"id": "omarchy.indicators", "alwaysShow": True}, {"id": "omarchy.weather"}], "right": []}}}
        out = colorbar.swapped(config)
        self.assertEqual(out["bar"]["layout"]["center"], [
            {"id": "omarchy.indicators", "alwaysShow": True},
            {"id": "blackcode.omacolorbar", "icon": "omarchy.weather"}])
        self.assertFalse(any(e.get("id") == "omarchy.indicators" for e in out.get("plugins", [])))

    def test_swaps_the_tray(self):
        config = {"bar": {"layout": {"left": [], "center": [], "right": [{"id": "omarchy.tray", "pinned": ["a"]}]}}}
        out = colorbar.swapped(config)
        self.assertEqual(out["bar"]["layout"]["right"], [{"id": "blackcode.omacolorbar", "icon": "omarchy.tray"}])
        self.assertIn({"id": "omarchy.tray", "pinned": ["a"]}, out["plugins"])

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

    def test_backup_keeps_the_file_mode(self):
        os.chmod(self.path, 0o600)
        self.run_cli("swap", self.path)
        self.assertEqual(os.stat(self.path + ".omacolorbar-backup").st_mode & 0o777, 0o600)

    def test_force_keeps_the_existing_backup_and_restores_the_original(self):
        backup = self.path + ".omacolorbar-backup"
        self.assertEqual(self.run_cli("swap", self.path).returncode, 0)
        with open(self.path) as f:
            config = json.load(f)
        config["bar"]["layout"]["right"].append({"id": "omarchy.network"})
        with open(self.path, "w") as f:
            json.dump(config, f)
        r = self.run_cli("swap", self.path, "--force")
        self.assertEqual(r.returncode, 0)
        self.assertIn("kept", r.stdout)
        with open(backup, "rb") as f:
            self.assertEqual(f.read(), self.original)
        self.assertEqual(self.run_cli("restore", self.path).returncode, 0)
        with open(self.path, "rb") as f:
            self.assertEqual(f.read(), self.original)

    def test_nothing_to_swap_writes_nothing(self):
        cases = [{"bar": {"layout": {"left": [{"id": "omarchy.clock"}]}}}, {"idle": {}}, {"bar": {}}]
        for config in cases:
            with open(self.path, "w") as f:
                json.dump(config, f)
            with open(self.path, "rb") as f:
                before = f.read()
            r = self.run_cli("swap", self.path)
            self.assertEqual(r.returncode, 0)
            self.assertIn("nothing to swap", r.stdout)
            self.assertFalse(os.path.exists(self.path + ".omacolorbar-backup"))
            with open(self.path, "rb") as f:
                self.assertEqual(f.read(), before)

    def test_restore_says_later_changes_are_replaced(self):
        self.run_cli("swap", self.path)
        r = self.run_cli("restore", self.path)
        self.assertEqual(r.returncode, 0)
        self.assertIn("replaced", r.stdout)
        self.assertIn("Omarchy", r.stdout)

    def test_malformed_shape_fails_cleanly_without_a_backup(self):
        backup = self.path + ".omacolorbar-backup"
        cases = [
            {"bar": {"layout": "oops"}},
            {"bar": {"layout": {"right": "oops"}}},
            {"bar": {"layout": {"left": None}}},
            {"plugins": {"id": "omarchy.audio"}},
        ]
        for bad in cases:
            with self.subTest(bad=bad):
                text = json.dumps(bad, indent=2) + "\n"
                with open(self.path, "w") as f:
                    f.write(text)
                r = self.run_cli("swap", self.path)
                self.assertEqual(r.returncode, 1)
                self.assertNotIn("Traceback", r.stderr)
                self.assertFalse(os.path.exists(backup))
                with open(self.path) as f:
                    self.assertEqual(f.read(), text)

    def test_symlinked_shell_json_stays_a_symlink(self):
        real = os.path.join(self.dir.name, "real-shell.json")
        os.rename(self.path, real)
        os.symlink(real, self.path)
        self.assertEqual(self.run_cli("swap", self.path).returncode, 0)
        self.assertTrue(os.path.islink(self.path))
        with open(real) as f:
            self.assertEqual(json.load(f)["bar"]["layout"]["left"][0]["icon"], "omarchy.menu")
        self.assertEqual(self.run_cli("restore", self.path).returncode, 0)
        self.assertTrue(os.path.islink(self.path))
        with open(real, "rb") as f:
            self.assertEqual(f.read(), self.original)


class UnswapTest(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.TemporaryDirectory()
        self.addCleanup(self.dir.cleanup)
        self.path = os.path.join(self.dir.name, "shell.json")

    def write(self, config):
        with open(self.path, "w") as f:
            json.dump(config, f, indent=2)
            f.write("\n")

    def read(self):
        with open(self.path) as f:
            return json.load(f)

    def run_cli(self, *args):
        return subprocess.run([sys.executable, "-I", SCRIPT, *args], capture_output=True, text=True)

    def safety_copies(self):
        return [n for n in os.listdir(self.dir.name) if ".omacolorbar-unswap-" in n]

    def test_swap_then_unswap_keeps_positions_and_later_changes(self):
        self.write(SAMPLE)
        self.run_cli("swap", self.path)
        config = self.read()
        config["idle"] = {"x": 2}
        self.write(config)
        r = self.run_cli("unswap", self.path)
        self.assertEqual(r.returncode, 0, r.stderr)
        out = self.read()
        self.assertEqual(out["bar"]["layout"]["left"], [{"id": "omarchy.menu"}, {"id": "omarchy.workspaces"}])
        self.assertEqual([e["id"] for e in out["bar"]["layout"]["right"]],
                         ["blackcode.omadbngin", "omarchy.power", "omarchy.audio", "someone.unknown"])
        self.assertEqual(out["idle"], {"x": 2})
        self.assertEqual(out["plugins"][0], {"id": "omarchy.audio", "step": 5})

    def test_other_entries_and_keys_untouched_and_copy_keys_dropped(self):
        config = {"bar": {"position": "top", "layout": {
            "left": [{"id": "omarchy.clock", "format": "HH:mm"},
                     {"id": "blackcode.omacolorbar", "icon": "omarchy.menu", "menuLogo": "x"}],
            "center": [],
            "right": [{"id": "blackcode.omacolorbar", "icon": "omarchy.tray", "openApps": True,
                       "openAppsLimit": 3, "hiddenApps": ["a"], "showTerminals": True},
                      {"id": "someone.unknown", "k": 1}]}}, "idle": {"x": 1}}
        self.write(config)
        self.assertEqual(self.run_cli("unswap", self.path).returncode, 0)
        out = self.read()
        self.assertEqual(out["bar"]["layout"]["left"], [{"id": "omarchy.clock", "format": "HH:mm"}, {"id": "omarchy.menu"}])
        self.assertEqual(out["bar"]["layout"]["right"], [{"id": "omarchy.tray"}, {"id": "someone.unknown", "k": 1}])
        self.assertEqual(out["bar"]["position"], "top")
        self.assertEqual(out["idle"], {"x": 1})

    def test_bare_entry_becomes_network_or_is_dropped(self):
        self.write({"bar": {"layout": {"left": [], "center": [], "right": [{"id": "blackcode.omacolorbar"}]}}})
        self.assertEqual(self.run_cli("unswap", self.path).returncode, 0)
        self.assertEqual(self.read()["bar"]["layout"]["right"], [{"id": "omarchy.network"}])
        self.write({"bar": {"layout": {"left": [{"id": "omarchy.network"}], "center": [],
                                       "right": [{"id": "blackcode.omacolorbar"}, {"id": "omarchy.audio"}]}}})
        self.assertEqual(self.run_cli("unswap", self.path).returncode, 0)
        out = self.read()
        self.assertEqual(out["bar"]["layout"]["left"], [{"id": "omarchy.network"}])
        self.assertEqual(out["bar"]["layout"]["right"], [{"id": "omarchy.audio"}])

    def test_no_copies_does_nothing(self):
        self.write(SAMPLE)
        with open(self.path, "rb") as f:
            before = f.read()
        r = self.run_cli("unswap", self.path)
        self.assertEqual(r.returncode, 0)
        self.assertIn("nothing to unswap", r.stdout)
        with open(self.path, "rb") as f:
            self.assertEqual(f.read(), before)
        self.assertEqual(self.safety_copies(), [])

    def test_invalid_json_is_refused(self):
        with open(self.path, "w") as f:
            f.write("{not json")
        r = self.run_cli("unswap", self.path)
        self.assertEqual(r.returncode, 1)
        self.assertNotIn("Traceback", r.stderr)
        with open(self.path) as f:
            self.assertEqual(f.read(), "{not json")
        self.assertEqual(self.safety_copies(), [])

    def test_safety_copy_is_the_previous_file_and_mode_kept(self):
        self.write(SAMPLE)
        self.run_cli("swap", self.path)
        os.chmod(self.path, 0o640)
        with open(self.path, "rb") as f:
            before = f.read()
        self.assertEqual(self.run_cli("unswap", self.path).returncode, 0)
        copies = self.safety_copies()
        self.assertEqual(len(copies), 1)
        with open(os.path.join(self.dir.name, copies[0]), "rb") as f:
            self.assertEqual(f.read(), before)
        self.assertEqual(os.stat(self.path).st_mode & 0o777, 0o640)

    def test_swap_backup_is_untouched(self):
        self.write(SAMPLE)
        self.run_cli("swap", self.path)
        backup = self.path + ".omacolorbar-backup"
        with open(backup, "rb") as f:
            before = f.read()
        self.assertEqual(self.run_cli("unswap", self.path).returncode, 0)
        with open(backup, "rb") as f:
            self.assertEqual(f.read(), before)

    def test_restore_refuses_an_invalid_backup(self):
        self.write(SAMPLE)
        with open(self.path, "rb") as f:
            before = f.read()
        backup = self.path + ".omacolorbar-backup"
        for text in ("{broken", "[]", '{"bar": {}}', '{"bar": {"layout": []}}'):
            with self.subTest(text=text):
                with open(backup, "w") as f:
                    f.write(text)
                r = self.run_cli("restore", self.path)
                self.assertEqual(r.returncode, 1)
                self.assertNotIn("Traceback", r.stderr)
                self.assertIn("unswap", r.stderr)
                self.assertTrue(os.path.exists(backup))
                with open(self.path, "rb") as f:
                    self.assertEqual(f.read(), before)


class ManifestSyncTest(unittest.TestCase):
    def test_supported_matches_the_manifest_icon_options(self):
        with open(os.path.join(HERE, "..", "manifest.json")) as f:
            manifest = json.load(f)
        icon = next(s for s in manifest["barWidget"]["schema"] if s["key"] == "icon")
        self.assertEqual(colorbar.SUPPORTED, icon["options"])


if __name__ == "__main__":
    unittest.main()
