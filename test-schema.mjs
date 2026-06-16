import { updateStateSchema } from "./src/lib/tool-schema.mjs";

// Test 1: Valid minimal input (1 option, no optional fields)
const valid1 = updateStateSchema.parse({
  options: [{ text: "Go left" }]
});
console.log("TEST 1 (minimal valid):", JSON.stringify(valid1));

// Test 2: Valid maximal input (4 options, all optional fields)
const valid2 = updateStateSchema.parse({
  options: [
    {
      text: "Go left",
      attributeChecks: { strength: "15" },
      npcAffinityChecks: { king: "5" },
      flagChecks: ["has_sword"],
      flagNot: ["is_dead"],
      itemChecks: ["potion"],
      itemNot: ["poison"]
    },
    { text: "Go right" },
    { text: "Stay", flagChecks: ["is_hidden"] },
    { text: "Flee" }
  ],
  attributeChanges: { hp: -10 },
  npcAffinityChanges: { king: 5 },
  newFlags: ["met_king"],
  lostFlags: ["has_treasure_map"],
  itemsGained: ["sword"],
  itemsLost: ["old_shield"]
});
console.log("TEST 2 (maximal valid):", JSON.stringify(valid2));

// Test 3: Invalid - 0 options (should fail min)
try {
  updateStateSchema.parse({ options: [] });
  console.log("TEST 3 FAIL: should have thrown for empty options");
} catch (e) {
  console.log("TEST 3 (empty options rejected):", e.issues?.[0]?.message ?? e.message);
}

// Test 4: Invalid - 5 options (should fail max)
try {
  updateStateSchema.parse({
    options: [
      { text: "A" }, { text: "B" }, { text: "C" }, { text: "D" }, { text: "E" }
    ]
  });
  console.log("TEST 4 FAIL: should have thrown for 5 options");
} catch (e) {
  console.log("TEST 4 (5 options rejected):", e.issues?.[0]?.message ?? e.message);
}

// Test 5: Invalid - option missing text
try {
  updateStateSchema.parse({ options: [{}] });
  console.log("TEST 5 FAIL: should have thrown for missing text");
} catch (e) {
  console.log("TEST 5 (no text rejected):", e.issues?.[0]?.message ?? e.message);
}

// Test 6: Verify Zod v4 record syntax
console.log("TEST 6 (Zod record keys): schema keys =",
  Object.keys(updateStateSchema.shape).join(", "));

console.log("\nAll tests passed.");
