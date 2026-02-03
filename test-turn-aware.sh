#!/bin/bash

echo "======================================================================"
echo "🧪 TEST: Turn-Aware AI Logic"
echo "======================================================================"
echo ""
echo "📍 Position: After 1. e4 (BLACK to move)"
echo "💬 Request: 'Explain the Italian Game opening for White'"
echo ""
echo "Expected: AI should use ghost_move/arrow/highlight, NOT real moves"
echo ""
echo "🔄 Sending request to backend..."
echo ""

RESPONSE=$(curl -s -X POST http://localhost:8000/ask \
  -H "Content-Type: application/json" \
  -d '{
    "fen": "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
    "message": "Explain the Italian Game opening for White",
    "history": ["e4"]
  }')

if [ -z "$RESPONSE" ]; then
  echo "❌ ERROR: No response from backend"
  echo "Make sure backend is running: cd backend && python main.py"
  exit 1
fi

echo "📦 RESPONSE RECEIVED"
echo "────────────────────────────────────────────────────────────────────"
echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
echo "────────────────────────────────────────────────────────────────────"
echo ""

# Check for illegal moves
HAS_MOVE_TYPE=$(echo "$RESPONSE" | grep -o '"type"[[:space:]]*:[[:space:]]*"move"' | wc -l)
HAS_GHOST_MOVE=$(echo "$RESPONSE" | grep -o '"type"[[:space:]]*:[[:space:]]*"ghost_move"' | wc -l)
HAS_ARROW=$(echo "$RESPONSE" | grep -o '"type"[[:space:]]*:[[:space:]]*"arrow"' | wc -l)
HAS_HIGHLIGHT=$(echo "$RESPONSE" | grep -o '"type"[[:space:]]*:[[:space:]]*"highlight"' | wc -l)

echo "======================================================================"
echo "TEST RESULTS:"
echo "======================================================================"

if [ "$HAS_MOVE_TYPE" -gt 0 ]; then
  echo "❌ FAILED: AI generated $HAS_MOVE_TYPE real move action(s) during opponent's turn"
  echo "   The AI should have used ghost_move, arrow, or highlight instead."
  exit 1
fi

TOTAL_VISUAL=$((HAS_GHOST_MOVE + HAS_ARROW + HAS_HIGHLIGHT))

if [ "$TOTAL_VISUAL" -eq 0 ]; then
  echo "⚠️  WARNING: No visual actions detected"
  echo "   The AI should demonstrate opponent moves visually."
else
  echo "✅ PASSED: AI correctly used visual-only actions"
  echo "   - Ghost moves: $HAS_GHOST_MOVE"
  echo "   - Arrows: $HAS_ARROW"
  echo "   - Highlights: $HAS_HIGHLIGHT"
fi

echo "======================================================================"
exit 0
