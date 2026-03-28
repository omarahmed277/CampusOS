import { calculateSessionPrice } from './src/lib/pricing';

const testCases = [
  { min: 30, expected: 10, label: '30 min' },
  { min: 60, expected: 10, label: '1 hour' },
  { min: 70, expected: 10, label: '1h 10m' },
  { min: 80, expected: 15, label: '1h 20m' },
  { min: 100, expected: 20, label: '1h 40m' },
  { min: 130, expected: 20, label: '2h 10m' },
  { min: 145, expected: 25, label: '2h 25m' },
  { min: 170, expected: 30, label: '2h 50m' },
];

console.log('--- SESSION PRICING TESTS ---');
testCases.forEach(tc => {
  const result = calculateSessionPrice(tc.min);
  const success = result === tc.expected;
  console.log(`${success ? '✅' : '❌'} ${tc.label}: ${result} EGP (Expected: ${tc.expected})`);
});
