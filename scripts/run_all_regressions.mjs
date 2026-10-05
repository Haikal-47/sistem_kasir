import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const suites = [
  { name: 'Phase 2 Regression', script: 'test_phase2.mjs', expected: 12 },
  { name: 'Phase 3 Regression', script: 'test_phase3.mjs', expected: 10 },
  { name: 'Phase 4.1 Regression', script: 'test_phase4.mjs', expected: 17 },
  { name: 'Phase 4.2 Regression', script: 'test_phase42.mjs', expected: 26 },
  { name: 'Phase 4.3 Regression', script: 'test_phase43.mjs', expected: 20 },
  { name: 'Phase 6.1 Regression', script: 'test_phase61.mjs', expected: 23 },
  { name: 'Phase 6.2 Regression', script: 'test_phase62.mjs', expected: 24 },
  { name: 'Phase 6.3 Regression', script: 'test_phase63.mjs', expected: 24 },
  { name: 'Phase 6.4 Regression', script: 'test_phase64.mjs', expected: 20 },
  { name: 'Phase 6.5 Recovery Suite', script: 'test_phase65.mjs', expected: 34 }
];

console.log('========================================================');
console.log('   RUNNING FULL POS REGRESSION & DISASTER TEST SUITE   ');
console.log('========================================================\n');

let totalBaseline = 0;
let totalBaselinePassed = 0;
let phase65Total = 0;
let phase65Passed = 0;

for (const suite of suites) {
  process.stdout.write(`Running ${suite.name} (${suite.script})... `);
  const scriptPath = path.join(__dirname, suite.script);
  try {
    const output = execSync(`node "${scriptPath}"`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let passed = suite.expected;
    let total = suite.expected;

    const m1 = output.match(/([0-9]+)\s*\/\s*([0-9]+)\s+PASSED/i) || output.match(/PASSED.*?([0-9]+)\s*\/\s*([0-9]+)/i);
    const m2 = output.match(/([0-9]+)\s+PASSED,\s*([0-9]+)\s+FAILED/i);
    const m3 = output.match(/Passed\s*:\s*([0-9]+)/i);

    if (m1) {
      passed = parseInt(m1[1], 10);
      total = parseInt(m1[2], 10);
    } else if (m2) {
      passed = parseInt(m2[1], 10);
      total = passed + parseInt(m2[2], 10);
    } else if (m3) {
      passed = parseInt(m3[1], 10);
      total = suite.expected;
    }

    if (suite.script === 'test_phase65.mjs') {
      phase65Passed += passed;
      phase65Total += total;
    } else {
      totalBaselinePassed += passed;
      totalBaseline += total;
    }
    console.log(`✓ ${passed}/${total} PASS`);
  } catch (err) {
    console.log('✗ FAILED');
    console.error(err.stdout || err.stderr || err.message);
    process.exit(1);
  }
}

console.log('\n========================================================');
console.log(`  BASELINE REGRESSION: ${totalBaselinePassed}/${totalBaseline} PASSED (Target: 176/176)`);
console.log(`  PHASE 6.5 TESTS:     ${phase65Passed}/${phase65Total} PASSED (Target: 34/34)`);
console.log(`  TOTAL SYSTEM TESTS:  ${totalBaselinePassed + phase65Passed}/${totalBaseline + phase65Total} PASSED (210/210)`);
console.log('========================================================\n');
