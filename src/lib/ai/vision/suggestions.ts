/**
 * Suggest tools / materials from detected objects & damage (provider assist).
 */

import type { DetectedDamage, DetectedVisionObject } from "./types";

const TOOLS_BY_OBJECT: Record<string, string[]> = {
  outlet: ["voltage_tester", "screwdriver_set", "wire_stripper"],
  switch: ["voltage_tester", "screwdriver_set"],
  fuse_box: ["multimeter", "insulated_pliers", "flashlight"],
  cable: ["wire_stripper", "electrical_tape", "wire_nuts"],
  wire: ["wire_stripper", "electrical_tape"],
  lamp: ["screwdriver_set", "ladder"],
  sink: ["adjustable_wrench", "basin_wrench", "plunger"],
  toilet: ["plunger", "adjustable_wrench"],
  pipe: ["pipe_wrench", "pipe_cutter", "bucket"],
  faucet: ["adjustable_wrench", "allen_keys", "plumber_tape"],
  drain: ["drain_snake", "plunger", "bucket"],
  boiler: ["multimeter", "pipe_wrench", "flashlight"],
  wall: ["putty_knife", "sandpaper", "drop_cloth"],
  ceiling: ["ladder", "putty_knife", "drop_cloth"],
  crack: ["putty_knife", "filler_knife"],
  mold: ["PPE_mask", "scrub_brush", "fungicide"],
};

const MATERIALS_BY_DAMAGE: Record<string, string[]> = {
  leak: ["plumber_tape", "pipe_sealant", "replacement_washer"],
  broken_pipe: ["pipe_coupling", "PVC_or_copper_section", "plumber_tape"],
  rust: ["replacement_fitting", "anticorrosion_tape"],
  crack: ["filler", "primer", "paint"],
  burn_marks: ["replacement_outlet_or_switch", "electrical_tape"],
  water_damage: ["dehumidifier_note", "drywall_patch", "primer"],
  mold: ["mold_remover", "primer", "paint"],
  missing_parts: ["replacement_part_kit"],
  loose_cables: ["wire_nuts", "cable_clips", "electrical_tape"],
  blocked_drain: ["drain_cleaner_gel", "gloves"],
  chipped_paint: ["primer", "matching_paint"],
};

export function suggestToolsFromVision(
  objects: DetectedVisionObject[],
  damages: DetectedDamage[],
): string[] {
  const set = new Set<string>();
  for (const o of objects) {
    for (const [key, tools] of Object.entries(TOOLS_BY_OBJECT)) {
      if (o.name.includes(key)) tools.forEach((t) => set.add(t));
    }
  }
  if (damages.some((d) => d.type.includes("loose_cables") || d.type.includes("burn"))) {
    ["voltage_tester", "multimeter"].forEach((t) => set.add(t));
  }
  if (damages.some((d) => d.type.includes("leak") || d.type.includes("pipe"))) {
    ["bucket", "pipe_wrench"].forEach((t) => set.add(t));
  }
  return Array.from(set).slice(0, 10);
}

export function suggestMaterialsFromVision(damages: DetectedDamage[]): string[] {
  const set = new Set<string>();
  for (const d of damages) {
    for (const [key, mats] of Object.entries(MATERIALS_BY_DAMAGE)) {
      if (d.type.includes(key)) mats.forEach((m) => set.add(m));
    }
  }
  return Array.from(set).slice(0, 10);
}
