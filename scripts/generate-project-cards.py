#!/usr/bin/env python3
"""Regenerate the profile's project cards. Python standard library only."""
import html
import json
from pathlib import Path

PROJECTS = json.loads(r'''[
  {
    "slug": "small-tool-workshop",
    "repo": "small-tool-design-workshop",
    "title": "Small Tool Workshop",
    "alt": "Small Tool Design Workshop — high-fidelity HTML prototypes",
    "category": "DESIGN & PROTOTYPING",
    "kind": "AGENT SKILL",
    "tag": "HTML PROTOTYPES",
    "icon": "layout",
    "lines": [
      "From a rough idea to a polished prototype.",
      "Design the visuals, interactions and handoff."
    ]
  },
  {
    "slug": "reading-yearbook",
    "repo": "reading-book-skill",
    "title": "Reading Yearbook",
    "alt": "年年阅 / Reading Yearbook — offline reading yearbooks and share cards",
    "category": "READING & SHARING",
    "kind": "AGENT SKILL",
    "tag": "年年阅",
    "icon": "book",
    "lines": [
      "Turn reading records into a personal yearbook.",
      "Browse offline. Export cards worth sharing."
    ]
  },
  {
    "slug": "fitness-coach",
    "repo": "healthy-fitness-coach-skill",
    "title": "Healthy Fitness Coach",
    "alt": "Healthy Fitness Coach — training, nutrition, recovery and progress reviews",
    "category": "TRAINING & RECOVERY",
    "kind": "AGENT SKILL",
    "tag": "PERSONAL TRAINING",
    "icon": "fitness",
    "lines": [
      "Personal training, nutrition and recovery.",
      "Review your progress. Adjust your next plan."
    ]
  },
  {
    "slug": "image-prompt-crafter",
    "repo": "image-prompt-crafter-skill",
    "title": "Image Prompt Crafter",
    "alt": "Image Prompt Crafter — image prompts, diagnosis and iteration",
    "category": "VISUAL CREATION",
    "kind": "AGENT SKILL",
    "tag": "IMAGE PROMPTS",
    "icon": "sparkles",
    "lines": [
      "Turn the picture in your head into a prompt.",
      "Refine the idea. Diagnose what went wrong."
    ]
  },
  {
    "slug": "hand-drawn-flow",
    "repo": "hand-drawn-flow-skill",
    "title": "Hand-Drawn Flow",
    "alt": "Hand-Drawn Flow — hand-drawn diagrams from text and documents (preview)",
    "category": "DIAGRAMS & EXPLANATIONS",
    "kind": "AGENT SKILL · PREVIEW",
    "tag": "HAND-DRAWN DIAGRAMS",
    "icon": "flow",
    "lines": [
      "Explain documents with hand-drawn diagrams.",
      "Map the steps, decisions and handoffs."
    ]
  },
  {
    "slug": "matrix-compass",
    "repo": "matrix-compass-skill",
    "title": "Matrix Compass",
    "alt": "Matrix Compass — a local creator workspace for content, schedules and income",
    "category": "CREATOR OPERATIONS",
    "kind": "APP + SKILL",
    "tag": "LOCAL WORKSPACE",
    "icon": "compass",
    "lines": [
      "Keep content, schedules and income together.",
      "A local workspace for multi-platform creators."
    ]
  },
  {
    "slug": "pm-sop",
    "repo": "pm-sop-skill",
    "title": "PM SOP",
    "alt": "PM SOP — reusable product management methods and workflows",
    "category": "PRODUCT MANAGEMENT",
    "kind": "AGENT SKILL",
    "tag": "STRATEGY & EXECUTION",
    "icon": "checklist",
    "lines": [
      "Product management methods, ready to use.",
      "Plan, prioritize and launch with repeatable SOPs."
    ]
  },
  {
    "slug": "escape-command",
    "repo": "escape-command",
    "title": "Escape Command",
    "alt": "Escape Command / 出逃指令 — short city adventures in a WeChat mini program",
    "category": "SIDE PROJECT",
    "kind": "WECHAT MINI PROGRAM",
    "tag": "出逃指令",
    "icon": "escape",
    "lines": [
      "Small city adventures beyond your daily routine.",
      "Short missions, photos and places to remember."
    ]
  }
]''')

THEMES = {
    "dark": dict(bg="#111820", border="#2b3541", ink="#f0f3f6", text="#b6c1ce",
                 muted="#97a5b5", accent="#f1c46e", icon_bg="#24241f", divider="#2a333d"),
    "light": dict(bg="#fffcf6", border="#dfd5c5", ink="#202832", text="#4c5a69",
                  muted="#5a6673", accent="#805b1e", icon_bg="#f2e9d8", divider="#e9dfd0"),
}

