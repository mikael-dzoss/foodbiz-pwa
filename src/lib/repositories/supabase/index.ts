import type { Repositories } from "@/domain/repositories";
import { createSupabaseRepositories, type SupabaseClientFactory } from "./adapter";

let singletonInstance: Repositories | null = null;

export function getSupabaseRepositories(): Repositories {
  if (!singletonInstance) {
    singletonInstance = createSupabaseRepositories();
  }
  return singletonInstance;
}

export { createSupabaseRepositories };
export type { SupabaseClientFactory };
