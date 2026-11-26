import type { Repositories } from "@/domain/repositories";
import { beforeEach, describe } from "vitest";
import type { OpeningHoursSetter } from "./order-placement.contract";

import { DEMO_BUSINESS_ID } from "../../mock/fixtures";
import { describeBusinessRepositoryContract } from "./business.contract";
import { describeCategoryRepositoryContract } from "./category.contract";
import { describeExpenseRepositoryContract } from "./expense.contract";
import { describeGuestRepositoryContract } from "./guest.contract";
import { describeMemberRepositoryContract } from "./member.contract";
import { describeOrderRepositoryContract } from "./order.contract";
import { describeOrderPlacementContract } from "./order-placement.contract";
import { describeOrderStateContract } from "./order-state.contract";
import { describePickupLocationRepositoryContract } from "./pickup-location.contract";
import { describeProductRepositoryContract } from "./product.contract";

export interface ContractSuiteOptions {
  businessId?: string;
  /**
   * Repositories acting as a member who is NOT an owner (manager or staff) on the same data as the
   * main repositories. When given, the owner-only rules run: payment settings, slug and hard deletes
   * must be refused with code FORBIDDEN while everything else keeps working.
   */
  nonOwnerRepositories?: () => Promise<Repositories> | Repositories;
  /**
   * Sets the business's weekly opening hours and exceptions (as its owner). The storefront rules
   * depend on the current time, so the suite clears the hours before every test (nothing to
   * check) and the placement contract sets what each of its cases needs.
   */
  setOpeningHours?: OpeningHoursSetter;
}

export function describeRepositoryContracts(
  adapterName: string,
  getRepositories: () => Promise<Repositories> | Repositories,
  options: ContractSuiteOptions = {},
): void {
  const businessId = options.businessId ?? DEMO_BUSINESS_ID;

  describe(`Repository Contracts Suite [${adapterName}]`, () => {
    beforeEach(async () => {
      await options.setOpeningHours?.({ weeklyHours: null, hoursExceptions: [] });
    });

    describeProductRepositoryContract(getRepositories, businessId);
    describeCategoryRepositoryContract(getRepositories, businessId);
    describeOrderRepositoryContract(getRepositories, businessId);
    describeOrderStateContract(getRepositories, businessId, options.nonOwnerRepositories);
    describeOrderPlacementContract(getRepositories, businessId, {
      setOpeningHours: options.setOpeningHours,
      managerRepositories: getRepositories,
    });
    describeGuestRepositoryContract(getRepositories, businessId);
    describeExpenseRepositoryContract(getRepositories, businessId, options.nonOwnerRepositories);
    describeBusinessRepositoryContract(getRepositories, businessId, options.nonOwnerRepositories);
    describeMemberRepositoryContract(getRepositories, businessId);
    describePickupLocationRepositoryContract(getRepositories, businessId);
  });
}

export {
  describeOrderPlacementContract,
  describeOrderStateContract,
  describeBusinessRepositoryContract,
  describeCategoryRepositoryContract,
  describeExpenseRepositoryContract,
  describeGuestRepositoryContract,
  describeMemberRepositoryContract,
  describeOrderRepositoryContract,
  describePickupLocationRepositoryContract,
  describeProductRepositoryContract,
};
