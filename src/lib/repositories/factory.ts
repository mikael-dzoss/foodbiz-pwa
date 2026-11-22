import "server-only";

import { getServerEnv, type DataSource } from "@/config/env";
import type { Repositories } from "@/domain/repositories";
import { getMockRepositories } from "./mock";
import {
  createSupabaseRepositories,
  getSupabaseRepositories,
  type SupabaseClientFactory,
} from "./supabase";

export function getRepositories(
  sourceOverride?: DataSource,
  clientOrFactory?: SupabaseClientFactory,
): Repositories {
  const dataSource = sourceOverride ?? getServerEnv().DATA_SOURCE;

  switch (dataSource) {
    case "mock":
      return getMockRepositories();
    case "supabase":
      return clientOrFactory
        ? createSupabaseRepositories(clientOrFactory)
        : getSupabaseRepositories();
  }
}
