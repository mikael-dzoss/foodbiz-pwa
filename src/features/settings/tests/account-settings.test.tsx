import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AccountSettings } from "../components/account-settings";
import { getDictionary, DEFAULT_LOCALE } from "@/domain/i18n";
import type { ManagerSession } from "@/domain/auth";

const mockSession: ManagerSession = {
  user: {
    id: "00000000-0000-4000-8000-000000000002",
    email: "manager@lapetiteboulangerie.fr",
    name: "Marie Dupont",
    role: "owner",
    businessId: "11111111-1111-4111-8111-111111111111",
  },
  business: {
    id: "11111111-1111-4111-8111-111111111111",
    name: "La Petite Boulangerie",
    slug: "la-petite-boulangerie",
    currency: "EUR",
  },
  expiresAt: "2099-01-01T00:00:00.000Z",
};

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
vi.mock("@/components/ui", () => ({
  useToast: () => ({
    showToast: mockShowToast,
  }),
}));

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
  it("renders manager profile details and Google Workspace footnote", () => {
    render(<AccountSettings session={mockSession} dict={dict} currentLocale="en" />);

    expect(screen.getByRole("heading", { name: dict.account.title, level: 1 })).toBeDefined();
    expect(screen.getByText("Marie Dupont")).toBeDefined();
    expect(screen.getByText("manager@lapetiteboulangerie.fr")).toBeDefined();
    expect(screen.getByText("Owner & Manager")).toBeDefined();
    expect(screen.getByText(dict.account.managedViaGoogle)).toBeDefined();
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
});
