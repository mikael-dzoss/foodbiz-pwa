#!/usr/bin/env python3
"""Fetch open related stories under the same parent epic for issue grouping.

Maintenance issues (bugs) are strictly isolated and not eligible for grouping.
"""

import argparse
import json
import re
import subprocess
import sys
from typing import Any

NOT_READY = {"status: in-progress", "status: in-review", "status: blocked", "status: completed"}
PRIORITY_ORDER = {"P0": 0, "P1": 1, "P2": 2, "P3": 3}

Spec = dict[str, Any]


def gh(*args: str, check: bool = True) -> str:
    result = subprocess.run(["gh", *args], capture_output=True, text=True)
    if check and result.returncode != 0:
        sys.exit(f"gh {' '.join(args[:3])} … failed:\n{result.stderr.strip()}")
    return result.stdout.strip()


def parse_labels(issue: Spec) -> dict[str, str]:
    labels = {lbl["name"] for lbl in issue.get("labels", []) if isinstance(lbl, dict) and "name" in lbl}
    return {
        "type": next((lbl.removeprefix("type: ") for lbl in labels if lbl.startswith("type: ")), "story"),
        "status": next((lbl.removeprefix("status: ") for lbl in labels if lbl.startswith("status: ")), "planned"),
        "priority": next((lbl.removeprefix("priority: ") for lbl in labels if lbl.startswith("priority: ")), "P3"),
        "wave": next((lbl.removeprefix("wave: ") for lbl in labels if lbl.startswith("wave: ")), "-"),
        "area": next((lbl.removeprefix("area: ") for lbl in labels if lbl.startswith("area: ")), ""),
    }


def is_bug(issue: Spec) -> bool:
    labels = {lbl["name"] for lbl in issue.get("labels", []) if isinstance(lbl, dict) and "name" in lbl}
    return "type: bug" in labels


def is_epic(issue: Spec) -> bool:
    labels = {lbl["name"] for lbl in issue.get("labels", []) if isinstance(lbl, dict) and "name" in lbl}
    return "type: epic" in labels


def is_ready_story(issue: Spec) -> bool:
    labels = {lbl["name"] for lbl in issue.get("labels", []) if isinstance(lbl, dict) and "name" in lbl}
    if "type: epic" in labels or "type: bug" in labels:
        return False
    if labels & NOT_READY:
        return False
    state = issue.get("state", "").lower()
    if state and state != "open":
        return False
    return True


def extract_parent_epic_number(issue: Spec) -> int | None:
    parent = issue.get("parent")
    if parent and isinstance(parent, dict) and "number" in parent:
        return parent["number"]
    body = issue.get("body", "")
    m = re.search(r"### Parent Epic\s+#?(\d+)", body)
    if m:
        return int(m.group(1))
    return None


def format_issue_line(issue: Spec) -> str:
    parsed = parse_labels(issue)
    return (
        f"#{issue['number']:<5}"
        f"{parsed['type']:<6}"
        f"{parsed['priority']:<4}"
        f"wave {parsed['wave']:<3}"
        f"{issue['title']}"
    )


def filter_related_stories(
    target_issue: Spec,
    candidates: list[Spec],
    include_target: bool = False,
) -> tuple[list[Spec], str | None]:
    """Filter open ready stories related to the target issue under the same parent epic."""
    if is_bug(target_issue):
        return (
            [],
            f"Issue #{target_issue['number']} is a bug/maintenance issue. "
            "Maintenance issues must be isolated and cannot be grouped.",
        )

    related: list[Spec] = []
    for candidate in candidates:
        if candidate["number"] == target_issue["number"]:
            if include_target:
                related.append(candidate)
            continue
        if is_ready_story(candidate):
            related.append(candidate)

    def sort_key(item: Spec) -> tuple[int, int, int]:
        parsed = parse_labels(item)
        wave_str = parsed["wave"]
        wave_rank = int(wave_str) if wave_str.isdigit() else 99
        prio_rank = PRIORITY_ORDER.get(parsed["priority"], 99)
        return (wave_rank, prio_rank, item["number"])

    related.sort(key=sort_key)
    return related, None


