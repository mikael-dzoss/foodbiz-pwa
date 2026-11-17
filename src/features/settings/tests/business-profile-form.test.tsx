import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
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
    ok: true,
    data: mockBusiness,
  })),
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe("BusinessProfileForm component", () => {
  it("renders, submits and discards social links", async () => {
    const business = { ...mockBusiness, instagramUrl: "https://instagram.com/original" };
    render(<BusinessProfileForm business={business} dict={dict} />);
    for (const [field, label] of [
      ["instagramUrl", dict.business.instagramLabel],
      ["facebookUrl", dict.business.facebookLabel],
      ["tiktokUrl", dict.business.tiktokLabel],
    ]) {
      const input = screen.getByLabelText(label) as HTMLInputElement;
      expect(input.type).toBe("url");
      fireEvent.change(input, { target: { value: `https://example.com/${field}` } });
    }
    fireEvent.click(screen.getByTestId("button-discard"));
    expect((screen.getByLabelText(dict.business.instagramLabel) as HTMLInputElement).value).toBe(
      business.instagramUrl,
    );
    expect((screen.getByLabelText(dict.business.tiktokLabel) as HTMLInputElement).value).toBe("");
    for (const [field, label] of [
      ["instagramUrl", dict.business.instagramLabel],
      ["facebookUrl", dict.business.facebookLabel],
      ["tiktokUrl", dict.business.tiktokLabel],
    ]) {
      fireEvent.change(screen.getByLabelText(label), {
        target: { value: `https://example.com/${field}` },
      });
    }
    fireEvent.click(screen.getByTestId("button-save-profile"));
    await waitFor(() =>
      expect(actions.updateBusinessProfileAction).toHaveBeenCalledWith(
        expect.objectContaining({
          instagramUrl: "https://example.com/instagramUrl",
          facebookUrl: "https://example.com/facebookUrl",
          tiktokUrl: "https://example.com/tiktokUrl",
        }),
      ),
    );
  });
  it("announces social URL validation errors", async () => {
    vi.mocked(actions.updateBusinessProfileAction).mockResolvedValueOnce({
      ok: false,
      code: "INTERNAL",
      message: "Invalid URL",
      fieldErrors: { instagramUrl: ["HTTPS required"] },
    });
    render(<BusinessProfileForm business={mockBusiness} dict={dict} />);
    fireEvent.click(screen.getByTestId("button-save-profile"));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("HTTPS required"));
  });
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
      ok: false,
      code: "INTERNAL",
      message: "Store web address slug is already taken",
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

  it("renders, submits, discards, and validates optional latitude and longitude inputs (#195)", async () => {
    const businessWithCoords: Business = {
      ...mockBusiness,
      latitude: 48.8553,
      longitude: 2.3726,
    };

    render(<BusinessProfileForm business={businessWithCoords} dict={dict} />);

    expect(screen.getByText(dict.business.coordinatesHelper)).toBeDefined();

    const latInput = screen.getByTestId("input-business-latitude") as HTMLInputElement;
    const lngInput = screen.getByTestId("input-business-longitude") as HTMLInputElement;
    expect(latInput.value).toBe("48.8553");
    expect(lngInput.value).toBe("2.3726");

    fireEvent.change(latInput, { target: { value: "48.86" } });
    fireEvent.change(lngInput, { target: { value: "2.35" } });
    fireEvent.click(screen.getByTestId("button-discard"));
    expect(latInput.value).toBe("48.8553");
    expect(lngInput.value).toBe("2.3726");

    fireEvent.change(latInput, { target: { value: "48.86" } });
    fireEvent.change(lngInput, { target: { value: "2.35" } });
    fireEvent.click(screen.getByTestId("button-save-profile"));
    await waitFor(() => {
      expect(actions.updateBusinessProfileAction).toHaveBeenCalledWith(
        expect.objectContaining({
          latitude: 48.86,
          longitude: 2.35,
        }),
      );
    });

    // Wait for the first save transition to settle before submitting again.
    await waitFor(() =>
      expect((screen.getByTestId("button-save-profile") as HTMLButtonElement).disabled).toBe(false),
    );

    vi.mocked(actions.updateBusinessProfileAction).mockResolvedValueOnce({
      ok: false,
      code: "INTERNAL",
      message: "Invalid coordinates",
      fieldErrors: {
        latitude: ["Latitude must be between -90 and 90"],
        longitude: ["Longitude must be between -180 and 180"],
      },
    });

    fireEvent.click(screen.getByTestId("button-save-profile"));
    await waitFor(() => {
      expect(screen.getByText("Latitude must be between -90 and 90")).toBeDefined();
      expect(screen.getByText("Longitude must be between -180 and 180")).toBeDefined();
    });
  });

  it("locks the slug with an explanation for a member who is not the owner", () => {
    const reason = getDictionary(DEFAULT_LOCALE).common.ownerOnlyNotice;
    render(<BusinessProfileForm business={mockBusiness} dict={dict} slugLockedReason={reason} />);

    expect((screen.getByTestId("input-business-slug") as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByTestId("slug-owner-only-notice").textContent).toBe(reason);
  });

  it("lets the owner edit the slug", () => {
    render(<BusinessProfileForm business={mockBusiness} dict={dict} />);

    expect((screen.getByTestId("input-business-slug") as HTMLInputElement).disabled).toBe(false);
    expect(screen.queryByTestId("slug-owner-only-notice")).toBeNull();
  });
});
