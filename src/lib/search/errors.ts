export class SearchDatabaseError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "SearchDatabaseError";
  }
}

export function isSearchDatabaseError(error: unknown): error is SearchDatabaseError {
  return error instanceof SearchDatabaseError;
}
