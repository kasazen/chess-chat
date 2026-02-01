# Action Scripts - Refactoring Documentation

## Overview

The `/ask` endpoint has been refactored from returning plain text narratives to returning **structured JSON Action Scripts**. This enables the frontend to:
- Animate move sequences on the chessboard
- Display step-by-step commentary
- Create an interactive learning experience

---

## New Response Format

### Before (Plain Text)
```json
{
  "text": "Long narrative about the position...",
  "best_move": "e2e4"
}
```

### After (Action Scripts)
```json
{
  "explanation": "High-level summary of the concept",
  "steps": [
    {
      "lan": "e2e4",
      "commentary": "Description of this move"
    },
    {
      "lan": "e7e5",
      "commentary": "Description of this move"
    }
  ]
}
```

---

## API Changes

### Endpoint
`POST /ask`

### Request (Unchanged)
```json
{
  "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  "message": "Teach me the Italian Game"
}
```

### Response (New Structure)
```json
{
  "explanation": "The Italian Game emphasizes rapid development...",
  "steps": [
    {
      "lan": "e2e4",
      "commentary": "White stakes a claim in the center"
    },
    {
      "lan": "e7e5",
      "commentary": "Black responds symmetrically"
    },
    {
      "lan": "g1f3",
      "commentary": "Develops the Knight to its best square"
    }
  ]
}
```

---

## Implementation Details

### 1. New Pydantic Models

```python
class MoveStep(BaseModel):
    lan: str         # Long Algebraic Notation (e.g., "e2e4")
    commentary: str  # Description of the move

class ActionScriptResponse(BaseModel):
    explanation: str      # High-level summary
    steps: List[MoveStep] # Move sequence
```

### 2. JSON-Only Response

The prompt now enforces JSON-only output:

```python
prompt = f"""You are a chess coach. Analyze this position...

Return ONLY a JSON object with this exact structure:
{{
  "explanation": "Brief summary (1-2 sentences)",
  "steps": [
    {{"lan": "e2e4", "commentary": "Description"}},
    {{"lan": "e7e5", "commentary": "Description"}}
  ]
}}

Rules:
- Include 3-8 moves in the "steps" array
- Use Long Algebraic Notation (LAN): e2e4, g1f3, etc.
- Start from the current position
- Return ONLY valid JSON, no markdown or code blocks"""
```

### 3. Gemini JSON Mode

The API call uses `response_mime_type` to guarantee JSON output:

```python
response = client.models.generate_content(
    model="gemini-flash-latest",
    contents=prompt,
    config={"response_mime_type": "application/json"}
)
```

### 4. Error Handling

If Gemini or Stockfish fails, a fallback Action Script is returned:

```python
return ActionScriptResponse(
    explanation=f"Error: {str(e)}",
    steps=[
        MoveStep(
            lan=str(best_move) if 'best_move' in locals() else "e2e4",
            commentary="Unable to generate full analysis. Try again."
        )
    ]
)
```

---

## Testing Results

### Test 1: Starting Position (Italian Game)

**Request:**
```bash
curl -X POST http://localhost:8000/ask \
  -H "Content-Type: application/json" \
  -d '{
    "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    "message": "Show me the Italian Game"
  }'
```

**Response:**
```json
{
  "explanation": "The Italian Game (Giuoco Piano) emphasizes rapid central control and quick development toward the weak f7 square.",
  "steps": [
    {
      "lan": "e2e4",
      "commentary": "White stakes a claim in the center, preparing to open lines for the Queen and Bishop."
    },
    {
      "lan": "e7e5",
      "commentary": "Black responds symmetrically, challenging the center immediately."
    },
    {
      "lan": "g1f3",
      "commentary": "Development: White develops the Knight, attacks e5, and prepares for castling."
    },
    {
      "lan": "b8c6",
      "commentary": "Development: Black defends the central pawn with a minor piece."
    },
    {
      "lan": "f1c4",
      "commentary": "The defining move of the Italian Game, aiming at Black's weak f7 pawn."
    },
    {
      "lan": "f8c5",
      "commentary": "The classical continuation, mirroring White's setup (Giuoco Pianissimo)."
    }
  ]
}
```

### Test 2: Mid-Game Position (Two Knights Defense)

**Request:**
```bash
curl -X POST http://localhost:8000/ask \
  -H "Content-Type: application/json" \
  -d '{
    "fen": "rnbqkb1r/pppp1ppp/5n2/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3",
    "message": "Teach me the Two Knights Defense"
  }'
```

**Response:**
```json
{
  "explanation": "The Two Knights Defense (3... Nf6) is an aggressive counter-attack against the Italian Game, inviting immediate tactical complications.",
  "steps": [
    {
      "lan": "b8c6",
      "commentary": "Black develops the Queen's Knight, securing the e5 pawn."
    },
    {
      "lan": "f1c4",
      "commentary": "White establishes the Italian Game setup, focusing pressure toward f7."
    },
    {
      "lan": "g8f6",
      "commentary": "This is the Two Knights Defense, challenging e4 and inviting tactical play."
    },
    {
      "lan": "g1g5",
      "commentary": "The Polerio Attack (Fried Liver), creating an immediate threat against f7."
    },
    {
      "lan": "d7d5",
      "commentary": "Black strikes back in the center, opening lines for the Queen."
    },
    {
      "lan": "e4d5",
      "commentary": "White accepts the pawn sacrifice, maintaining pressure."
    },
    {
      "lan": "c6a5",
      "commentary": "Black targets White's powerful c4 Bishop, sacrificing a pawn for development tempo."
    }
  ]
}
```

