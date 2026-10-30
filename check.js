// Run with:  node check.js   (checks the algorithms against values worked out by hand)
const L = require("./app.js"), assert = require("assert");
assert.deepStrictEqual(L.calcNeed(L.M0, L.A0), [[3,3,2],[2,2,2],[3,3,2],[2,2,1],[0,0,0]]);
const r = L.safetyCheck(L.V0, L.A0, L.calcNeed(L.M0, L.A0));
assert.deepStrictEqual(r.seq, ["P4","P1","P2","P3","P0"]);
assert.deepStrictEqual(r.steps.map(s => s.after), [[3,2,2],[4,3,2],[7,4,4],[8,6,5],[10,6,6]]);
const pr = (p, q) => L.processRequest(p, q, L.M0, L.A0, L.V0);
assert.strictEqual(pr("P1", "1 1 1").status, "SAFE");
assert.strictEqual(pr("p1", " 1,1,1 ").status, "SAFE");
assert.strictEqual(pr("P2", "2 1 0").status, "WAITING");
const u = pr("P0", "1 2 2"); assert.strictEqual(u.status, "UNSAFE"); assert.strictEqual(u.steps.length, 1);
assert.strictEqual(pr("P4", "1 0 0").status, "INVALID");
assert.strictEqual(pr("P1", "1 2 abc").status, "INVALID");
assert.strictEqual(pr("P1", "1 0").status, "INVALID");
assert.strictEqual(L.validateState([[1]], [[NaN]], [0]).length, 1);
assert.strictEqual(L.validateState([[1]], [[1]], [-1]).length, 1);
assert.deepStrictEqual(L.detect(L.DV, L.DA, L.DR).dead, [1, 2, 3]);      // confirmed deadlock
assert.deepStrictEqual(L.detect(L.DV, L.DA2, L.DR).dead, []);            // cycle exists but no deadlock
assert.ok(L.findCycle(L.waitEdges(L.DV, L.DA2, L.DR)));
assert.deepStrictEqual(L.applyOrdering(L.DA, L.DR).bad, [[3, 0, 2]]);
const rows = L.runTests();
rows.forEach(t => console.log(t.id, t.pass ? "PASS" : "FAIL", "|", t.actual.replace(/\n/g, " ; ")));
assert.ok(rows.every(t => t.pass)); console.log("ALL ASSERTIONS PASSED");
