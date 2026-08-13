/**
 * Routing module — Phase 3 route-fit between scheduled jobs is live in dispatch/.
 */
export const routingModule = {
  id: "routing",
  status: "phase3" as const,
  impl: ["src/lib/ai/dispatch/route.ts", "src/lib/ai/dispatch/eta.ts"],
  future: ["live traffic", "multi-stop day packing"],
};
