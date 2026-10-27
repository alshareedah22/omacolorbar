#!/usr/bin/env python3
"""Writes icons/*.svg, OmaColorBar's fixed icons, in one style: a two-stop gradient per
widget, a soft shadow (the same shapes in black at 35%), 64x64. Run it after changing a
shape or a color; the generated files are committed."""
import os
import re

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "icons")
DIM = "#3b4252"
MUTE = "#6b7280"
SLASH = "#f43f5e"
CASE = "#45475a"

PALETTE = {
    "network": ("#0ea5e9", "#22d3ee", "#a5f3fc"),
    "bluetooth": ("#2563eb", "#60a5fa", "#dbeafe"),
    "audio": ("#f97316", "#fbbf24", "#fde68a"),
    "mic": ("#e11d48", "#fb7185", "#fecdd3"),
    "display": ("#7c3aed", "#38bdf8", "#c4b5fd"),
    "update": ("#10b981", "#6ee7b7", "#d1fae5"),
    "agents": ("#8b5cf6", "#ec4899", "#fce7f3"),
    "tailscale": ("#64748b", "#e2e8f0", "#ffffff"),
    "warning": ("#f59e0b", "#fcd34d", "#78350f"),
    "omarchy": ("#c8e69c", "#5e9a35", "#a8cd76"),
}


def gradient(gid, start, end):
    # userSpaceOnUse: a straight stroke has no width, so a bounding-box gradient vanishes
    return (f'<linearGradient id="{gid}" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="64" y2="64">'
            f'<stop offset="0" stop-color="{start}"/><stop offset="1" stop-color="{end}"/></linearGradient>')


def icon(palette, body):
    a, b, c = PALETTE[palette]
    body = body.replace("ACCENT", c)
    shadow = re.sub(r'(fill|stroke)="(?!none)[^"]*"', r'\1="#000"', body)
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">'
            f'<defs>{gradient("a", a, b)}{gradient("b", b, a)}</defs>'
            f'<g opacity=".35" transform="translate(1.5 1.5)">{shadow}</g>{body}</svg>\n')


SLASH_LINE = f'<path d="M12 10 L52 54" fill="none" stroke="{SLASH}" stroke-width="6" stroke-linecap="round"/>'
ARCS = ["M23 42 a14 14 0 0 1 18 0 l-9 10 z",
        "M14.5 33 a26 26 0 0 1 35 0 l-5.5 6 a18 18 0 0 0 -24 0 z",
        "M6 24 a38 38 0 0 1 52 0 l-5.5 6 a30 30 0 0 0 -41 0 z"]
RUNE = 'M23 21 l18 16 -9 8 V19 l9 8 -18 16'
SPEAKER = '<path d="M6 24 h10 l14 -12 v40 l-14 -12 h-10 z" fill="url(#a)"/>'
MIC = ('<rect x="21" y="4" width="22" height="36" rx="11" fill="{f}"/>'
       '<path d="M13 30 a19 19 0 0 0 38 0" fill="none" stroke="{s}" stroke-width="4.5" stroke-linecap="round"/>'
       '<path d="M32 49 V58 M24 58 H40" fill="none" stroke="{s}" stroke-width="4.5" stroke-linecap="round"/>')
STAND = f'<path d="M24 54 h16 l-3 -8 h-10 z" fill="{CASE}"/><rect x="18" y="54" width="28" height="4" rx="2" fill="{CASE}"/>'
DOTS = [(x, y) for y in (14, 32, 50) for x in (14, 32, 50)]


def dots(fill_for):
    return "".join(f'<circle cx="{x}" cy="{y}" r="6" fill="{fill_for(x, y)}"/>' for x, y in DOTS)


