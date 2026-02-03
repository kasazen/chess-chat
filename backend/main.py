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
    type: str  # "move", "undo", "reset", "highlight", "arrow", "ghost_move"
    lan: str = ""
    san: str = ""
    square: str = ""
    from_: str = ""  # Note: renamed to avoid Python keyword
    to: str = ""
    intent: str = ""
    comment: str = ""

    class Config:
        fields = {'from_': 'from'}  # Map from_ to 'from' in JSON

class ActionScript(BaseModel):
    explanation: str
    actions: List[Action]

def mock_stockfish_analysis(board: chess.Board):
    """Fallback evaluator when Stockfish is unavailable or hits errors"""
    # Simple material-based evaluation
    piece_values = {
        chess.PAWN: 1,
        chess.KNIGHT: 3,
        chess.BISHOP: 3,
        chess.ROOK: 5,
        chess.QUEEN: 9,
        chess.KING: 0
    }

    score = 0
    for square in chess.SQUARES:
        piece = board.piece_at(square)
        if piece:
            value = piece_values[piece.piece_type]
            score += value if piece.color == chess.WHITE else -value

    # Adjust score based on turn
    if board.turn == chess.BLACK:
        score = -score

    # Get a legal move (preferably capture or center control)
    legal_moves = list(board.legal_moves)
    if not legal_moves:
        return None, score

    # Prioritize captures, then center moves
    best_move = None
    for move in legal_moves:
        if board.is_capture(move):
            best_move = move
            break

    if not best_move:
        center_squares = [chess.E4, chess.D4, chess.E5, chess.D5]
        for move in legal_moves:
            if move.to_square in center_squares:
                best_move = move
                break

    if not best_move:
        best_move = legal_moves[0]

    return best_move, score

@app.post("/ask", response_model=ActionScript)
async def ask_coach(request: ChatRequest):
    # Mock Mode: Use local responses for testing
    if os.getenv("USE_MOCKS") == "true":
        mock_file_path = os.path.join(os.path.dirname(__file__), "tests", "mocks", "responses.json")
        with open(mock_file_path) as f:
            mock_responses = json.load(f)

        scenario_key = request.message

        if scenario_key in mock_responses:
            # Use Pydantic models to ensure the response is valid before returning
            return ActionScript(**mock_responses[scenario_key])
        else:
            # Return a default response if the scenario is not found
            return ActionScript(explanation="Mock scenario not found.", actions=[])

    # Live Mode: Real Gemini API and Stockfish
    engine = None
    best_move = None
    score = 0.0

    try:
        # A. Stockfish Analysis (with fallback)
        board = chess.Board(request.fen)

        try:
            engine_path = os.getenv("STOCKFISH_PATH", "/usr/local/bin/stockfish")
            engine = chess.engine.SimpleEngine.popen_uci(engine_path)
            info = engine.analyse(board, chess.engine.Limit(time=0.1))
            best_move = info["pv"][0]
            score = info["score"].relative.score(mate_score=10000) / 100.0
        except Exception as stockfish_error:
            # Fallback to mock evaluator
            print(f"Stockfish unavailable: {stockfish_error}. Using mock evaluator.")
            best_move, score = mock_stockfish_analysis(board)
            if best_move is None:
                best_move = "e2e4"  # Default opening move

        # B. Gemini Action Script Generation (Turn-Aware)
        turn = "White" if board.turn == chess.WHITE else "Black"
        move_history = " ".join(request.history) if request.history else "No moves yet"
        best_move_san = board.san(best_move) if isinstance(best_move, chess.Move) else str(best_move)

        prompt = f"""You are a GM Chess Coach. Your primary directive is to be TURN-AWARE. It is currently {turn}'s turn to move.

Position: {request.fen}
History: {move_history}
Stockfish suggests: {best_move_san} (eval {score})
Question: {request.message}

CRITICAL RULES:
1. **TURN AWARENESS**: Only generate a `move` action if it is for {turn}.
2. **DEMONSTRATION**: If you want to show a move for the OTHER player, you MUST use `ghost_move`, `arrow`, or `highlight`. A `ghost_move` is VISUAL ONLY and does not change the game state.
3. **NOTATION**: All `move` actions MUST use Standard Algebraic Notation (SAN), e.g., "Nf3", "O-O", "e8=Q".

SCHEMA (MUST be valid JSON):
{{
  "explanation": "Conversational coach text",
  "actions": [
    {{"type": "move", "san": "Nf3", "comment": "A physical move for {turn}"}},
    {{"type": "ghost_move", "from": "d7", "to": "d5", "intent": "idea", "comment": "A visual-only move for the other side"}},
    {{"type": "arrow", "from": "g1", "to": "f3", "intent": "idea", "comment": "Direction indicator"}},
    {{"type": "highlight", "square": "e4", "intent": "threat", "comment": "Mark important square"}},
    {{"type": "undo", "comment": "Step back one move"}},
    {{"type": "reset", "comment": "Return to starting position"}}
  ]
}}

Action Types:
- "move": Execute ACTUAL move for {turn} (MUST use SAN: "Nf3", "O-O", "e8=Q")
- "ghost_move": VISUAL ONLY demonstration for opponent (from/to squares, intent required)
- "arrow": Directional indicator (from/to squares, intent: idea/threat)
- "highlight": Square emphasis (square name, intent: bestMove/threat/info/idea)
- "undo": Step back one move
- "reset": Return to starting position

Intent Values:
- "bestMove": Optimal moves (SeaGreen)
- "threat": Tactical dangers (Firebrick)
- "info": Educational markers (Yellow)
- "idea": Strategic concepts (DeepSkyBlue)

Rules:
1. NEVER use `move` for the opponent - use `ghost_move`, `arrow`, or `highlight` instead
2. For "go back X moves": Generate X undo actions
3. For "what if": Undo, show ghost_move/arrow, then restore
4. For opening demonstrations: If it's {turn}'s turn, use real moves; if showing opponent responses, use ghost_moves
5. Each action MUST have "type" and appropriate fields
6. NO text outside JSON structure"""

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