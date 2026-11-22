import unittest
from unittest import mock

from gh_related_issues import (
    extract_parent_epic_number,
    filter_related_stories,
    format_issue_line,
    is_bug,
    is_epic,
    is_ready_story,
    parse_labels,
)


def make_issue(
    number: int,
    *labels: str,
    title: str = "Issue Title",
    state: str = "open",
    parent: int | None = None,
    body: str = "",
) -> dict:
    data = {
        "number": number,
        "title": title,
        "labels": [{"name": lbl} for lbl in labels],
        "state": state,
        "body": body,
    }
    if parent:
        data["parent"] = {"number": parent, "title": f"Epic {parent}"}
    return data


class GhRelatedIssuesTest(unittest.TestCase):
    def test_is_bug_detection(self) -> None:
        bug_issue = make_issue(1, "type: bug", "priority: P0")
        story_issue = make_issue(2, "type: story", "priority: P0")
        self.assertTrue(is_bug(bug_issue))
        self.assertFalse(is_bug(story_issue))

    def test_is_epic_detection(self) -> None:
        epic_issue = make_issue(1, "type: epic")
        story_issue = make_issue(2, "type: story")
        self.assertTrue(is_epic(epic_issue))
        self.assertFalse(is_epic(story_issue))

    def test_is_ready_story_filtering(self) -> None:
        ready = make_issue(1, "type: story", "status: planned")
        in_progress = make_issue(2, "type: story", "status: in-progress")
        completed = make_issue(3, "type: story", "status: completed")
        closed = make_issue(4, "type: story", "status: planned", state="closed")
        bug = make_issue(5, "type: bug", "status: planned")
        epic = make_issue(6, "type: epic", "status: planned")

        self.assertTrue(is_ready_story(ready))
        self.assertFalse(is_ready_story(in_progress))
        self.assertFalse(is_ready_story(completed))
        self.assertFalse(is_ready_story(closed))
        self.assertFalse(is_ready_story(bug))
        self.assertFalse(is_ready_story(epic))

    def test_bug_target_is_isolated_and_rejected_from_grouping(self) -> None:
        bug = make_issue(10, "type: bug", "priority: P0", parent=14)
        candidates = [
            make_issue(11, "type: story", "priority: P0", "wave: 1"),
        ]
        related, err = filter_related_stories(bug, candidates)
        self.assertEqual(related, [])
        self.assertIsNotNone(err)
        self.assertIn("maintenance issues must be isolated", err.lower())

    def test_filters_and_sorts_related_sibling_stories(self) -> None:
        target = make_issue(20, "type: story", "priority: P0", "wave: 1", title="KPI engine")
        candidates = [
            make_issue(22, "type: story", "priority: P0", "wave: 2", "status: planned", title="Repo switch"),
            make_issue(21, "type: story", "priority: P0", "wave: 1", "status: planned", title="Phone norm"),
            make_issue(23, "type: story", "priority: P1", "wave: 1", "status: planned", title="Mock adapter"),
            make_issue(18, "type: story", "priority: P0", "wave: 1", "status: completed", title="Stock"),
            make_issue(20, "type: story", "priority: P0", "wave: 1", "status: planned", title="KPI engine"),
        ]

        related, err = filter_related_stories(target, candidates, include_target=False)
        self.assertIsNone(err)
        numbers = [item["number"] for item in related]
        # Should exclude completed #18 and target #20.
        # Should sort by wave (1 before 2), then priority (P0 before P1), then number:
        # wave 1, P0: #21
        # wave 1, P1: #23
        # wave 2, P0: #22
        self.assertEqual(numbers, [21, 23, 22])

    def test_include_target_flag(self) -> None:
        target = make_issue(20, "type: story", "priority: P0", "wave: 1", title="KPI engine")
        candidates = [
            target,
            make_issue(21, "type: story", "priority: P0", "wave: 1", "status: planned", title="Phone norm"),
        ]
        related, _ = filter_related_stories(target, candidates, include_target=True)
        numbers = [item["number"] for item in related]
        self.assertEqual(numbers, [20, 21])

    def test_extract_parent_epic_number(self) -> None:
        with_parent_obj = make_issue(20, "type: story", parent=14)
        self.assertEqual(extract_parent_epic_number(with_parent_obj), 14)

        with_parent_in_body = make_issue(20, "type: story", body="### Parent Epic\n\n#14\n\n### Description")
        self.assertEqual(extract_parent_epic_number(with_parent_in_body), 14)

        without_parent = make_issue(20, "type: story")
        self.assertIsNone(extract_parent_epic_number(without_parent))

    def test_format_issue_line(self) -> None:
        issue = make_issue(
            20,
            "type: story",
            "priority: P0",
            "wave: 1",
            title="KPI engine",
        )
        line = format_issue_line(issue)
        self.assertIn("#20", line)
        self.assertIn("story", line)
        self.assertIn("P0", line)
        self.assertIn("wave 1", line)
        self.assertIn("KPI engine", line)

    @mock.patch("gh_related_issues.fetch_issue")
    @mock.patch("gh_related_issues.fetch_sub_issues")
    def test_main_with_epic_flag(self, mock_sub, mock_issue) -> None:
        from io import StringIO
        import sys
        from gh_related_issues import main

        mock_issue.return_value = make_issue(14, "type: epic", title="Domain epic")
        mock_sub.return_value = [
            make_issue(20, "type: story", "status: planned", title="KPI engine"),
        ]

        out = StringIO()
        with mock.patch("sys.stdout", out):
            main(["--epic", "14"])

        self.assertIn("KPI engine", out.getvalue())

    @mock.patch("gh_related_issues.fetch_issue")
    def test_main_with_bug_reports_isolation(self, mock_issue) -> None:
        from io import StringIO
        from gh_related_issues import main

        mock_issue.return_value = make_issue(10, "type: bug", title="Crash")

        out = StringIO()
        with mock.patch("sys.stdout", out):
            main(["10"])

        self.assertIn("must be isolated", out.getvalue())

    @mock.patch("gh_related_issues.fetch_issue")
    @mock.patch("gh_related_issues.fetch_sub_issues")
    def test_main_with_story_and_json(self, mock_sub, mock_issue) -> None:
        from io import StringIO
        import json
        from gh_related_issues import main

        mock_issue.return_value = make_issue(20, "type: story", parent=14, title="KPI")
        mock_sub.return_value = [
            make_issue(20, "type: story", parent=14, title="KPI"),
            make_issue(21, "type: story", "status: planned", parent=14, title="Phone"),
        ]

        out = StringIO()
        with mock.patch("sys.stdout", out):
            main(["20", "--json"])

        parsed = json.loads(out.getvalue())
        self.assertEqual(len(parsed), 1)
        self.assertEqual(parsed[0]["number"], 21)


if __name__ == "__main__":
    unittest.main()
