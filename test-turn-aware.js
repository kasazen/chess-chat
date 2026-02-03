#!/usr/bin/env node

/**
 * Test: Turn-Aware AI Logic
 *
 * This test verifies that the AI correctly uses ghost_moves, arrows, and highlights
 * when explaining moves for the opponent (not the current turn).
 *
 * Scenario: Position is after 1. e4 (White moved). It's Black's turn.
 * Request: "Explain the Italian Game opening for White"
 * Expected: AI should use ghost_move/arrow/highlight, NOT real move actions
 */

import fetch from 'node-fetch';

async function testTurnAwareLogic() {
  console.log('\n' + '='.repeat(70));
  console.log('🧪 TEST: Turn-Aware AI Logic');
  console.log('='.repeat(70) + '\n');

  // Position after 1. e4 - it's Black's turn
  const testFen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
  const testMessage = "Explain the Italian Game opening for White";

  console.log(`📍 Position: After 1. e4 (BLACK to move)`);
  console.log(`📍 FEN: ${testFen}`);
  console.log(`💬 Request: "${testMessage}"\n`);

  try {
    console.log('🔄 Sending request to backend...\n');

    const response = await fetch('http://localhost:8000/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fen: testFen,
        message: testMessage,
        history: ['e4']
      })
    });

    if (!response.ok) {
      throw new Error(`Backend returned ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    console.log('📦 RESPONSE RECEIVED\n');
    console.log('─'.repeat(70));
    console.log('Explanation:', data.explanation);
    console.log('─'.repeat(70) + '\n');

    console.log('🎬 ACTIONS:\n');

    let hasIllegalMoves = false;
    let hasGhostMoves = false;
    let hasArrows = false;
    let hasHighlights = false;

    data.actions.forEach((action, idx) => {
      console.log(`${idx + 1}. Type: ${action.type}`);

      if (action.type === 'move') {
        console.log(`   ⚠️  ILLEGAL: AI attempted real move "${action.san}" during opponent's turn!`);
        hasIllegalMoves = true;
      } else if (action.type === 'ghost_move') {
        console.log(`   ✓ GHOST: ${action.from} → ${action.to} (${action.intent || 'no intent'})`);
        hasGhostMoves = true;
      } else if (action.type === 'arrow') {
        console.log(`   ✓ ARROW: ${action.from} → ${action.to} (${action.intent || 'no intent'})`);
        hasArrows = true;
      } else if (action.type === 'highlight') {
        console.log(`   ✓ HIGHLIGHT: ${action.square} (${action.intent || 'no intent'})`);
        hasHighlights = true;
      } else {
        console.log(`   → ${action.type}: ${action.comment || ''}`);
      }

      if (action.comment) {
        console.log(`   💭 "${action.comment}"`);
      }
      console.log();
    });

    console.log('='.repeat(70));
    console.log('TEST RESULTS:');
    console.log('='.repeat(70));

    if (hasIllegalMoves) {
      console.log('❌ FAILED: AI generated illegal move actions for opponent\'s turn');
      console.log('   The AI should have used ghost_move, arrow, or highlight instead.');
      process.exit(1);
    }

    if (!hasGhostMoves && !hasArrows && !hasHighlights) {
      console.log('⚠️  WARNING: No visual actions (ghost_move/arrow/highlight) detected');
      console.log('   The AI should demonstrate opponent moves visually.');
    } else {
      console.log('✅ PASSED: AI correctly used visual-only actions');
      console.log(`   - Ghost moves: ${hasGhostMoves ? 'YES' : 'NO'}`);
      console.log(`   - Arrows: ${hasArrows ? 'YES' : 'NO'}`);
      console.log(`   - Highlights: ${hasHighlights ? 'YES' : 'NO'}`);
    }

    console.log('='.repeat(70) + '\n');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error('\nMake sure:');
    console.error('1. Backend server is running (python backend/main.py)');
    console.error('2. GEMINI_API_KEY is set in backend/.env');
    console.error('3. Port 8000 is available\n');
    process.exit(1);
  }
}

testTurnAwareLogic();