def fetch_issue(number: int) -> Spec:
    raw = gh("issue", "view", str(number), "--json", "number,title,labels,milestone,parent,body,state")
    return json.loads(raw)


def fetch_sub_issues(epic_number: int) -> list[Spec]:
    raw = gh("api", f"repos/:owner/:repo/issues/{epic_number}/sub_issues")
    return json.loads(raw)


def fetch_next_ready_story() -> Spec | None:
    raw = gh("issue", "list", "--state", "open", "--limit", "1000", "--json", "number,title,labels,milestone,parent,body,state")
    issues: list[Spec] = json.loads(raw)
    ready = [i for i in issues if is_ready_story(i)]
    if not ready:
        return None

    def sort_key(item: Spec) -> tuple[int, int, int]:
        parsed = parse_labels(item)
        wave_str = parsed["wave"]
        wave_rank = int(wave_str) if wave_str.isdigit() else 99
        prio_rank = PRIORITY_ORDER.get(parsed["priority"], 99)
        return (wave_rank, prio_rank, item["number"])

    ready.sort(key=sort_key)
    return ready[0]


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "issue",
        nargs="?",
        type=int,
        help="Target issue number. If omitted, picks the next ready story.",
    )
    parser.add_argument(
        "--epic",
        type=int,
        help="List open ready stories directly under this epic number.",
    )
    parser.add_argument(
        "--include-target",
        action="store_true",
        help="Include the target issue in the output list.",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Output raw JSON instead of formatted text lines.",
    )

    args = parser.parse_args(argv)

    if args.epic:
        epic_number = args.epic
        epic_data = fetch_issue(epic_number)
        sub_issues = fetch_sub_issues(epic_number)
        ready_stories = [s for s in sub_issues if is_ready_story(s)]
        _, err = filter_related_stories(epic_data, sub_issues, include_target=False)
        if args.json:
            print(json.dumps(ready_stories, indent=2))
        else:
            print(f"Open ready stories in Epic #{epic_number} ({epic_data['title']}):")
            for item in ready_stories:
                print(format_issue_line(item))
            if not ready_stories:
                print("No open ready stories in this epic.")
        return

    if args.issue:
        target = fetch_issue(args.issue)
    else:
        target = fetch_next_ready_story()
        if not target:
            sys.exit("No open ready stories found in the backlog.")

    if is_bug(target):
        msg = (
            f"Issue #{target['number']} is a bug/maintenance issue.\n"
            "Maintenance issues must be isolated and cannot be grouped."
        )
        if args.json:
            print(json.dumps({"error": msg, "isolated": True, "issue": target["number"]}, indent=2))
        else:
            print(msg)
        return

    if is_epic(target):
        epic_number = target["number"]
        sub_issues = fetch_sub_issues(epic_number)
        ready_stories = [s for s in sub_issues if is_ready_story(s)]
        if args.json:
            print(json.dumps(ready_stories, indent=2))
        else:
            print(f"Open ready stories in Epic #{epic_number} ({target['title']}):")
            for item in ready_stories:
                print(format_issue_line(item))
        return

    parent_epic = extract_parent_epic_number(target)
    if not parent_epic:
        msg = f"Issue #{target['number']} has no parent epic associated with it. Cannot find grouped siblings."
        if args.json:
            print(json.dumps({"error": msg, "issue": target["number"]}, indent=2))
        else:
            print(msg)
        return

    sub_issues = fetch_sub_issues(parent_epic)
    related, err = filter_related_stories(target, sub_issues, include_target=args.include_target)
    if err:
        if args.json:
            print(json.dumps({"error": err}, indent=2))
        else:
            print(err)
        return

    if args.json:
        print(json.dumps(related, indent=2))
    else:
        print(f"Target issue: #{target['number']} ({target['title']}) — Parent Epic #{parent_epic}")
        if related:
            label = "Open related stories (including target):" if args.include_target else "Open related sibling stories:"
            print(label)
            for item in related:
                print(format_issue_line(item))
        else:
            print("No open ready sibling stories found for grouping.")


if __name__ == "__main__":
    main()
