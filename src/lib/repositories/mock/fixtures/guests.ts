import type { Guest } from "@/domain/guest";
import { DEMO_BUSINESS_ID } from "./business";
import { DEMO_CATALOG_GUESTS } from "./catalog.data";

const GUEST_SLOTS: readonly { readonly id: string; readonly createdAt: string }[] = [
  { id: "44444444-4444-4444-8444-444444444401", createdAt: "2026-08-05T08:30:00.000Z" },
  { id: "44444444-4444-4444-8444-444444444402", createdAt: "2026-08-10T09:15:00.000Z" },
  { id: "44444444-4444-4444-8444-444444444403", createdAt: "2026-08-15T11:00:00.000Z" },
  { id: "44444444-4444-4444-8444-444444444404", createdAt: "2026-08-20T14:20:00.000Z" },
  { id: "44444444-4444-4444-8444-444444444405", createdAt: "2026-08-25T10:05:00.000Z" },
  { id: "44444444-4444-4444-8444-444444444406", createdAt: "2026-08-30T16:45:00.000Z" },
];

export const demoGuests: Guest[] = DEMO_CATALOG_GUESTS.map((guest, index) => {
  const slot = GUEST_SLOTS[index];
  return {
    id: slot.id,
    businessId: DEMO_BUSINESS_ID,
    name: guest.name,
    phone: guest.phone,
    email: guest.email,
    address: guest.address,
    notes: guest.notes,
    createdAt: slot.createdAt,
  };
});
