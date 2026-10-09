# Shared Repository Contract Test Suite

This suite verifies that any implementation of `Repositories` conforms to the contract expected by FoodBiz domain and application logic.

## Architecture

The contract suite is parameterised and independent of any concrete storage engine:

- `src/lib/repositories/tests/contracts/product.contract.ts`
- `src/lib/repositories/tests/contracts/category.contract.ts`
- `src/lib/repositories/tests/contracts/order.contract.ts`
- `src/lib/repositories/tests/contracts/guest.contract.ts`
- `src/lib/repositories/tests/contracts/expense.contract.ts`
- `src/lib/repositories/tests/contracts/business.contract.ts`
- `src/lib/repositories/tests/contracts/member.contract.ts`

The runner function is exported from `src/lib/repositories/tests/contracts/index.ts`:

```typescript
describeRepositoryContracts(
  adapterName: string,
  getRepositories: () => Promise<Repositories> | Repositories,
  options?: { businessId?: string }
): void
```

## Running Against Mock Adapter (CI)

The mock adapter is tested in CI via `src/lib/repositories/tests/mock-adapter.test.ts`.

## Hook for Supabase Adapter (Epic #18)

When implementing the Supabase adapter in Epic #18:

1. Create a test file, e.g. `src/lib/repositories/tests/supabase-adapter.test.ts` (configured to run when local Supabase or test container is active).
2. Instantiate the Supabase repository adapter using the Supabase client.
3. Hook into `describeRepositoryContracts`:

```typescript
import { beforeAll, beforeEach, describe } from "vitest";
import { describeRepositoryContracts } from "./contracts";
import { createSupabaseRepositories } from "../supabase";
import { getTestSupabaseClient, resetTestDatabase } from "@/lib/supabase/test-utils";

describe("Supabase Adapter Contract Conformance", () => {
  let supabaseRepos: Repositories;
  const testBusinessId = "11111111-1111-4111-8111-111111111111";

  beforeAll(async () => {
    const client = await getTestSupabaseClient();
    supabaseRepos = createSupabaseRepositories(client);
  });

  beforeEach(async () => {
    await resetTestDatabase();
  });

  describeRepositoryContracts("Supabase Adapter", () => supabaseRepos, {
    businessId: testBusinessId,
  });
});
```
