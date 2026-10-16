import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { BusinessProfileForm } from "../components/business-profile-form";
import { getDictionary, DEFAULT_LOCALE } from "@/domain/i18n";
import type { Business } from "@/domain/business";
import * as actions from "../actions";

const mockBusiness: Business = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "La Petite Boulangerie",
  slug: "la-petite-boulangerie",
  currency: "EUR",
  description: "Artisanal organic sourdough bakery and French pastries in Paris.",
  phone: "+33 1 43 55 67 89",
  email: "bonjour@lapetiteboulangerie.fr",
  whatsappNumber: "+33 6 12 34 56 78",
  address: "12 Rue de la Roquette, 75011 Paris, France",
  logoUrl: null,
  createdAt: "2026-08-01T08:00:00.000Z",
  updatedAt: "2026-08-01T08:00:00.000Z",
};

const dict = getDictionary(DEFAULT_LOCALE).settings;

const mockShowToast = vi.fn();
vi.mock("@/components/ui", () => ({
  useToast: () => ({
    showToast: mockShowToast,
  }),
}));

vi.mock("../actions", () => ({
  updateBusinessProfileAction: vi.fn(async () => ({
    success: true,
    data: mockBusiness,
  })),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("BusinessProfileForm component", () => {
  it("renders form fields pre-populated with business values", () => {
    render(<BusinessProfileForm business={mockBusiness} dict={dict} />);

    expect(screen.getByRole("heading", { name: dict.business.title, level: 1 })).toBeDefined();
    expect((screen.getByTestId("input-business-name") as HTMLInputElement).value).toBe(
      "La Petite Boulangerie",
    );
    expect((screen.getByTestId("input-business-slug") as HTMLInputElement).value).toBe(
      "la-petite-boulangerie",
    );
    expect(
      (screen.getByTestId("input-business-description") as HTMLTextAreaElement).value,
    ).toContain("Artisanal organic sourdough bakery");
    expect((screen.getByTestId("input-business-phone") as HTMLInputElement).value).toBe(
      "+33 1 43 55 67 89",
    );
    expect((screen.getByTestId("input-business-email") as HTMLInputElement).value).toBe(
      "bonjour@lapetiteboulangerie.fr",
    );
    expect((screen.getByTestId("input-business-whatsapp") as HTMLInputElement).value).toBe(
      "+33 6 12 34 56 78",
    );
    expect((screen.getByTestId("input-business-address") as HTMLTextAreaElement).value).toContain(
      "12 Rue de la Roquette",
    );

    expect(screen.getByText(dict.business.activeBadge)).toBeDefined();
    expect(screen.getByTestId("soon-cover-image")).toBeDefined();
    expect(screen.getByTestId("soon-brand-color")).toBeDefined();
  });

  it("handles input modifications and discards changes", () => {
    render(<BusinessProfileForm business={mockBusiness} dict={dict} />);

    const nameInput = screen.getByTestId("input-business-name") as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "Modified Bakery Name" } });
    expect(nameInput.value).toBe("Modified Bakery Name");

    const discardBtn = screen.getByTestId("button-discard");
    fireEvent.click(discardBtn);

    expect(nameInput.value).toBe("La Petite Boulangerie");
    expect(mockShowToast).toHaveBeenCalledWith("Changes discarded");
  });

  it("submits updated profile and calls updateBusinessProfileAction", async () => {
    render(<BusinessProfileForm business={mockBusiness} dict={dict} />);

    const nameInput = screen.getByTestId("input-business-name") as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "La Grande Boulangerie" } });

    const submitBtn = screen.getByTestId("button-save-profile");
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(actions.updateBusinessProfileAction).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "La Grande Boulangerie",
          slug: "la-petite-boulangerie",
        }),
      );
    });
  });

  it("displays validation error when action returns fieldErrors", async () => {
    vi.mocked(actions.updateBusinessProfileAction).mockResolvedValueOnce({
      success: false,
      error: "Store web address slug is already taken",
      fieldErrors: {
        slug: ["This web address is already in use by another shop"],
      },
    });

    render(<BusinessProfileForm business={mockBusiness} dict={dict} />);

    const submitBtn = screen.getByTestId("button-save-profile");
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText("This web address is already in use by another shop")).toBeDefined();
    });
  });
});
