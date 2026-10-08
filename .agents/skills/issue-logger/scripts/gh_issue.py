#!/usr/bin/env python3
"""Create and prioritise foodbiz-pwa GitHub issues (epic, story, bug) from a JSON spec.

Commands (run from the repo root):
  setup                    sync labels and milestones (idempotent)
  create SPEC [--apply]    render issues from SPEC (JSON file, or '-' for stdin); dry run unless --apply
  next [-n N] [--type story|bug|all] [--milestone M | --all]
                           list the next N ready items in priority order
"""

import argparse
import json
import subprocess
import sys
import time
from typing import Any

AREAS = [
    "storefront", "dashboard", "orders", "products", "expenses", "analytics",
    "auth", "infra", "design-system", "customers", "settings",
]
PRIORITIES = {
    "P0": "P0 — Critical path, blocks MVP",
    "P1": "P1 — High value, needed for launch",
    "P2": "P2 — Medium, nice-to-have for launch",
    "P3": "P3 — Low, post-MVP",
}
GATES = {
    "standard": "standard — agent implements autonomously",
    "needs-review": "needs-review — agent creates plan, waits for approval",
    "design-change": "design-change — breaking or visual change, requires approval",
}
SEVERITIES = {
    "critical": ("Critical — app/page crashes or data loss", "P0"),
    "major": ("Major — feature broken, no workaround", "P1"),
    "minor": ("Minor — cosmetic or minor inconvenience", "P2"),
}
MILESTONES = {
    "v0.9 MVP": "Fully functional end-to-end app deployed on Vercel staging.",
    "Backlog / v1.x": "Deferred after v0.9.",
}
DEFAULT_MILESTONE = "v0.9 MVP"
MAINTENANCE_TITLE = "Epic: Maintenance"
PLACEHOLDER = "_None yet_"
NOT_READY = {"status: in-progress", "status: in-review", "status: blocked", "status: completed"}

LABELS: dict[str, tuple[str, str]] = {
    "type: epic": ("5319e7", "Feature-domain epic grouping stories"),
    "type: story": ("1d76db", "Implementable user story"),
    "type: bug": ("d73a4a", "Something isn't working"),
    "type: chore": ("c5def5", "Tooling, maintenance, config"),
    "type: spike": ("fbca04", "Time-boxed investigation"),
    **{f"priority: {p}": (c, PRIORITIES[p].split(" — ")[1]) for p, c in
       [("P0", "b60205"), ("P1", "d93f0b"), ("P2", "fbca04"), ("P3", "c2e0c6")]},
    "status: planned": ("ededed", "Planned, not started"),
    "status: in-progress": ("0e8a16", "Work in progress"),
    "status: in-review": ("d4c5f9", "PR open, awaiting review"),
    "status: blocked": ("b60205", "Blocked by a dependency or decision"),
    "status: completed": ("0e8a16", "Merged and done"),
    "gate: needs-review": ("f9d0c4", "Agent must get plan approval before implementing"),
    "gate: design-change": ("f9d0c4", "Visual/breaking change: approval required before implementing"),
    **{f"wave: {n}": ("bfdadc", f"Delivery wave {n}") for n in range(1, 6)},
    **{f"area: {a}": ("0052cc", f"Area: {a}") for a in AREAS},
}

Spec = dict[str, Any]


def gh(*args: str, stdin: str | None = None, check: bool = True) -> str:
    result = subprocess.run(["gh", *args], input=stdin, capture_output=True, text=True)
    if check and result.returncode != 0:
        sys.exit(f"gh {' '.join(args[:3])} … failed:\n{result.stderr.strip()}")
    return result.stdout.strip()


# ---------- validation ----------

def validate(spec: Spec, nested: bool = False) -> list[str]:
    kind = spec.get("type")
    where = f"{kind} '{spec.get('title', '?')}'"
    errors: list[str] = []

    def need(key: str, typ: type | tuple[type, ...] = str) -> None:
        if not isinstance(spec.get(key), typ) or not spec.get(key):
            errors.append(f"{where}: '{key}' is required")

    def one_of(key: str, allowed: Any, required: bool = True) -> None:
        value = spec.get(key)
        if (value is not None or required) and value not in allowed:
            errors.append(f"{where}: '{key}' must be one of {list(allowed)}")

    if kind not in ("epic", "story", "bug"):
        return [f"{where}: 'type' must be epic, story or bug"]
    need("title")
    need("description")
    one_of("area", AREAS)
    if "milestone" in spec and spec["milestone"] is not None:
        one_of("milestone", MILESTONES)

    if kind == "epic":
        one_of("priority", PRIORITIES)
        for child in spec.get("stories", []):
            errors += validate(child, nested=True)
    elif kind == "story":
        need("ac", list)
        one_of("priority", PRIORITIES)
        one_of("gate", GATES, required=False)
        one_of("wave", range(1, 6), required=False)
        if nested and "parent" in spec:
            errors.append(f"{where}: nested stories must not set 'parent'")
        if not nested and not isinstance(spec.get("parent"), int):
            errors.append(f"{where}: 'parent' (epic issue number) is required")
    else:
        need("steps", (list, str))
        need("expected")
        one_of("severity", SEVERITIES)
        one_of("priority", PRIORITIES, required=False)
    return errors


