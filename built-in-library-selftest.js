const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('app.js', 'utf8');
const start = source.indexOf('  function defaultDrill(');
const end = source.indexOf('\n\n  const BUILT_IN_FOLDER_DEFS', start);
assert(start >= 0 && end > start, 'could not locate built-in library source');

let nextId = 0;
const context = {
  structuredClone,
  makeId: prefix => `${prefix}_${++nextId}`,
  library: { drills: [] },
  clamp: (value, min, max, fallback = min) => Math.min(max, Math.max(min, Number.isFinite(Number(value)) ? Number(value) : fallback)),
  AdaptiveTiming: require('./adaptive-timing.js'),
};
vm.createContext(context);
vm.runInContext(`${source.slice(start, end)}\nglobalThis.auditCatalog = {
  sample: makeSampleLibrary(),
  shotPresets: DEFAULT_SHOT_PRESETS,
  servePresets: DEFAULT_SERVE_PRESETS,
};`, context);

const { sample, shotPresets, servePresets } = context.auditCatalog;
assert.strictEqual(sample.drills.length, 45, 'the complete built-in catalog must contain 45 drills');
const drillsById = new Map(sample.drills.map(drill => [drill.id, drill]));
assert.strictEqual(drillsById.size, 45, 'built-in drill ids must be unique');

const shotSignatures = new Set(Object.values(shotPresets).map(preset => JSON.stringify(preset.params)));
const serveSignatures = new Set(Object.values(servePresets).map(preset => JSON.stringify(preset.params)));
let reachableBallNodes = 0;
let reachableShots = 0;
let reachableServes = 0;
const usedServeSignatures = new Set();
for (const drill of sample.drills) {
  assert.strictEqual(drill.settings.delayBetweenSets, 0, `${drill.name}: built-in set delay must be zero`);
  assert.strictEqual(drill.settings.firstShotTiming.mode, 'adaptive', `${drill.name}: first shot must use adaptive timing`);
  assert(drill.startNodeId, `${drill.name}: missing start node`);
  const nodes = new Map(drill.nodes.map(node => [node.id, node]));
  assert.strictEqual(nodes.size, drill.nodes.length, `${drill.name}: duplicate node id`);
  assert(nodes.has(drill.startNodeId), `${drill.name}: start node does not exist`);
  for (const edge of drill.edges) {
    assert(nodes.has(edge.source), `${drill.name}: edge has missing source`);
    assert(nodes.has(edge.target), `${drill.name}: edge has missing target`);
    assert.strictEqual(edge.timingMode, 'adaptive', `${drill.name}: edge must use adaptive timing`);
  }

  const reached = new Set();
  const pending = [drill.startNodeId];
  while (pending.length) {
    const id = pending.pop();
    if (reached.has(id)) continue;
    reached.add(id);
    for (const edge of drill.edges.filter(candidate => candidate.source === id)) pending.push(edge.target);
  }
  assert.strictEqual(reached.size, drill.nodes.length, `${drill.name}: contains unreachable nodes`);

  for (const node of drill.nodes) {
    if (node.type === 'drill') assert(drillsById.has(node.referencedDrillId), `${drill.name}: missing referenced drill`);
    if (node.type !== 'shot' && node.type !== 'serve') continue;
    reachableBallNodes += 1;
    if (node.type === 'shot') reachableShots += 1;
    else {
      reachableServes += 1;
      usedServeSignatures.add(JSON.stringify(node.params));
    }
    const signatures = node.type === 'serve' ? serveSignatures : shotSignatures;
    assert(signatures.has(JSON.stringify(node.params)), `${drill.name} / ${node.label}: parameters do not match a validated preset`);
    const presets = node.type === 'serve' ? Object.values(servePresets) : Object.values(shotPresets);
    const preset = presets.find(candidate => JSON.stringify(candidate.params) === JSON.stringify(node.params));
    if (node.variation?.enabled) {
      assert(node.variation.speed.minMps <= node.params.speedMps && node.params.speedMps <= node.variation.speed.maxMps,
        `${drill.name} / ${node.label}: variation excludes nominal speed`);
      assert(node.variation.spin.minRps <= node.params.spinRps && node.params.spinRps <= node.variation.spin.maxRps,
        `${drill.name} / ${node.label}: variation excludes nominal spin`);
      assert(node.variation.clearance.minCm <= preset.target.netClearanceCm
        && preset.target.netClearanceCm <= node.variation.clearance.maxCm,
      `${drill.name} / ${node.label}: variation excludes nominal clearance`);
    }
  }
}
assert.strictEqual(reachableServes, 15, 'expected all 15 reachable serve nodes in the built-in drills');
assert.strictEqual(usedServeSignatures.size, Object.keys(servePresets).length, 'every built-in serve preset must be exercised by a drill');
for (const name of ['Push: Backhand consistency', 'Push: Forehand / backhand alternating', 'Push: Random placement']) {
  const drill = sample.drills.find(candidate => candidate.name === name);
  assert(drill, `${name}: missing push drill`);
  const feeds = drill.nodes.filter(node => node.type === 'shot');
  assert(feeds.length, `${name}: has no playable push feeds`);
  assert(feeds.every(node => node.params.spinRps < 0), `${name}: every feed must carry backspin`);
}

console.log(`Built-in library self-test PASS (45 drills, ${reachableBallNodes} reachable ball nodes: ${reachableShots} shots + ${reachableServes} serves)`);
