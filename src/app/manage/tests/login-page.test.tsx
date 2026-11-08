import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import ManagerLoginPage from "../login/page";

describe("ManagerLoginPage", () => {
  it("renders manager sign-in heading and demo sign-in button", () => {
    render(<ManagerLoginPage />);

    const heading = screen.getByRole("heading", {
      name: /manager sign-in/i,
      level: 1,
    });
    expect(heading).toBeDefined();

    const submitBtn = screen.getByRole("button", {
      name: /sign in as manager/i,
    });
    expect(submitBtn).toBeDefined();
    expect(submitBtn.getAttribute("id")).toBe("sign-in-submit-btn");
  });
});
