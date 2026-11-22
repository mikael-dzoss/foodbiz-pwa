import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AccountSettings } from "../components/account-settings";
import { getDictionary, DEFAULT_LOCALE } from "@/domain/i18n";
import { MOCK_MANAGER_SESSION, type ManagerSession } from "@/domain/auth";

const mockSession: ManagerSession = MOCK_MANAGER_SESSION;

const dict = getDictionary(DEFAULT_LOCALE).settings;

const mockSetTheme = vi.fn();
let mockCurrentTheme = "system";

vi.mock("@/components/theme", () => ({
  useTheme: () => ({
    theme: mockCurrentTheme,
    resolvedTheme: "light",
    setTheme: (t: string) => {
      mockCurrentTheme = t;
      mockSetTheme(t);
    },
    mounted: true,
  }),
}));

const mockShowToast = vi.fn();
const mockShowError = vi.fn();
vi.mock("@/components/ui", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/ui")>();
  return { ...actual, useToast: () => ({ showToast: mockShowToast, showError: mockShowError }) };
});

vi.mock("../actions", () => ({
  switchLanguageAction: vi.fn(async (locale: string) => ({
    ok: true,
    data: locale,
  })),
}));

afterEach(() => {
  vi.clearAllMocks();
  mockCurrentTheme = "system";
});

describe("AccountSettings component", () => {
  it("renders manager profile details ", () => {
    render(<AccountSettings session={mockSession} dict={dict} currentLocale="en" />);

    expect(screen.getByRole("heading", { name: dict.account.title, level: 1 })).toBeDefined();
    expect(screen.getByText(mockSession.user.name)).toBeDefined();
    expect(screen.getByText(mockSession.user.email)).toBeDefined();
    expect(screen.getByText("Owner & Manager")).toBeDefined();
    expect(screen.getByTestId("back-to-settings")).toBeDefined();
  });

  it("handles theme selection changes", () => {
    render(<AccountSettings session={mockSession} dict={dict} currentLocale="en" />);

    const darkBtn = screen.getByTestId("theme-dark");
    fireEvent.click(darkBtn);
    expect(mockSetTheme).toHaveBeenCalledWith("dark");

    const lightBtn = screen.getByTestId("theme-light");
    fireEvent.click(lightBtn);
    expect(mockSetTheme).toHaveBeenCalledWith("light");

    const systemBtn = screen.getByTestId("theme-system");
    fireEvent.click(systemBtn);
    expect(mockSetTheme).toHaveBeenCalledWith("system");
  });

  it("handles language selection changes", () => {
    render(<AccountSettings session={mockSession} dict={dict} currentLocale="en" />);

    const frBtn = screen.getByTestId("lang-fr");
    fireEvent.click(frBtn);
    expect(screen.getByTestId("lang-fr")).toBeDefined();
  });

  it("renders soon items for devices, export and account deletion", () => {
    render(<AccountSettings session={mockSession} dict={dict} currentLocale="en" />);

    expect(screen.getByTestId("soon-devices")).toBeDefined();
    expect(screen.getByTestId("soon-export-data")).toBeDefined();
    expect(screen.getByTestId("soon-delete-account")).toBeDefined();
  });

  it("renders sign out button", () => {
    render(<AccountSettings session={mockSession} dict={dict} currentLocale="en" />);

    expect(screen.getByRole("button", { name: dict.account.signOut })).toBeDefined();
  });

  it("moves the language and theme selection with the arrow keys (radiogroup)", async () => {
    render(<AccountSettings session={mockSession} dict={dict} currentLocale="en" />);
    const en = screen.getByTestId("lang-en");
    expect(en.getAttribute("aria-checked")).toBe("true");
    expect(en.tabIndex).toBe(0);
    expect(screen.getByTestId("lang-fr").tabIndex).toBe(-1);
    fireEvent.keyDown(en, { key: "ArrowRight" });
    await waitFor(() =>
      expect(screen.getByTestId("lang-fr").getAttribute("aria-checked")).toBe("true"),
    );
    const system = screen.getByTestId("theme-system");
    fireEvent.keyDown(system, { key: "ArrowRight" });
    expect(mockSetTheme).toHaveBeenCalledWith("light");
  });
});
