#!/usr/bin/env python3
"""Inspect and sync the status of a story's parent epic.

Usage:
  python3 gh_parent_issue.py <number> [--set-in-progress] [--json]
"""

import argparse
import json
import re
import subprocess
import sys
from typing import Any

Spec = dict[str, Any]


def gh(*args: str, check: bool = True) -> str:
    result = subprocess.run(["gh", *args], capture_output=True, text=True)
    if check and result.returncode != 0:
        sys.exit(f"gh {' '.join(args[:3])} … failed:\n{result.stderr.strip()}")
    return result.stdout.strip()


def extract_parent_epic_number(issue: Spec) -> int | None:
    parent = issue.get("parent")
    if parent and isinstance(parent, dict) and "number" in parent:
        return parent["number"]
    body = issue.get("body", "")
    m = re.search(r"### Parent Epic\s+#?(\d+)", body)
    if m:
        return int(m.group(1))
    return None


def extract_issue_status(issue: Spec) -> str:
    labels = {lbl["name"] for lbl in issue.get("labels", []) if isinstance(lbl, dict) and "name" in lbl}
    return next((lbl.removeprefix("status: ") for lbl in labels if lbl.startswith("status: ")), "unknown")


def sync_parent_status(issue_number: int, set_in_progress: bool = False, runner: Any = gh) -> dict[str, Any]:
    raw_issue = runner("issue", "view", str(issue_number), "--json", "number,title,labels,parent,body")
    issue = json.loads(raw_issue)
    parent_num = extract_parent_epic_number(issue)

    if not parent_num:
        return {
            "issue_number": issue.get("number", issue_number),
            "parent_number": None,
            "parent_title": None,
            "parent_status": None,
            "previous_status": None,
            "updated": False,
        }

    raw_parent = runner("issue", "view", str(parent_num), "--json", "number,title,labels")
    parent = json.loads(raw_parent)
    status = extract_issue_status(parent)
    updated = False

    if set_in_progress and status == "planned":
        runner(
            "issue",
            "edit",
            str(parent_num),
            "--remove-label",
            "status: planned",
            "--add-label",
            "status: in-progress",
        )
        updated = True

    return {
        "issue_number": issue.get("number", issue_number),
        "parent_number": parent["number"],
        "parent_title": parent.get("title", ""),
        "parent_status": "in-progress" if updated else status,
        "previous_status": status if updated else None,
        "updated": updated,
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("number", type=int, help="Issue number of the story")
    parser.add_argument(
        "--set-in-progress",
        action="store_true",
        help="Promote parent epic to status: in-progress if currently planned",
    )
    parser.add_argument("--json", action="store_true", help="Output machine-readable JSON")
    args = parser.parse_args(argv)

    res = sync_parent_status(args.number, set_in_progress=args.set_in_progress)

    if args.json:
        print(json.dumps(res, indent=2))
        return 0

    if res["parent_number"] is None:
        print(f"Issue #{args.number} has no parent epic.")
    elif res["updated"]:
        print(
            f"Promoted Parent Epic #{res['parent_number']} ('{res['parent_title']}') "
            f"from status: {res['previous_status']} to status: in-progress"
        )
    else:
        print(
            f"Parent Epic #{res['parent_number']} ('{res['parent_title']}') "
            f"status: {res['parent_status']}"
        )

    return 0


if __name__ == "__main__":
    sys.exit(main())
