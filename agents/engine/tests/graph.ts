// fileNeighbours: the files around a task's files, read from Graphify's graph.json.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileNeighbours } from "../src/graph.ts";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "orch-graph-"));
const graphFile = path.join(tmp, "graph.json");
fs.writeFileSync(
  graphFile,
  JSON.stringify({
    nodes: [
      { id: "a", label: "a.ts", source_file: "a.ts" },
      { id: "b", label: "b.ts", source_file: "b.ts" },
      { id: "c", label: "c.ts", source_file: "c.ts" },
      { id: "a_fn", label: "fn()", source_file: "a.ts" },
    ],
    links: [
      { source: "a", target: "b", relation: "imports", source_file: "a.ts" },
      { source: "c", target: "a_fn", relation: "calls", source_file: "c.ts" },
      { source: "a", target: "a_fn", relation: "uses", source_file: "a.ts" }, // inside a.ts: not a neighbour
      { source: "a", target: "b", relation: "imports", source_file: "a.ts" }, // duplicate: counted once
    ],
  }),
);

// a.ts is imported by nobody and imports b.ts; c.ts calls into a.ts
assert.deepEqual(fileNeighbours(graphFile, ["a.ts"]), ["a.ts imports b.ts", "c.ts calls a.ts"]);
// the same graph seen from the other side
assert.deepEqual(fileNeighbours(graphFile, ["b.ts"]), ["a.ts imports b.ts"]);
// a file nothing touches has no neighbours
assert.deepEqual(fileNeighbours(graphFile, ["zz.ts"]), []);
// the cap keeps the list short
assert.equal(fileNeighbours(graphFile, ["a.ts"], 1).length, 1);

// a missing or broken graph gives nothing
assert.deepEqual(fileNeighbours(path.join(tmp, "nope.json"), ["a.ts"]), []);
const broken = path.join(tmp, "broken.json");
fs.writeFileSync(broken, "{ not json");
assert.deepEqual(fileNeighbours(broken, ["a.ts"]), []);

// a folder entry matches everything under it, and windows paths are normalised
const folderGraph = path.join(tmp, "folder.json");
fs.writeFileSync(
  folderGraph,
  JSON.stringify({
    nodes: [
      { id: "x", label: "x.ts", source_file: "src\\x.ts" },
      { id: "o", label: "o.ts", source_file: "lib/o.ts" },
    ],
    links: [{ source: "x", target: "o", relation: "imports", source_file: "src\\x.ts" }],
  }),
);
assert.deepEqual(fileNeighbours(folderGraph, ["src/"]), ["src/x.ts imports lib/o.ts"]);
assert.deepEqual(fileNeighbours(folderGraph, ["src/x.ts"]), ["src/x.ts imports lib/o.ts"]);

// graphify emits "imports" and "imports_from" for the same import: one line
const dupGraph = path.join(tmp, "dup.json");
fs.writeFileSync(
  dupGraph,
  JSON.stringify({
    nodes: [
      { id: "x", label: "x.ts", source_file: "x.ts" },
      { id: "da", label: "a.ts", source_file: "a.ts" },
    ],
    links: [
      { source: "x", target: "da", relation: "imports", source_file: "x.ts" },
      { source: "x", target: "da", relation: "imports_from", source_file: "x.ts" },
    ],
  }),
);
assert.deepEqual(fileNeighbours(dupGraph, ["a.ts"]), ["x.ts imports a.ts"]);

console.log("graph PASS");
