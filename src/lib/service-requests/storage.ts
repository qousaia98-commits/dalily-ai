export function buildServiceRequestMediaPath(
  customerId: string,
  requestId: string,
  fileName: string,
): string {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${customerId}/${requestId}/${Date.now()}-${safeName}`;
}
