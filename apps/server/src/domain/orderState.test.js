import test from "node:test";
import assert from "node:assert/strict";
import { canTransitionOrder, OrderStatus } from "./orderState.js";

test("order transitions allow created -> queued", () => {
  assert.equal(canTransitionOrder(OrderStatus.CREATED, OrderStatus.QUEUED), true);
});

test("order transitions block completed -> processing", () => {
  assert.equal(canTransitionOrder(OrderStatus.COMPLETED, OrderStatus.PROCESSING), false);
});

test("order transitions allow failed -> queued", () => {
  assert.equal(canTransitionOrder(OrderStatus.FAILED, OrderStatus.QUEUED), true);
});

