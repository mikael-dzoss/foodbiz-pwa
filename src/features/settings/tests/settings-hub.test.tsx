import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { SettingsHub } from "../components/settings-hub";
import { getDictionary, DEFAULT_LOCALE } from "@/domain/i18n";
import { MOCK_MANAGER_SESSION, type ManagerSession } from "@/domain/auth";

const mockSession: ManagerSession = {
  ...MOCK_MANAGER_SESSION,
  user: {
    ...MOCK_MANAGER_SESSION.user,
    role: "manager",
  },
};

const dict = getDictionary(DEFAULT_LOCALE).settings;

vi.mock("@/components/ui", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/ui")>();
  return {
    ...actual,
    useToast: () => ({
      showToast: vi.fn(),
    }),
  };
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("SettingsHub component", () => {
  it("renders page header and manager profile card", () => {
    render(<SettingsHub session={mockSession} dict={dict} />);

    expect(screen.getByRole("heading", { name: dict.title, level: 1 })).toBeDefined();
    expect(screen.getByText(mockSession.user.name)).toBeDefined();
    expect(screen.getByText(mockSession.user.email)).toBeDefined();
    expect(screen.getByText("manager")).toBeDefined();
  });

  it("renders core sections and navigation links", () => {
    render(<SettingsHub session={mockSession} dict={dict} />);

    expect(screen.getByText(dict.coreSection)).toBeDefined();
    expect(screen.getByTestId("link-account-settings")).toBeDefined();
    expect(screen.getByTestId("link-business-settings")).toBeDefined();
  });

  it("renders operations and system navigation links", () => {
    render(<SettingsHub session={mockSession} dict={dict} />);

    expect(screen.getByTestId("link-ordering-settings")).toBeDefined();
    expect(screen.getByTestId("link-payment-settings")).toBeDefined();
    expect(screen.getByTestId("link-inventory-settings")).toBeDefined();
    expect(screen.getByTestId("link-notifications-settings")).toBeDefined();
    expect(screen.getByTestId("soon-team")).toBeDefined();
    expect(screen.getByTestId("link-about")).toBeDefined();
  });

  it("renders sign out button", () => {
    render(<SettingsHub session={mockSession} dict={dict} />);

    const signOutBtn = screen.getByRole("button", { name: dict.account.signOut });
    expect(signOutBtn).toBeDefined();
  });
});
