import os
import json
import chess
import chess.engine
from google import genai  # Modern 2026 SDK
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
from dotenv import load_dotenv

load_dotenv()
# Fix: Using the new GenAI Client
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    fen: str
    message: str
    history: List[str] = []  # Array of moves in SAN format

class Action(BaseModel):
    type: str  # "move", "undo", "reset", "highlight"
    lan: str = ""
    comment: str

class ActionScript(BaseModel):
    explanation: str
    actions: List[Action]

@app.post("/ask", response_model=ActionScript)
async def ask_coach(request: ChatRequest):
    engine = None
    try:
        # A. Stockfish Analysis
        engine_path = os.getenv("STOCKFISH_PATH", "/usr/local/bin/stockfish")
        engine = chess.engine.SimpleEngine.popen_uci(engine_path)
        board = chess.Board(request.fen)

        info = engine.analyse(board, chess.engine.Limit(time=0.1))
        best_move = info["pv"][0]
        score = info["score"].relative.score(mate_score=10000) / 100.0

        # B. Gemini Action Script Generation
        move_history = " ".join(request.history) if request.history else "No moves yet"
        num_moves = len(request.history)

        prompt = f"""You are a GM Coach. If asked to 'go back' or 'walk through,' generate a sequential list of 'undo' and 'move' actions. Refer to the provided 'history' array to ensure perfect context.

Position: {request.fen}
History ({num_moves} moves): {move_history}
Stockfish: {best_move} (eval {score})
Question: {request.message}

CRITICAL: Return ONLY valid JSON. Every move or undo mentioned must exist in the actions array.

SCHEMA:
{{
  "explanation": "Natural language response",
  "actions": [
    {{"type": "move", "lan": "e2e4", "comment": "Opening with e4"}},
    {{"type": "undo", "comment": "Going back one move"}},
    {{"type": "reset", "comment": "Starting fresh"}},
    {{"type": "highlight", "lan": "e2e4", "comment": "Highlighting this square"}}
  ]
}}

Action Types:
- "move": Execute move (MUST include "lan" in Long Algebraic Notation: e2e4, g1f3, b8c6, e7e8q for promotion)
- "undo": Step back one move (for "go back X", use X consecutive undo actions)
- "reset": Return to starting position
- "highlight": Visual emphasis on square/move (optional, for teaching)

Rules:
1. For "go back X moves": Generate X undo actions
2. For "what if X instead of Y": Undo to that point, play X, show analysis, then undo X and replay Y
3. For opening demonstrations: Reset board, then sequential move actions
4. Each action MUST have "type" and "comment"
5. Move actions MUST have valid "lan" field
6. Use move history to calculate exact undo counts
7. NO text outside JSON structure"""

        # Fix: Use 2026 model with JSON mode
        response = client.models.generate_content(
            model="gemini-flash-latest",
            contents=prompt,
            config={"response_mime_type": "application/json"}
        )

        # Parse JSON response
        response_text = response.text.strip()

        # Remove markdown code blocks if present
        if response_text.startswith('```'):
            response_text = response_text.split('```')[1]
            if response_text.startswith('json'):
                response_text = response_text[4:]
            response_text = response_text.strip()

        action_script = json.loads(response_text)

        # Ensure actions array exists
        if not action_script.get('actions') or len(action_script['actions']) == 0:
            action_script['actions'] = [
                {
                    "type": "move",
                    "lan": str(best_move),
                    "comment": "Stockfish recommends this move."
                }
            ]

        # Validate each action
        for action in action_script['actions']:
            if 'type' not in action:
                action['type'] = 'move' if action.get('lan') else 'reset'
            if 'lan' not in action:
                action['lan'] = ""
            if 'comment' not in action:
                action['comment'] = ""

        # Ensure explanation exists
        if 'explanation' not in action_script:
            action_script['explanation'] = 'Analysis complete.'

        return ActionScript(**action_script)
    except Exception as e:
        # Return a fallback action script on error
        return ActionScript(
            explanation=f"Error: {str(e)}",
            actions=[
                Action(
                    type="move",
                    lan=str(best_move) if 'best_move' in locals() else "e2e4",
                    comment="Unable to generate full analysis. Try again."
                )
            ]
        )
    finally:
        # Ensure Stockfish is properly closed even if there's an error
        if engine is not None:
            engine.quit()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)