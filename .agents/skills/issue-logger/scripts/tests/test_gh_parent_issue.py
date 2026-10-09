import json
import unittest
from unittest import mock

from gh_parent_issue import (
    extract_issue_status,
    extract_parent_epic_number,
    main,
    sync_parent_status,
)


def make_issue(
    number: int,
    *labels: str,
    title: str = "Issue Title",
    parent: int | None = None,
    body: str = "",
) -> dict:
    data = {
        "number": number,
        "title": title,
        "labels": [{"name": lbl} for lbl in labels],
        "body": body,
    }
    if parent:
        data["parent"] = {"number": parent, "title": f"Epic {parent}"}
    return data


class GhParentIssueTest(unittest.TestCase):
    def test_extract_parent_epic_number(self) -> None:
        with_parent_obj = make_issue(20, "type: story", parent=14)
        self.assertEqual(extract_parent_epic_number(with_parent_obj), 14)

        with_body = make_issue(20, "type: story", body="### Parent Epic\n\n#14\n\nDescription")
        self.assertEqual(extract_parent_epic_number(with_body), 14)

        with_body_no_hash = make_issue(20, "type: story", body="### Parent Epic 14\n\nDescription")
        self.assertEqual(extract_parent_epic_number(with_body_no_hash), 14)

        without_parent = make_issue(20, "type: story", body="No epic here")
        self.assertIsNone(extract_parent_epic_number(without_parent))

    def test_extract_issue_status(self) -> None:
        planned = make_issue(14, "type: epic", "status: planned")
        in_progress = make_issue(14, "type: epic", "status: in-progress")
        no_status = make_issue(14, "type: epic")

        self.assertEqual(extract_issue_status(planned), "planned")
        self.assertEqual(extract_issue_status(in_progress), "in-progress")
        self.assertEqual(extract_issue_status(no_status), "unknown")

    def test_sync_parent_status_no_parent(self) -> None:
        story = make_issue(20, "type: story")
        runner = mock.MagicMock(return_value=json.dumps(story))

        res = sync_parent_status(20, set_in_progress=True, runner=runner)
        self.assertIsNone(res["parent_number"])
        self.assertFalse(res["updated"])
        self.assertEqual(runner.call_count, 1)

    def test_sync_parent_status_planned_without_set_flag(self) -> None:
        story = make_issue(20, "type: story", parent=14)
        epic = make_issue(14, "type: epic", "status: planned", title="Domain Epic")

        def mock_runner(*args: str, **kwargs: object) -> str:
            if args[1] == "view" and args[2] == "20":
                return json.dumps(story)
            if args[1] == "view" and args[2] == "14":
                return json.dumps(epic)
            raise AssertionError(f"Unexpected call: {args}")

        runner = mock.MagicMock(side_effect=mock_runner)
        res = sync_parent_status(20, set_in_progress=False, runner=runner)

        self.assertEqual(res["parent_number"], 14)
        self.assertEqual(res["parent_status"], "planned")
        self.assertFalse(res["updated"])
        self.assertEqual(runner.call_count, 2)

    def test_sync_parent_status_promotes_planned_to_in_progress(self) -> None:
        story = make_issue(20, "type: story", parent=14)
        epic = make_issue(14, "type: epic", "status: planned", title="Domain Epic")
        calls = []

        def mock_runner(*args: str, **kwargs: object) -> str:
            calls.append(args)
            if args[1] == "view" and args[2] == "20":
                return json.dumps(story)
            if args[1] == "view" and args[2] == "14":
                return json.dumps(epic)
            if args[1] == "edit" and args[2] == "14":
                return ""
            raise AssertionError(f"Unexpected call: {args}")

        res = sync_parent_status(20, set_in_progress=True, runner=mock_runner)

        self.assertEqual(res["parent_number"], 14)
        self.assertEqual(res["parent_status"], "in-progress")
        self.assertEqual(res["previous_status"], "planned")
        self.assertTrue(res["updated"])

        # Check edit call was made with appropriate labels
        edit_call = [c for c in calls if c[1] == "edit"]
        self.assertEqual(len(edit_call), 1)
        self.assertIn("--remove-label", edit_call[0])
        self.assertIn("status: planned", edit_call[0])
        self.assertIn("--add-label", edit_call[0])
        self.assertIn("status: in-progress", edit_call[0])

    def test_sync_parent_status_already_in_progress(self) -> None:
        story = make_issue(20, "type: story", parent=14)
        epic = make_issue(14, "type: epic", "status: in-progress", title="Domain Epic")

        def mock_runner(*args: str, **kwargs: object) -> str:
            if args[1] == "view" and args[2] == "20":
                return json.dumps(story)
            if args[1] == "view" and args[2] == "14":
                return json.dumps(epic)
            raise AssertionError(f"Unexpected edit call: {args}")

        res = sync_parent_status(20, set_in_progress=True, runner=mock_runner)

        self.assertEqual(res["parent_number"], 14)
        self.assertEqual(res["parent_status"], "in-progress")
        self.assertFalse(res["updated"])

    def test_main_cli_json(self) -> None:
        story = make_issue(20, "type: story", parent=14)
        epic = make_issue(14, "type: epic", "status: in-progress", title="Domain Epic")

        def mock_runner(*args: str, **kwargs: object) -> str:
            if args[1] == "view" and args[2] == "20":
                return json.dumps(story)
            if args[1] == "view" and args[2] == "14":
                return json.dumps(epic)
            raise AssertionError(f"Unexpected call: {args}")

        with (
            mock.patch("gh_parent_issue.gh", side_effect=mock_runner),
            mock.patch("sys.stdout.write") as mock_write,
        ):
            code = main(["20", "--json"])
            self.assertEqual(code, 0)
            written = "".join(call.args[0] for call in mock_write.call_args_list)
            parsed = json.loads(written)
            self.assertEqual(parsed["parent_number"], 14)

    def test_main_cli_text_outputs(self) -> None:
        with (
            mock.patch(
                "gh_parent_issue.sync_parent_status",
                return_value={"parent_number": None, "updated": False},
            ),
            mock.patch("builtins.print") as mock_print,
        ):
            main(["20"])
            mock_print.assert_called_with("Issue #20 has no parent epic.")

        with (
            mock.patch(
                "gh_parent_issue.sync_parent_status",
                return_value={
                    "parent_number": 14,
                    "parent_title": "Epic 14",
                    "previous_status": "planned",
                    "parent_status": "in-progress",
                    "updated": True,
                },
            ),
            mock.patch("builtins.print") as mock_print,
        ):
            main(["20", "--set-in-progress"])
            mock_print.assert_called_with(
                "Promoted Parent Epic #14 ('Epic 14') from status: planned to status: in-progress"
            )

        with (
            mock.patch(
                "gh_parent_issue.sync_parent_status",
                return_value={
                    "parent_number": 14,
                    "parent_title": "Epic 14",
                    "parent_status": "in-progress",
                    "updated": False,
                },
            ),
            mock.patch("builtins.print") as mock_print,
        ):
            main(["20"])
            mock_print.assert_called_with("Parent Epic #14 ('Epic 14') status: in-progress")


if __name__ == "__main__":
    unittest.main()