# ---------- rendering ----------

def section(label: str, value: str) -> str:
    return f"### {label}\n\n{value or '_No response_'}\n\n"


def checklist(items: list[str]) -> str:
    return "\n".join(f"- [ ] {i}" for i in items)


def epic_title(spec: Spec) -> str:
    title = spec["title"]
    return title if title.startswith("Epic: ") else f"Epic: {title}"


def render(spec: Spec, parent: int | None) -> tuple[str, str, list[str]]:
    kind = spec["type"]
    if kind == "epic":
        children = checklist([s["title"] for s in spec.get("stories", [])]) or PLACEHOLDER
        body = (section("Description", spec["description"]) + section("Child Stories", children)
                + section("Priority", PRIORITIES[spec["priority"]]) + section("Area", spec["area"]))
        labels = ["type: epic", "status: planned", f"priority: {spec['priority']}", f"area: {spec['area']}"]
        labels += sorted({f"wave: {s['wave']}" for s in spec.get("stories", []) if s.get("wave")})
        return epic_title(spec), body, labels

    if kind == "story":
        gate = spec.get("gate", "standard")
        body = (section("Parent Epic", f"#{parent}" if parent else "#<new epic>")
                + section("Description", spec["description"])
                + section("Acceptance Criteria", checklist(spec["ac"]))
                + section("Review Gate", GATES[gate])
                + section("Technical Notes (optional)", spec.get("notes", ""))
                + section("Area", spec["area"]))
        labels = ["type: story", "status: planned", f"priority: {spec['priority']}", f"area: {spec['area']}"]
        if spec.get("wave"):
            labels.append(f"wave: {spec['wave']}")
        if gate != "standard":
            labels.append(f"gate: {gate}")
        return spec["title"], body, labels

    severity_text, severity_priority = SEVERITIES[spec["severity"]]
    steps = spec["steps"]
    steps_text = "\n".join(f"{n}. {s}" for n, s in enumerate(steps, 1)) if isinstance(steps, list) else steps
    title = spec["title"] if spec["title"].startswith("Bug: ") else f"Bug: {spec['title']}"
    body = (section("Bug Description", spec["description"]) + section("Steps to Reproduce", steps_text)
            + section("Expected Behavior", spec["expected"])
            + section("Browser / Device", spec.get("browser", ""))
            + section("Severity", severity_text) + section("Area", spec["area"]))
    labels = ["type: bug", "status: planned", f"priority: {spec.get('priority', severity_priority)}",
              f"area: {spec['area']}"]
    return title, body, labels


# ---------- GitHub operations ----------

def open_issues() -> list[Spec]:
    return json.loads(gh("issue", "list", "--state", "open", "--limit", "1000",
                         "--json", "number,title,labels,milestone"))


def maintenance_epic(issues: list[Spec]) -> int | None:
    return next((i["number"] for i in issues if i["title"] == MAINTENANCE_TITLE), None)


def link_sub_issue(epic: int, child: int) -> None:
    child_id = gh("api", f"repos/{{owner}}/{{repo}}/issues/{child}", "--jq", ".id")
    result = subprocess.run(
        ["gh", "api", "-X", "POST", f"repos/{{owner}}/{{repo}}/issues/{epic}/sub_issues",
         "-F", f"sub_issue_id={child_id}"], capture_output=True, text=True)
    if result.returncode != 0 and "already" not in result.stderr.lower():
        print(f"  ! sub-issue link #{epic} ← #{child} failed: {result.stderr.strip()}")


def append_child(epic: int, number: int, title: str, wave: int | None) -> None:
    body = gh("issue", "view", str(epic), "--json", "body", "--jq", ".body")
    if f"#{number} " not in body:
        head, marker, rest = body.partition("### Child Stories")
        if marker:
            current, nxt, tail = rest.partition("\n### ")
            lines = [ln for ln in current.strip().splitlines() if ln.strip() not in (PLACEHOLDER, "_No response_")]
            lines.append(f"- [ ] #{number} — {title}")
            body = head + marker + "\n\n" + "\n".join(lines) + "\n" + nxt + tail
            gh("issue", "edit", str(epic), "--body-file", "-", stdin=body)
    if wave:
        gh("issue", "edit", str(epic), "--add-label", f"wave: {wave}")


