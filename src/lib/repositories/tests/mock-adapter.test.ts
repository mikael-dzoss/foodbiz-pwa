import { beforeEach, describe } from "vitest";

import { createMockRepositories, type MockRepositories } from "../mock";
import { describeRepositoryContracts } from "./contracts";

describe("Mock Adapter Contract Conformance", () => {
  let mockRepos: MockRepositories;

  beforeEach(() => {
    mockRepos = createMockRepositories();
  });

  describeRepositoryContracts("In-Memory Mock Adapter", () => mockRepos);
});
