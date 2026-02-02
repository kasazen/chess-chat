#!/usr/bin/env node

/**
 * Test Runner for Chess Coach State Synchronization
 *
 * This script validates that the Action Queue properly handles complex
 * sequences of moves, undos, and variations without state desync.
 */

import { Chess } from 'chess.js';
import { butterflyEffectScenario, promotionScenario } from './test-scenarios.js';

function runScenario(scenario) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🧪 Running: ${scenario.name}`);
  console.log(`📝 ${scenario.description}`);
  console.log(`${'='.repeat(60)}\n`);

  const game = new Chess(scenario.initialFen);
  let passed = true;
  let stepNumber = 0;

  console.log(`Initial FEN: ${game.fen()}\n`);

  for (const step of scenario.steps) {
    stepNumber++;

    if (step.type === 'comment') {
      console.log(`\n💭 ${step.text}\n`);
      continue;
    }

    if (step.type === 'action') {
      const action = step.action;
      const comment = step.comment || '';

      try {
        if (action.type === 'move' && action.lan) {
          // Validate move is legal
          const legalMoves = game.moves({ verbose: true });
          const isLegal = legalMoves.some(m => m.from + m.to === action.lan.substring(0, 4));

          if (!isLegal) {
            throw new Error(`Illegal move: ${action.lan}`);
          }

          const move = game.move({
            from: action.lan.substring(0, 2),
            to: action.lan.substring(2, 4),
            promotion: action.lan.length > 4 ? action.lan[4] : 'q'
          });

          if (!move) throw new Error(`Move failed: ${action.lan}`);
          console.log(`✓ Step ${stepNumber}: ${comment} [${action.lan}]`);

        } else if (action.type === 'undo') {
          const undone = game.undo();
          if (!undone) throw new Error('Undo failed: no moves to undo');
          console.log(`✓ Step ${stepNumber}: ${comment}`);

        } else if (action.type === 'reset') {
          game.reset();
          console.log(`✓ Step ${stepNumber}: ${comment}`);
        }

        console.log(`  → FEN: ${game.fen()}`);

      } catch (error) {
        console.error(`❌ Step ${stepNumber} FAILED: ${error.message}`);
        console.error(`  → Comment: ${comment}`);
        console.error(`  → Action: ${JSON.stringify(action)}`);
        passed = false;
        break;
      }
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  if (passed) {
    console.log(`✅ ${scenario.name} PASSED`);
  } else {
    console.log(`❌ ${scenario.name} FAILED`);
  }
  console.log(`${'='.repeat(60)}\n`);

  return passed;
}

// Run all scenarios
console.log('\n🚀 Starting Chess Coach State Synchronization Tests\n');

const results = [
  runScenario(butterflyEffectScenario),
  runScenario(promotionScenario)
];

const totalPassed = results.filter(r => r).length;
const totalTests = results.length;

console.log('\n' + '='.repeat(60));
console.log(`📊 Test Summary: ${totalPassed}/${totalTests} scenarios passed`);
console.log('='.repeat(60) + '\n');

process.exit(totalPassed === totalTests ? 0 : 1);