ICONS = {
    "layout": '<rect x="3" y="4" width="26" height="24" rx="3"/><path d="M3 12h26M13 12v16"/><path d="M7 8h.1M11 8h.1"/>',
    "book": '<path d="M16 7C12 4 6 4 3 6v22c4-2 9-2 13 1 4-3 9-3 13-1V6c-3-2-9-2-13 1Z"/><path d="M16 7v22M7 10h5M20 10h5M7 15h5M20 15h5"/>',
    "fitness": '<path d="M10 8v16M22 8v16M5 12v8M27 12v8M10 16h12M5 16h5M22 16h5"/>',
    "sparkles": '<path d="m16 3 3.5 9.5L29 16l-9.5 3.5L16 29l-3.5-9.5L3 16l9.5-3.5L16 3ZM27 3v6M24 6h6"/>',
    "flow": '<rect x="10" y="2" width="12" height="7" rx="2"/><rect x="1" y="23" width="11" height="7" rx="2"/><rect x="20" y="23" width="11" height="7" rx="2"/><path d="M16 9v7M6.5 23v-7h19v7"/>',
    "compass": '<circle cx="16" cy="16" r="13"/><path d="m22 10-4 8-8 4 4-8 8-4Z"/><circle cx="16" cy="16" r="1"/>',
    "checklist": '<rect x="5" y="4" width="23" height="26" rx="3"/><path d="m9 12 2 2 4-4M18 12h6m-15 9 2 2 4-4M18 21h6M12 2h9v5h-9z"/>',
    "escape": '<path d="M4 28h24M10 28V5l14-3v26M10 5H5v23M17 16h.1M25 13h6m-3-3 3 3-3 3"/>',
}

def esc(value):
    return html.escape(str(value), quote=True)

def render_card(project, theme, index):
    c = THEMES[theme]
    title = esc(project["title"])
    description = esc(" ".join(project["lines"]))
    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="640" height="264" viewBox="0 0 640 264" role="img" aria-labelledby="title desc">
  <title id="title">{title}</title>
  <desc id="desc">{description} {esc(project["kind"])}. View the repository.</desc>
  <rect x="1" y="1" width="638" height="254" rx="18" fill="{c['bg']}" stroke="{c['border']}"/>
  <path d="M30 1h42" stroke="{c['accent']}" stroke-width="3"/>
  <g font-family="'Trebuchet MS', 'Segoe UI', sans-serif">
    <text x="30" y="45" fill="{c['muted']}" font-size="16" font-family="Consolas, monospace">{index:02}</text>
    <path d="M61 31v16" stroke="{c['border']}"/>
    <text x="76" y="45" fill="{c['accent']}" font-size="16" font-weight="700" letter-spacing="0.8">{esc(project['category'])}</text>
    <rect x="555" y="24" width="50" height="50" rx="14" fill="{c['icon_bg']}"/>
    <g transform="translate(564 33)" fill="none" stroke="{c['accent']}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">{ICONS[project['icon']]}</g>
    <text x="30" y="104" fill="{c['ink']}" font-size="32" font-weight="700" letter-spacing="-0.7">{title}</text>
    <text x="30" y="146" fill="{c['text']}" font-size="22">{esc(project['lines'][0])}</text>
    <text x="30" y="176" fill="{c['text']}" font-size="22">{esc(project['lines'][1])}</text>
    <path d="M30 200h575" stroke="{c['divider']}"/>
    <text x="30" y="231" fill="{c['accent']}" font-size="17" font-weight="700" letter-spacing="0.5">{esc(project['kind'])}</text>
    <text x="605" y="231" text-anchor="end" fill="{c['muted']}" font-size="17" font-family="'Segoe UI', 'Microsoft YaHei', sans-serif">{esc(project['tag'])}</text>
  </g>
</svg>
"""

def main():
    root = Path(__file__).resolve().parents[1]
    target = root / "assets" / "projects"
    target.mkdir(parents=True, exist_ok=True)
    for index, project in enumerate(PROJECTS, 1):
        for theme in THEMES:
            path = target / f"{project['slug']}-{theme}.svg"
            path.write_bytes(render_card(project, theme, index).encode("utf-8"))
    print(f"Generated {len(PROJECTS) * len(THEMES)} SVG cards.")

if __name__ == "__main__":
    main()
