/**
 * Core item type registrations — weapon, armor, gear, edge, hindrance, ammo.
 *
 * Archetype-specific types (hex, miracle, favor, gizmo) are registered by
 * their respective archetype manifests. This file handles the shared types
 * common to all characters.
 *
 * Import this once from module/deadlands-classic.mjs in the init hook.
 *
 * @license MIT
 */

import { ItemRegistry } from "../item-registry.mjs";
import { EdgeDataModel } from "./edge-data.mjs";
import { HindranceDataModel } from "./hindrance-data.mjs";

// ── Typed item models ─────────────────────────────────────────────────────────

ItemRegistry.register({
  id: "edge",
  label: "TYPES.Item.edge",
  dataModel: EdgeDataModel,
});

ItemRegistry.register({
  id: "hindrance",
  label: "TYPES.Item.hindrance",
  dataModel: HindranceDataModel,
});

// ── Untyped item stubs (schema lives in future phases) ────────────────────────
// weapon, armor, gear, and ammo are declared in documentTypes but their
// TypeDataModel subclasses are added in later phases. For now they resolve to
// the Foundry base TypeDataModel via CONFIG.Item.dataModels omission.