# Omarchy's menu mark, traced from the Omarchy font's U+E900 glyph.
OMARCHY_RECTS = [(0, 0, 64, 4.4), (0, 59.6, 34.4, 4.4), (39.2, 59.6, 24.8, 4.4), (0, 0, 4.4, 64), (59.6, 0, 4.4, 64),
                 (29.6, 0, 4.8, 12.8), (8.8, 8.8, 25.6, 4), (45.6, 8.8, 9.6, 4), (8.8, 8.8, 4, 46.4),
                 (0, 29.6, 12.8, 4.8), (51.2, 8.8, 4, 46.4), (8.8, 51.2, 46.4, 4), (29.6, 51.2, 4.8, 12.8)]

# The Arch Linux logo, unaltered (from archlinux-logo.svg in the filesystem package).
ARCH_PATH = ("m127.98 12.07c-10.316 25.309-16.543 41.855-28.031 66.41 7.043 7.4609 15.691 16.156 29.734 25.977-15.098-6.207"
             "-25.395-12.445-33.094-18.918-14.703 30.68-37.742 74.391-84.492 158.39 36.746-21.219 65.23-34.293 91.773-39.289"
             "-1.1406-4.8945-1.7852-10.195-1.7422-15.734l0.042969-1.1719c0.58203-23.551 12.828-41.645 27.336-40.418 14.508 "
             "1.2266 25.781 21.316 25.199 44.867-0.10938 4.4219-0.60938 8.6914-1.4805 12.641 26.258 5.1328 54.438 18.18 90.684 "
             "39.105-7.1484-13.156-13.527-25.016-19.621-36.316-9.5938-7.4336-19.605-17.117-40.023-27.594 14.035 3.6406 24.082 "
             "7.8516 31.914 12.555-61.941-115.32-66.957-130.66-88.199-180.5z")

