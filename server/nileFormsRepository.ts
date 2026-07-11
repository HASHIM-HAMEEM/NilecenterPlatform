import { createNileFormsSeedState } from "../shared/nileFormsFixtures.js";
import type { NileFormsState } from "../shared/nileForms.js";

export class NileFormsRepositoryUnavailableError extends Error {
  constructor(message = "Nile Forms persistence is temporarily unavailable.") {
    super(message);
    this.name = "NileFormsRepositoryUnavailableError";
  }
}

export type NileFormsRepository = {
  kind: "memory";
  read(): Promise<NileFormsState>;
  transaction<T>(
    operation: (state: NileFormsState) => T | Promise<T>
  ): Promise<T>;
  reset?(): Promise<void>;
};

function clone<T>(value: T): T {
  return structuredClone(value);
}

export function createMemoryNileFormsRepository(
  initialState: NileFormsState = createNileFormsSeedState()
): NileFormsRepository {
  let state = clone(initialState);
  let serial: Promise<void> = Promise.resolve();

  return {
    kind: "memory",
    async read() {
      await serial;
      return clone(state);
    },
    async transaction<T>(operation: (draft: NileFormsState) => T | Promise<T>) {
      let resolveResult: (value: T | PromiseLike<T>) => void;
      let rejectResult: (reason?: unknown) => void;
      const result = new Promise<T>((resolve, reject) => {
        resolveResult = resolve;
        rejectResult = reject;
      });

      serial = serial
        .then(async () => {
          const draft = clone(state);
          try {
            const operationResult = await operation(draft);
            state = draft;
            resolveResult(clone(operationResult));
          } catch (error) {
            rejectResult(error);
          }
        })
        .catch(() => undefined);

      return result;
    },
    async reset() {
      await serial;
      state = createNileFormsSeedState();
    },
  };
}

let defaultRepository: NileFormsRepository = createMemoryNileFormsRepository();

export function getNileFormsRepository() {
  return defaultRepository;
}

export function setNileFormsRepository(repository: NileFormsRepository) {
  const previous = defaultRepository;
  defaultRepository = repository;
  return () => {
    defaultRepository = previous;
  };
}

export function resetDefaultNileFormsRepository() {
  defaultRepository = createMemoryNileFormsRepository();
}
