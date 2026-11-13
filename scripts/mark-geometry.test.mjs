import test from "node:test";
import assert from "node:assert/strict";
import { markGeometry, MARK_DISTANCE, MARK_RADIUS } from "../src/lib/brand/markGeometry.ts";

test("in step: centres 12 apart give a lens 12 wide and mirrored about the centre line", () => {
  const g = markGeometry(MARK_DISTANCE.step);
  assert.equal(g.lensWidth, 12);
  assert.equal(g.ax + g.bx, 48);
  assert.ok(g.lens.startsWith("M 24 "));
  // 2 * sqrt(12^2 - 6^2)
  assert.ok(Math.abs(g.lensHeight - 2 * Math.sqrt(108)) < 1e-9);
});

test("touching circles have no lens", () => {
  const g = markGeometry(MARK_DISTANCE.needs);
  assert.equal(g.lens, "");
  assert.equal(g.lensWidth, 0);
  assert.equal(g.bx - g.ax, 2 * MARK_RADIUS);
});

test("a gap leaves no lens either", () => {
  const g = markGeometry(MARK_DISTANCE.off);
  assert.equal(g.lens, "");
  assert.ok(g.bx - g.ax > 2 * MARK_RADIUS);
});

test("the lens narrows as the circles move apart", () => {
  const widths = [0, 6, 12, 18, 24].map((d) => markGeometry(d).lensWidth);
  for (let i = 1; i < widths.length; i++) assert.ok(widths[i] < widths[i - 1]);
});

test("the lens path closes where it starts", () => {
  const { lens } = markGeometry(12);
  const start = lens.match(/^M ([\d.]+) ([\d.]+)/);
  const end = lens.match(/A \S+ \S+ 0 0 0 ([\d.]+) ([\d.]+) Z$/);
  assert.deepEqual([start[1], start[2]], [end[1], end[2]]);
});

test("states are ordered: in step is closest, then needs, then off", () => {
  assert.ok(MARK_DISTANCE.step < MARK_DISTANCE.needs);
  assert.ok(MARK_DISTANCE.needs < MARK_DISTANCE.off);
  assert.equal(MARK_DISTANCE.syncing, MARK_DISTANCE.step);
});

test("negative distances are treated as fully overlapped", () => {
  const g = markGeometry(-5);
  assert.equal(g.ax, g.bx);
});
