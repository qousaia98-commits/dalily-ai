export function validationError(error: {
  flatten: () => { fieldErrors: Record<string, string[]> };
}) {
  return {
    success: false,
    error: "validation_error" as const,
    fieldErrors: error.flatten().fieldErrors,
  };
}