---

## Swagger UI Verification

Access the interactive API documentation:
```
http://localhost:8000/docs
```

The `/ask` endpoint now shows:
- **Request Body:** `ChatRequest` schema
- **Response:** `ActionScriptResponse` schema with `explanation` and `steps` fields

---

## Frontend Integration Guide

### Parsing the Response

```typescript
interface MoveStep {
  lan: string;
  commentary: string;
}

interface ActionScriptResponse {
  explanation: string;
  steps: MoveStep[];
}

async function askCoach(fen: string, message: string) {
  const response = await fetch('http://localhost:8000/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fen, message }),
  });

  const data: ActionScriptResponse = await response.json();
  return data;
}
```

### Animating Moves on the Board

```typescript
async function playActionScript(script: ActionScriptResponse) {
  // Show explanation
  console.log(script.explanation);

  // Animate each move
  for (const step of script.steps) {
    // Parse LAN format (e.g., "e2e4")
    const from = step.lan.substring(0, 2);
    const to = step.lan.substring(2, 4);

    // Make the move on the chess.js board
    game.move({ from, to, promotion: 'q' });

    // Update chessboard display
    setGame(new Chess(game.fen()));

    // Show commentary
    console.log(step.commentary);

    // Wait before next move
    await sleep(1500);
  }
}
```

---

## Move Notation Format

### Long Algebraic Notation (LAN)

All moves are returned in **LAN format**:
- **Normal moves:** `e2e4`, `g1f3`, `b8c6`
- **Captures:** `e4d5`, `f3e5`
- **Castling:** `e1g1` (kingside), `e1c1` (queenside)
- **Promotions:** `e7e8q` (promote to queen)

This format is chess.js-compatible and unambiguous.

---

## Key Benefits

### 1. Interactive Learning
- Users can watch moves play out step-by-step
- Each move comes with educational commentary
- Visual reinforcement of chess concepts

### 2. Structured Data
- Easy to parse and process in frontend code
- Type-safe with TypeScript interfaces
- Validated by Pydantic models

### 3. Consistent Responses
- JSON mode ensures valid structure
- No parsing errors from markdown/plain text
- Predictable format for frontend

### 4. Gemini 2.5 Powered
- Uses the latest 2026 Gemini models
- JSON schema enforcement
- High-quality chess commentary

---

## Configuration Options

### Adjust Move Count

Modify the prompt to change the number of moves:

```python
# For shorter sequences (3-5 moves)
"Rules:\n- Include 3-5 moves in the 'steps' array"

# For longer sequences (5-12 moves)
"Rules:\n- Include 5-12 moves in the 'steps' array"
```

### Adjust Commentary Style

Modify the prompt to change commentary depth:

```python
# Brief commentary
"- Each move should have a brief 1-sentence explanation"

# Detailed commentary
"- Each move should have detailed tactical and strategic commentary (2-3 sentences)"
```

---

## Code Changes Summary

### Files Modified
- `backend/main.py`

### Lines Changed
- Added imports: `json`, `List` from typing
- Added Pydantic models: `MoveStep`, `ActionScriptResponse`
- Updated `/ask` endpoint with new prompt and JSON parsing
- Added `response_model=ActionScriptResponse` decorator
- Added `config={"response_mime_type": "application/json"}`

### Backward Compatibility
⚠️ **Breaking Change:** The response format has changed. Frontend code must be updated to handle the new structure.

---

## Next Steps

### Frontend Tasks
1. Update `App.tsx` to parse the new JSON structure
2. Implement move animation sequence
3. Display commentary alongside each move
4. Add controls (play/pause/speed) for the animation

### Optional Enhancements
1. Add variation branching (multiple possible continuations)
2. Include evaluation scores for each position
3. Add diagram snapshots at key moments
4. Implement "quiz mode" where user guesses the next move

---

## Troubleshooting

### Issue: Response still returns old format
**Solution:** Restart the server to pick up code changes
```bash
lsof -ti:8000 | xargs kill -9
cd backend && source venv/bin/activate
uvicorn main:app --reload
```

### Issue: Invalid JSON in response
**Solution:** The `response_mime_type` config ensures valid JSON, but if errors occur, check:
- Gemini API key is valid
- Model name is correct (`gemini-flash-latest`)
- Prompt doesn't have conflicting instructions

### Issue: Moves in wrong notation
**Solution:** LAN format is enforced in the prompt. If issues persist:
- Verify the prompt includes "Use Long Algebraic Notation (LAN)"
- Check that moves start from the current position's FEN

---

## Example Use Cases

1. **Opening Theory:** "Teach me the Sicilian Dragon"
2. **Tactical Patterns:** "Show me a knight fork example"
3. **Endgame Technique:** "How do I win a King and Pawn endgame?"
4. **Position Analysis:** "What should I do in this position?"

All return structured Action Scripts with move sequences and commentary.
