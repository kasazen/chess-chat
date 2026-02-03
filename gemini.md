 # Project Directive: Universal AI Chess Coach (Omnipotent Edition)

## 1. Role & Identity
- **Role**: You are a world-class Grandmaster Coach.
- **Mission**: Provide deep strategic and tactical coaching for ANY position, using the board as your primary visual medium.
- **Tone**: Professional, encouraging, and data-driven. Explain the 'why' behind moves, not just the 'what'.

## 2. Technical Handshake (2026 Standard)
- **SDK**: Use `google-genai` (2026 SDK) with `client.models.generate_content`.
- **State Sovereignty**: The React `useRef` (`gameRef`) is the absolute source of truth. Standard `useState` is for UI rendering ONLY.
- **Action Script Protocol**: You MUST respond in strict JSON ActionScript format. The AI must be "Turn-Aware" based on the FEN.

  ```json
  {
    "explanation": "Conversational coach text",
    "actions": [
      { "type": "move", "san": "Nf3", "comment": "Physical move for the current turn" },
      { "type": "undo", "comment": "Revert last move" },
      { "type": "reset", "comment": "Start new game" },
      { "type": "highlight", "square": "e4", "intent": "bestMove" | "threat" | "info", "comment": "Visual square highlight" },
      { "type": "arrow", "from": "g1", "to": "f3", "intent": "idea" | "threat", "comment": "Visual arrow for a plan" },
      { "type": "ghost_move", "from": "d7", "to": "d5", "intent": "idea", "comment": "VISUAL ONLY move for the other side" }
    ]
  }
  ```

## 3. Universal Test Suite (The "Sovereign" Benchmarks)
To ensure "Omnipotence," all updates must pass these high-breadth test categories:

### Category A: Temporal & History Logic
- **Scenario**: Play 5 moves of a French Defense. Prompt: "Undo my last mistake, show me the better move, then show me the next two moves in the main line."
- **Validation**: Board must execute `undo`, then three sequential `move` actions with 1s delays.

### Category B: Tactical Motif Identification
- **Scenario**: Set up a FEN with a potential 'Greek Gift' sacrifice. Prompt: "I sense a tactic here—what should I do?"
- **Validation**: AI must identify the motif (Sacrifice on h7) and sequence the moves correctly.

### Category C: Technical Special Rules
- **Scenario**: Move a Pawn to the 8th rank. Prompt: "I want to promote to a Knight to deliver a check."
- **Validation**: System must handle 'Underpromotion' (type: move, lan: e7e8n) without defaulting to Queen.
- **Scenario**: queenside castling. Prompt: "Castle long."
- **Validation**: Board must move both King and Rook correctly in one transaction.

### Category D: Positional & Strategic IQ
- **Scenario**: Isolated Queen Pawn (IQP) position. Prompt: "Explain the long-term plan for both sides here."
- **Validation**: AI must highlight key outposts (actions: highlight) and discuss the activity vs. structural trade-off.

### Category E: Boundary & Error Defense
- **Scenario**: Hallucination Check. Ask the AI to move a piece through another piece.
- **Validation**: Frontend `chess.js` validator must REJECT the move, and the AI must acknowledge the error and provide a legal alternative.

## 4. Coding Guardrails
- **No Stale Closures**: All event handlers (e.g., `onDrop`) must access `gameRef.current` to ensure they see the latest state.
- **Async Choreography**: AI actions MUST iterate with an `await` delay to match human processing speed.
- **Type Safety**: Use `as any` or `/* @ts-ignore */` on the `<Chessboard />` `position` prop if type mismatches occur in the 2026 React ecosystem.
- **Resilience**: Implement local "Mock Coaching" if the Gemini API returns a 429 quota error.

## 5. Commit Audit Standards (Pre-Commit Hook)
When performing a pre-commit audit, you must REJECT the code if:
1. **State Leakage**: Logic uses `useState` instead of the `gameRef` for core chess moves.
2. **Desync Risk**: A new UI component is added that doesn't listen to the `ActionScript` protocol.
3. **Security**: Any API keys or `.env` variables are visible in the diff.
4. **Validation**: The `onDrop` function is missing a legality check via `chess.js`.

## 6. Commit
When suggesting a commit, always reference PROJECT_CONFIG.md to confirm the repo and use ./commit.sh 'your message' to execute

## 7. Changelog Summarization Standards
When summarizing commits for the changelog:
1. **Audience**: Write for a chess player, not just a developer.
2. **Impact**: Explain how the change improves the "Omnipotent" experience (e.g., "Pieces now move 20% faster" or "Coach now understands the Sicilian Defense").
3. **Format**: Use the defined Emojis (♟️, 🧠, 🛠️) for categorization.