ICONS = {
    "menu-omarchy": lambda: icon("omarchy", "".join(
        f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="url(#a)"/>' for x, y, w, h in OMARCHY_RECTS)),
    "menu-arch": lambda: ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">'
                          f'<path fill="#1793d1" fill-rule="evenodd" d="{ARCH_PATH}"/></svg>\n'),
    "ethernet": lambda: icon("network",
        '<rect x="8" y="10" width="48" height="40" rx="7" fill="url(#a)"/>'
        '<path d="M18 22 h28 v14 h-5 v5 h-18 v-5 h-5 z" fill="#0b3a53"/>'
        + "".join(f'<rect x="{x}" y="24" width="3" height="6" rx="1" fill="ACCENT"/>' for x in (22, 27, 32, 37))
        + '<rect x="26" y="50" width="12" height="8" fill="url(#b)"/>'
        '<rect x="14" y="13" width="20" height="3" rx="1.5" fill="#ffffff" opacity=".45"/>'),
    "offline": lambda: icon("network", "".join(f'<path d="{d}" fill="{DIM}"/>' for d in ARCS) + SLASH_LINE),
    "bt-on": lambda: icon("bluetooth",
        '<rect x="14" y="4" width="36" height="56" rx="18" fill="url(#a)"/>'
        f'<path d="{RUNE}" fill="none" stroke="#ffffff" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>'),
    "bt-connected": lambda: icon("bluetooth",
        '<rect x="14" y="4" width="36" height="56" rx="18" fill="url(#a)"/>'
        f'<path d="{RUNE}" fill="none" stroke="#ffffff" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>'
        '<circle cx="6" cy="32" r="4" fill="ACCENT"/><circle cx="58" cy="32" r="4" fill="ACCENT"/>'),
    "bt-off": lambda: icon("bluetooth",
        f'<rect x="14" y="4" width="36" height="56" rx="18" fill="{DIM}"/>'
        f'<path d="{RUNE}" fill="none" stroke="{MUTE}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>'
        + SLASH_LINE),
    "headphones": lambda: icon("audio",
        '<path d="M10 40 V32 a22 22 0 0 1 44 0 V40" fill="none" stroke="url(#a)" stroke-width="6" stroke-linecap="round"/>'
        '<rect x="5" y="36" width="15" height="22" rx="6" fill="url(#b)"/><rect x="44" y="36" width="15" height="22" rx="6" fill="url(#b)"/>'),
    "muted": lambda: icon("audio", SPEAKER +
        f'<path d="M40 24 l16 16 M56 24 l-16 16" fill="none" stroke="{SLASH}" stroke-width="5" stroke-linecap="round"/>'),
    "mic-on": lambda: icon("mic", MIC.format(f="url(#a)", s="url(#b)")
        + '<rect x="26" y="10" width="5" height="14" rx="2.5" fill="#ffffff" opacity=".55"/>'),
    "mic-off": lambda: icon("mic", MIC.format(f=DIM, s=MUTE) + SLASH_LINE),
    "monitor-one": lambda: icon("display",
        '<rect x="5" y="8" width="54" height="38" rx="5" fill="url(#a)"/>'
        '<rect x="10" y="13" width="44" height="28" rx="2" fill="url(#b)" opacity=".55"/>' + STAND),
    "monitor-many": lambda: icon("display",
        '<rect x="22" y="4" width="38" height="26" rx="4" fill="url(#b)"/>'
        '<rect x="4" y="16" width="42" height="30" rx="4" fill="url(#a)"/>' + STAND),
    "update": lambda: icon("update",
        '<path d="M50 26 A19 19 0 0 0 15 22" fill="none" stroke="url(#a)" stroke-width="6" stroke-linecap="round"/>'
        '<path d="M8 14 L15 24 L25 18" fill="none" stroke="url(#a)" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>'
        '<path d="M14 38 A19 19 0 0 0 49 42" fill="none" stroke="url(#b)" stroke-width="6" stroke-linecap="round"/>'
        '<path d="M56 50 L49 40 L39 46" fill="none" stroke="url(#b)" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>'),
    "agents": lambda: icon("agents",
        '<path d="M32 7 V15" fill="none" stroke="url(#b)" stroke-width="4" stroke-linecap="round"/>'
        '<circle cx="32" cy="6" r="3.5" fill="ACCENT"/>'
        '<rect x="8" y="14" width="48" height="40" rx="12" fill="url(#a)"/>'
        '<rect x="15" y="24" width="34" height="18" rx="9" fill="#1e1b4b"/>'
        '<circle cx="25" cy="33" r="4" fill="ACCENT"/><circle cx="39" cy="33" r="4" fill="ACCENT"/>'
        '<rect x="2" y="28" width="6" height="12" rx="3" fill="url(#b)"/><rect x="56" y="28" width="6" height="12" rx="3" fill="url(#b)"/>'),
    "tailscale-on": lambda: icon("tailscale", dots(lambda x, y: "ACCENT" if y == 32 else "url(#a)")),
    "tailscale-off": lambda: icon("tailscale", dots(lambda x, y: DIM) + SLASH_LINE),
    "tailscale-login": lambda: icon("tailscale", dots(lambda x, y: "url(#a)")
        + '<circle cx="50" cy="50" r="12" fill="#f59e0b"/>'
        '<path d="M50 43 V51" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round"/>'
        '<circle cx="50" cy="56.5" r="2.2" fill="#ffffff"/>'),
    "warning": lambda: icon("warning",
        '<path d="M32 6 L60 56 H4 Z" fill="url(#a)" stroke="url(#a)" stroke-width="4" stroke-linejoin="round"/>'
        '<path d="M32 24 V38" fill="none" stroke="ACCENT" stroke-width="6" stroke-linecap="round"/>'
        '<circle cx="32" cy="47" r="3.5" fill="ACCENT"/>'),
}


def main():
    os.makedirs(OUT, exist_ok=True)
    for name, make in ICONS.items():
        with open(os.path.join(OUT, name + ".svg"), "w") as f:
            f.write(make())
    print(f"wrote {len(ICONS)} icons to {os.path.normpath(OUT)}")


if __name__ == "__main__":
    main()
