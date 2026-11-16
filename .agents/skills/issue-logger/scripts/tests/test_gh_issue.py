import unittest

from gh_issue import PLACEHOLDER, add_child_line, rank, render, validate

STORY = {
    "type": "story", "parent": 48, "title": "Order notes", "description": "As a manager, I want notes.",
    "ac": ["Notes saved"], "priority": "P1", "area": "orders", "wave": 3,
}
BUG = {
    "type": "bug", "title": "Totals wrong", "description": "Total off by one cent", "steps": ["Open order"],
    "expected": "Correct total", "severity": "critical", "area": "orders",
}
EPIC = {"type": "epic", "title": "Loyalty", "description": "Points", "priority": "P2", "area": "customers"}


def issue(number: int, *labels: str, milestone: str | None = "v0.9 MVP", title: str = "t") -> dict:
    return {
        "number": number, "title": title, "labels": [{"name": n} for n in labels],
        "milestone": {"title": milestone} if milestone else None,
    }


class ValidateTest(unittest.TestCase):
    def test_valid_specs_pass(self) -> None:
        for spec in (STORY, BUG, EPIC, {**EPIC, "stories": [{k: v for k, v in STORY.items() if k != "parent"}]}):
            self.assertEqual(validate(spec), [], spec["type"])

    def test_unknown_type(self) -> None:
        self.assertIn("'type' must be", validate({"type": "task", "title": "x"})[0])

    def test_story_requires_fields_and_parent(self) -> None:
        errors = "\n".join(validate({"type": "story", "title": "x"}))
        for field in ("description", "area", "ac", "priority", "parent"):
            self.assertIn(f"'{field}'", errors)

    def test_nested_story_must_not_set_parent(self) -> None:
        errors = validate({**EPIC, "stories": [STORY]})
        self.assertTrue(any("must not set 'parent'" in e for e in errors))

    def test_invalid_enums(self) -> None:
        errors = "\n".join(validate({**STORY, "wave": 9, "milestone": "v2"}))
        for field in ("wave", "milestone"):
            self.assertIn(f"'{field}'", errors)

    def test_bug_requires_severity(self) -> None:
        self.assertTrue(any("'severity'" in e for e in validate({**BUG, "severity": "blocker"})))

    def test_null_milestone_allowed(self) -> None:
        self.assertEqual(validate({**EPIC, "milestone": None}), [])


class RenderTest(unittest.TestCase):
    def test_story_labels_and_sections(self) -> None:
        title, body, labels = render(STORY, 48)
        self.assertEqual(title, "Order notes")
        self.assertIn("### Parent Epic\n\n#48", body)
        self.assertIn("- [ ] Notes saved", body)
        self.assertNotIn("Review Gate", body)
        self.assertEqual(labels, ["type: story", "status: planned", "priority: P1", "area: orders",
                                  "wave: 3"])

    def test_bug_priority_from_severity_and_title_prefix(self) -> None:
        title, body, labels = render(BUG, None)
        self.assertEqual(title, "Bug: Totals wrong")
        self.assertIn("priority: P0", labels)
        self.assertIn("1. Open order", body)
        self.assertEqual(render({**BUG, "priority": "P2"}, None)[2][2], "priority: P2")

    def test_epic_title_children_and_waves(self) -> None:
        title, body, labels = render(EPIC, None)
        self.assertEqual(title, "Epic: Loyalty")
        self.assertIn(PLACEHOLDER, body)
        child = {k: v for k, v in STORY.items() if k != "parent"}
        _, body, labels = render({**EPIC, "stories": [child]}, None)
        self.assertIn("- [ ] Order notes", body)
        self.assertIn("wave: 3", labels)


class AddChildLineTest(unittest.TestCase):
    BODY = f"### Description\n\nd\n\n### Child Stories\n\n{PLACEHOLDER}\n\n### Priority\n\nP1\n"

    def test_replaces_placeholder_and_keeps_following_sections(self) -> None:
        body = add_child_line(self.BODY, 7, "Fix totals")
        self.assertNotIn(PLACEHOLDER, body)
        self.assertIn("- [ ] #7 — Fix totals\n\n### Priority", body)

    def test_appends_and_is_idempotent(self) -> None:
        body = add_child_line(add_child_line(self.BODY, 7, "a"), 8, "b")
        self.assertIn("#7 — a\n- [ ] #8 — b", body)
        self.assertEqual(add_child_line(body, 8, "b"), body)

    def test_body_without_child_section_unchanged(self) -> None:
        self.assertEqual(add_child_line("### Description\n\nd", 1, "x"), "### Description\n\nd")


class RankTest(unittest.TestCase):
    ISSUES = [
        issue(1, "type: epic", "priority: P0"),
        issue(2, "type: story", "priority: P1", "wave: 1"),
        issue(3, "type: story", "priority: P0", "wave: 2"),
        issue(4, "type: story", "priority: P0", "wave: 1"),
        issue(5, "type: story", "priority: P0", "wave: 1", "status: in-progress"),
        issue(6, "type: story", "priority: P3", "wave: 5", milestone="Backlog / v1.x"),
        issue(7, "type: bug", "priority: P2", milestone=None),
        issue(8, "type: bug", "priority: P0", milestone=None),
    ]

    def numbers(self, lines: list[str]) -> list[int]:
        return [int(line.split()[0][1:]) for line in lines]

    def test_stories_by_wave_then_priority_excluding_epics_busy_and_other_milestones(self) -> None:
        lines, skipped = rank(self.ISSUES, "story", "v0.9 MVP")
        self.assertEqual(self.numbers(lines), [4, 2, 3])
        self.assertEqual(skipped, 2)

    def test_milestone_filter_disabled(self) -> None:
        self.assertIn(6, self.numbers(rank(self.ISSUES, "story", None)[0]))

    def test_bugs_by_priority_regardless_of_milestone(self) -> None:
        lines, skipped = rank(self.ISSUES, "bug", "v0.9 MVP")
        self.assertEqual(self.numbers(lines), [8, 7])
        self.assertEqual(skipped, 3)

    def test_all_ranks_by_priority_first(self) -> None:
        lines, skipped = rank(self.ISSUES, "all", "v0.9 MVP")
        self.assertEqual(self.numbers(lines), [8, 4, 3, 2, 7])
        self.assertEqual(skipped, 0)


if __name__ == "__main__":
    unittest.main()