def create_one(spec: Spec, parent: int | None, apply: bool, existing: dict[str, int]) -> int | None:
    title, body, labels = render(spec, parent)
    milestone = spec.get("milestone", DEFAULT_MILESTONE)
    if not apply:
        print(f"\n=== {spec['type'].upper()}: {title}")
        print(f"labels: {', '.join(labels)} | milestone: {milestone or '—'} | parent: {parent or '—'}\n")
        print(body.rstrip())
        return None
    if title in existing:
        print(f"= exists #{existing[title]} {title}")
        return existing[title]
    args = ["issue", "create", "--title", title, "--body-file", "-"]
    if milestone:
        args += ["--milestone", milestone]
    for label in labels:
        args += ["--label", label]
    number = int(gh(*args, stdin=body).rstrip("/").rsplit("/", 1)[-1])
    existing[title] = number
    print(f"+ #{number} {title}")
    time.sleep(1)  # stay below GitHub secondary rate limits
    return number


def create(spec: Spec, apply: bool, existing: dict[str, int], maintenance: int | None) -> None:
    kind = spec["type"]
    if kind == "epic":
        epic_no = create_one(spec, None, apply, existing)
        for child in spec.get("stories", []):
            child_no = create_one(child, epic_no, apply, existing)
            if apply and epic_no and child_no:
                link_sub_issue(epic_no, child_no)
        if apply and epic_no and spec.get("stories"):
            _, body, _ = render(spec, None)
            numbered = checklist([f"#{existing[s['title']]} — {s['title']}" for s in spec["stories"]])
            gh("issue", "edit", str(epic_no), "--body-file", "-",
               stdin=body.replace(checklist([s["title"] for s in spec["stories"]]), numbered))
        return

    parent = spec.get("parent") or (maintenance if kind == "bug" else None)
    if kind == "bug" and not parent:
        print(f"! No open '{MAINTENANCE_TITLE}' found; bug will not be parented")
    number = create_one(spec, parent, apply, existing)
    if apply and number and parent:
        link_sub_issue(parent, number)
        append_child(parent, number, render(spec, parent)[0], spec.get("wave"))


# ---------- commands ----------

def cmd_setup(_: argparse.Namespace) -> None:
    for name, (color, desc) in LABELS.items():
        gh("label", "create", name, "--color", color, "--description", desc, "--force")
    titles = {m["title"] for m in json.loads(gh("api", "repos/{owner}/{repo}/milestones?state=all&per_page=100"))}
    for title, desc in MILESTONES.items():
        if title not in titles:
            gh("api", "repos/{owner}/{repo}/milestones", "-f", f"title={title}", "-f", f"description={desc}")
    print(f"Synced {len(LABELS)} labels and {len(MILESTONES)} milestones")


def cmd_create(args: argparse.Namespace) -> None:
    raw = sys.stdin.read() if args.spec == "-" else open(args.spec, encoding="utf-8").read()
    data = json.loads(raw)
    specs: list[Spec] = data if isinstance(data, list) else [data]
    errors = [e for s in specs for e in validate(s)]
    if errors:
        sys.exit("Invalid spec:\n- " + "\n- ".join(errors))
    issues = open_issues()
    existing = {i["title"]: i["number"] for i in issues}
    for spec in specs:
        create(spec, args.apply, existing, maintenance_epic(issues))
    if not args.apply:
        print("\n(dry run — re-run with --apply to create)")


def cmd_next(args: argparse.Namespace) -> None:
    ranked = []
    skipped = 0
    for issue in open_issues():
        names = {lbl["name"] for lbl in issue["labels"]}
        if "type: epic" in names or names & NOT_READY:
            continue
        kind = "bug" if "type: bug" in names else "story"
        if args.type not in ("all", kind):
            skipped += 1
            continue
        milestone = (issue.get("milestone") or {}).get("title")
        if kind == "story" and not args.all and milestone != args.milestone:
            continue

        def value(prefix: str, default: str) -> str:
            return next((n.removeprefix(prefix) for n in names if n.startswith(prefix)), default)

        priority, wave, gate = value("priority: ", "P3"), value("wave: ", "-"), value("gate: ", "standard")
        wave_rank = int(wave) if wave.isdigit() else 0
        key = (priority, wave_rank, issue["number"]) if args.type == "all" else (wave_rank, priority, issue["number"])
        ranked.append((key, f"#{issue['number']:<5}{kind:<6}{priority:<4}wave {wave:<3}{gate:<15}{issue['title']}"))
    for _, line in sorted(ranked)[: args.n]:
        print(line)
    if skipped:
        other = "bug(s)" if args.type == "story" else "story(ies)"
        print(f"({skipped} ready {other} not shown; use --type {'bug' if args.type == 'story' else 'story'} or all)")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("setup").set_defaults(func=cmd_setup)
    p_create = sub.add_parser("create")
    p_create.add_argument("spec")
    p_create.add_argument("--apply", action="store_true")
    p_create.set_defaults(func=cmd_create)
    p_next = sub.add_parser("next")
    p_next.add_argument("-n", type=int, default=5)
    p_next.add_argument("--type", choices=["story", "bug", "all"], default="story",
                        help="stories (default), bugs, or both ranked by priority")
    p_next.add_argument("--milestone", default=DEFAULT_MILESTONE)
    p_next.add_argument("--all", action="store_true", help="ignore milestone filter")
    p_next.set_defaults(func=cmd_next)
    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
