#!/usr/bin/env python3
"""Writes icons/distro-<slug>.svg from a Simple Icons package (npm pack simple-icons).

  python3 -I tools/make_distro_logos.py <path to the unpacked simple-icons package>

Each logo is the Simple Icons path, unaltered, in its brand color, on the 64x64 canvas the
other icons use. Logos are trademarks of their projects; see icons/LOGOS.md."""
import json
import os
import re
import sys

# Simple Icons slug -> name shown in the settings panel. Keep in step with Icons.js LOGOS.
DISTROS = [
    ("debian", "Debian"), ("ubuntu", "Ubuntu"), ("fedora", "Fedora"),
    ("linuxmint", "Linux Mint"), ("opensuse", "openSUSE"), ("manjaro", "Manjaro"),
    ("endeavouros", "EndeavourOS"), ("gentoo", "Gentoo"), ("voidlinux", "Void"),
    ("nixos", "NixOS"), ("alpinelinux", "Alpine"), ("popos", "Pop!_OS"),
    ("elementary", "elementary OS"), ("zorin", "Zorin OS"), ("kalilinux", "Kali"),
    ("rockylinux", "Rocky Linux"), ("almalinux", "AlmaLinux"), ("redhat", "Red Hat"),
    ("centos", "CentOS"), ("slackware", "Slackware"), ("linux", "Tux"),
]


def slug_of(icon):
    if icon.get("slug"):
        return icon["slug"]
    return re.sub(r"[^a-z0-9]", "", icon["title"].lower().replace("+", "plus"))


def main(package, out):
    data = json.load(open(os.path.join(package, "_data", "simple-icons.json")))
    icons = data["icons"] if isinstance(data, dict) else data
    by_slug = {slug_of(i): i for i in icons}
    for slug, _name in DISTROS:
        svg = open(os.path.join(package, "icons", slug + ".svg")).read()
        path = re.search(r'<path d="([^"]+)"', svg).group(1)
        color = "#" + by_slug[slug]["hex"].lower()
        with open(os.path.join(out, "distro-" + slug + ".svg"), "w") as f:
            f.write('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">'
                    '<path transform="translate(2 2) scale(2.5)" fill="' + color + '" d="' + path + '"/></svg>\n')
        print(slug, color)


if __name__ == "__main__":
    here = os.path.dirname(os.path.abspath(__file__))
    main(sys.argv[1], os.path.join(here, "..", "icons"))
