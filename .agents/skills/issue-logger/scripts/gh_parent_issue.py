#!/usr/bin/env python3
"""Inspect and sync the status of a story's parent epic.

Usage:
  python3 gh_parent_issue.py <number> [--set-in-progress] [--close-completed] [--sync] [--json]
  python3 gh_parent_issue.py --sync-all [--json]
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


def is_epic(issue: Spec) -> bool:
    labels = {lbl["name"] for lbl in issue.get("labels", []) if isinstance(lbl, dict) and "name" in lbl}
    return "type: epic" in labels


def get_sub_issues_stats(epic: Spec, allow_api_fallback: bool = False, runner: Any = gh) -> tuple[int, int]:
    """Return (total, completed) sub-issues for an epic."""
    summary = epic.get("subIssuesSummary")
    if summary and isinstance(summary, dict) and summary.get("total", 0) > 0:
        return summary.get("total", 0), summary.get("completed", 0)

    if not allow_api_fallback:
        return 0, 0

    # Fallback to sub_issues endpoint if summary is 0 or absent
    try:
        epic_number = epic["number"]
        raw = runner("api", f"repos/:owner/:repo/issues/{epic_number}/sub_issues")
        items = json.loads(raw)
        if isinstance(items, list) and len(items) > 0:
            total = len(items)
            completed = sum(1 for it in items if it.get("state", "").lower() == "closed")
            return total, completed
    except Exception:
        pass

    return 0, 0


def close_epic(epic_number: int, runner: Any = gh) -> None:
    runner(
        "issue",
        "edit",
        str(epic_number),
        "--remove-label",
        "status: planned",
        "--remove-label",
        "status: in-progress",
        "--remove-label",
        "status: in-review",
        "--remove-label",
        "status: blocked",
        "--add-label",
        "status: completed",
    )
    runner(
        "issue",
        "close",
        str(epic_number),
        "--reason",
        "completed",
        "--comment",
        "All child stories completed.",
    )


def sync_parent_status(
    issue_number: int,
    set_in_progress: bool = False,
    close_completed: bool = False,
    runner: Any = gh,
) -> dict[str, Any]:
    raw_issue = runner(
        "issue",
        "view",
        str(issue_number),
        "--json",
        "number,title,labels,parent,body,subIssuesSummary,state",
    )
    issue = json.loads(raw_issue)

    if is_epic(issue):
        parent_num = issue["number"]
        parent = issue
    else:
        parent_num = extract_parent_epic_number(issue)
        if not parent_num:
            return {
                "issue_number": issue.get("number", issue_number),
                "parent_number": None,
                "parent_title": None,
                "parent_status": None,
                "previous_status": None,
                "updated": False,
                "closed": False,
                "total_sub_issues": 0,
                "completed_sub_issues": 0,
            }
        raw_parent = runner(
            "issue",
            "view",
            str(parent_num),
            "--json",
            "number,title,labels,subIssuesSummary,state",
        )
        parent = json.loads(raw_parent)

    status = extract_issue_status(parent)
    is_open = parent.get("state", "").upper() != "CLOSED"
    total, completed = get_sub_issues_stats(parent, allow_api_fallback=close_completed, runner=runner)
    all_closed = total > 0 and completed == total

    updated = False
    closed = False
    previous_status = None

    if close_completed and all_closed and is_open:
        close_epic(parent_num, runner=runner)
        updated = True
        closed = True
        previous_status = status
        status = "completed"
    elif set_in_progress and status == "planned":
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
        previous_status = status
        status = "in-progress"

    return {
        "issue_number": issue.get("number", issue_number),
        "parent_number": parent["number"],
        "parent_title": parent.get("title", ""),
        "parent_status": status,
        "previous_status": previous_status,
        "updated": updated,
        "closed": closed,
        "total_sub_issues": total,
        "completed_sub_issues": completed,
    }


def sync_all_epics(close_completed: bool = True, runner: Any = gh) -> list[dict[str, Any]]:
    raw = runner(
        "issue",
        "list",
        "--label",
        "type: epic",
        "--state",
        "open",
        "--limit",
        "100",
        "--json",
        "number,title,labels,subIssuesSummary",
    )
    epics = json.loads(raw)
    results: list[dict[str, Any]] = []

    for epic in epics:
        num = epic["number"]
        title = epic.get("title", "")
        status = extract_issue_status(epic)
        total, completed = get_sub_issues_stats(epic, allow_api_fallback=close_completed, runner=runner)
        all_closed = total > 0 and completed == total

        if close_completed and all_closed:
            close_epic(num, runner=runner)
            results.append({
                "epic_number": num,
                "epic_title": title,
                "previous_status": status,
                "parent_status": "completed",
                "total_sub_issues": total,
                "completed_sub_issues": completed,
                "updated": True,
                "closed": True,
            })

    return results


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "number",
        type=int,
        nargs="?",
        default=None,
        help="Issue number of the story or epic",
    )
    parser.add_argument(
        "--set-in-progress",
        action="store_true",
        help="Promote parent epic to status: in-progress if currently planned",
    )
    parser.add_argument(
        "--close-completed",
        action="store_true",
        help="Close parent epic and set status: completed if all sub-issues are closed",
    )
    parser.add_argument(
        "--sync",
        action="store_true",
        help="Sync parent epic: promote to in-progress if planned, or close if completed",
    )
    parser.add_argument(
        "--sync-all",
        action="store_true",
        help="Scan and sync all open epics in the repo, closing completed ones",
    )
    parser.add_argument("--json", action="store_true", help="Output machine-readable JSON")
    args = parser.parse_args(argv)

    if args.sync_all:
        results = sync_all_epics(close_completed=True)
        if args.json:
            print(json.dumps(results, indent=2))
            return 0
        if not results:
            print("All open epics are up to date (no completed open epics found).")
        else:
            print(f"Synced {len(results)} completed epic(s):")
            for r in results:
                print(
                    f"  - Closed Epic #{r['epic_number']} ('{r['epic_title']}'): "
                    f"({r['completed_sub_issues']}/{r['total_sub_issues']} sub-issues completed)"
                )
        return 0

    if args.number is None:
        parser.error("Issue number is required unless --sync-all is provided.")

    set_in_progress = args.set_in_progress or args.sync
    close_completed = args.close_completed or args.sync

    res = sync_parent_status(
        args.number,
        set_in_progress=set_in_progress,
        close_completed=close_completed,
    )

    if args.json:
        print(json.dumps(res, indent=2))
        return 0

    if res["parent_number"] is None:
        print(f"Issue #{args.number} has no parent epic.")
    elif res.get("closed"):
        print(
            f"Closed completed Parent Epic #{res['parent_number']} ('{res['parent_title']}') "
            f"({res['completed_sub_issues']}/{res['total_sub_issues']} sub-issues completed)"
        )
    elif res["updated"]:
        print(
            f"Promoted Parent Epic #{res['parent_number']} ('{res['parent_title']}') "
            f"from status: {res['previous_status']} to status: {res['parent_status']}"
        )
    else:
        stats_str = ""
        if res.get("total_sub_issues", 0) > 0:
            stats_str = f" ({res['completed_sub_issues']}/{res['total_sub_issues']} sub-issues completed)"
        print(
            f"Parent Epic #{res['parent_number']} ('{res['parent_title']}') "
            f"status: {res['parent_status']}{stats_str}"
        )

    return 0


if __name__ == "__main__":
    sys.exit(main())

