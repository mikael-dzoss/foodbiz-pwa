import "server-only";

import { getServerEnv, type DataSource } from "@/config/env";
import type { Repositories } from "@/domain/repositories";
import { getMockRepositories } from "./mock";

export function getRepositories(sourceOverride?: DataSource): Repositories {
  const dataSource = sourceOverride ?? getServerEnv().DATA_SOURCE;

  switch (dataSource) {
    case "mock":
      return getMockRepositories();
    case "supabase":
      throw new Error("Supabase repository adapter is not yet implemented (planned for E18)");
  }
}
