import "server-only";
import type { RegisteredOp } from "../op";
import { catalogOps } from "./catalog";
import { contentOps } from "./content";
import { customerOps } from "./customers";
import { inventoryOps } from "./inventory";
import { orderOps } from "./orders";
import { promotionOps } from "./promotions";
import { settingsOps } from "./settings";
import { teamOps } from "./team";

const all: RegisteredOp[] = [...teamOps, ...catalogOps, ...orderOps, ...customerOps, ...inventoryOps, ...promotionOps, ...contentOps, ...settingsOps];

/** Every admin mutation, by name. Adding a feature means adding an entry here; the dispatcher does the rest. */
export const OPS = new Map<string, RegisteredOp>(all.map((op) => [op.name, op]));

if (OPS.size !== all.length) throw new Error("Duplicate admin operation name.");
