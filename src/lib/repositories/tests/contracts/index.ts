import type { Repositories } from "@/domain/repositories";
import { describe } from "vitest";

import { DEMO_BUSINESS_ID } from "../../mock/fixtures";
import { describeBusinessRepositoryContract } from "./business.contract";
import { describeCategoryRepositoryContract } from "./category.contract";
import { describeExpenseRepositoryContract } from "./expense.contract";
import { describeGuestRepositoryContract } from "./guest.contract";
import { describeMemberRepositoryContract } from "./member.contract";
import { describeOrderRepositoryContract } from "./order.contract";
import { describeOrderPlacementContract } from "./order-placement.contract";
import { describeProductRepositoryContract } from "./product.contract";

export interface ContractSuiteOptions {
  businessId?: string;
}

export function describeRepositoryContracts(
  adapterName: string,
  getRepositories: () => Promise<Repositories> | Repositories,
  options: ContractSuiteOptions = {},
): void {
  const businessId = options.businessId ?? DEMO_BUSINESS_ID;

  describe(`Repository Contracts Suite [${adapterName}]`, () => {
    describeProductRepositoryContract(getRepositories, businessId);
    describeCategoryRepositoryContract(getRepositories, businessId);
    describeOrderRepositoryContract(getRepositories, businessId);
    describeOrderPlacementContract(getRepositories, businessId);
    describeGuestRepositoryContract(getRepositories, businessId);
    describeExpenseRepositoryContract(getRepositories, businessId);
    describeBusinessRepositoryContract(getRepositories, businessId);
    describeMemberRepositoryContract(getRepositories, businessId);
  });
}

export {
  describeOrderPlacementContract,
  describeBusinessRepositoryContract,
  describeCategoryRepositoryContract,
  describeExpenseRepositoryContract,
  describeGuestRepositoryContract,
  describeMemberRepositoryContract,
  describeOrderRepositoryContract,
  describeProductRepositoryContract,
};
