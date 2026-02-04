import os
import json
import re
import chess
import chess.engine
from google import genai  # Modern 2026 SDK
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, TypedDict, Optional
from dotenv import load_dotenv
import httpx

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
    pgn: Optional[str] = None  # Full game PGN for post-game analysis

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

# New types for move sequences
class MoveInSequence(TypedDict):
    san: str
    fen: str

class MoveSequenceSchema(TypedDict):
    label: str
    moves: List[MoveInSequence]

class EnhancedActionScript(BaseModel):
    explanation: str
    sequences: List[Dict] = []  # List of MoveSequenceSchema dicts
    actions: List[Action] = []  # Kept for backward compatibility

class FetchGameRequest(BaseModel):
    url: str

def calculate_fens_for_sequence(moves: List[str], starting_fen: str) -> List[Dict[str, str]]:
    """
    Calculate FEN for each move in sequence.

    Args:
        moves: List of SAN moves ["e4", "e5", "Nf3"]
        starting_fen: Starting board position

    Returns:
        List of moves with FENs: [
            {"san": "e4", "fen": "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1"},
            {"san": "e5", "fen": "..."}
        ]
    """
    board = chess.Board(starting_fen)
    moves_with_fens = []

    for san_move in moves:
        try:
            # Apply move to board
            move = board.parse_san(san_move)
            board.push(move)

            # Store move with resulting FEN
            moves_with_fens.append({
                "san": san_move,
                "fen": board.fen()
            })
        except (chess.InvalidMoveError, chess.IllegalMoveError) as e:
            print(f"Warning: Invalid move {san_move}, skipping: {e}")
            continue

    return moves_with_fens

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

@app.post("/fetch-game")
async def fetch_game(request: FetchGameRequest):
    """
    Fetch game from chess.com URL

    Note: Chess.com's callback API doesn't provide PGN directly.
    Returns instructions for manual PGN download instead.
    """

    # Extract game ID from URL
    match = re.search(r'chess\.com/game/(live|daily)/(\d+)', request.url)
    if not match:
        raise HTTPException(status_code=400, detail="Invalid chess.com URL format")

    game_type, game_id = match.groups()

    # Return helpful instructions instead
    raise HTTPException(
        status_code=501,
        detail=(
            "Chess.com URLs aren't directly supported yet. "
            "Please download the PGN:\n"
            "1. Click 'Share' on the game page\n"
            "2. Click 'Copy PGN'\n"
            "3. Paste the PGN directly into chat\n\n"
            "The PGN paste feature works great for game analysis!"
        )
    )

@app.post("/ask")
async def ask_coach(request: ChatRequest):
    # Mock Mode: Use local responses for testing
    if os.getenv("USE_MOCKS") == "true":
        mock_file_path = os.path.join(os.path.dirname(__file__), "tests", "mocks", "responses.json")
        with open(mock_file_path) as f:
            mock_responses = json.load(f)

        scenario_key = request.message

        if scenario_key in mock_responses:
            # Return mock response in new format (supports both old and new)
            mock_data = mock_responses[scenario_key]
            # Process sequences if present in mock data
            if 'sequences' in mock_data:
                processed_sequences = []
                for seq in mock_data['sequences']:
                    if 'moves' in seq and seq['moves']:
                        # Check if moves already have FENs
                        if isinstance(seq['moves'][0], dict) and 'fen' in seq['moves'][0]:
                            # Already has FENs
                            processed_sequences.append(seq)
                        else:
                            # Calculate FENs
                            moves_with_fens = calculate_fens_for_sequence(
                                seq['moves'],
                                request.fen
                            )
                            processed_sequences.append({
                                "label": seq['label'],
                                "moves": moves_with_fens
                            })
                return {
                    "explanation": mock_data.get('explanation', ''),
                    "sequences": processed_sequences,
                    "actions": mock_data.get('actions', [])
                }
            else:
                # Old format mock data
                return {
                    "explanation": mock_data.get('explanation', ''),
                    "sequences": [],
                    "actions": mock_data.get('actions', [])
                }
        else:
            # Return a default response if the scenario is not found
            return {
                "explanation": "Mock scenario not found.",
                "sequences": [],
                "actions": []
            }

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

        # Check if PGN provided for post-game analysis
        if request.pgn:
            prompt = f"""You are an expert GM Chess Coach analyzing a complete game.

**GAME PGN**
{request.pgn}

**CURRENT POSITION**
FEN: {request.fen}
Turn: {turn}
Full Move History: {move_history}
Stockfish Analysis: {best_move_san} (eval {score:.2f})

**STUDENT QUESTION**
"{request.message}"

**ANALYSIS GUIDANCE**
This is post-game analysis. Use ALL THREE interaction modes to maximize learning:

1. **SEQUENCES for ALTERNATIVES** - Show better moves at critical positions
   - When pointing out mistake (e.g., "13...Kd7 was bad"), provide sequences with alternatives
   - Example: Show "13...Qc7" sequence and "13...O-O-O" sequence as better options

2. **ACTIONS for HIGHLIGHTING** - Show why a move was problematic
   - Highlight mistake squares (exposed king, hanging pieces)
   - Arrows showing attack vectors or threats created by mistake
   - Example: Highlight d7 square, arrow from Qb3 to d7 showing pressure

3. **SEQUENCES for CONTINUATIONS** - Show what could have happened
   - After showing better alternative, demonstrate 2-3 moves of resulting play
   - Shows the concrete benefit of the better move
   - Example: "13...Qc7" sequence continues with "14.Rac1 O-O 15.h3" showing safe development

**Analysis Depth (Context-Aware):**
- Broad question ("where did I go wrong?") → 1-2 most critical mistakes with all three modes
- Specific move ("was 13...Kd7 a mistake?") → Deep dive on that move only
- Comprehensive ("show all mistakes") → 3-5 significant errors with focused analysis
- Position-specific ("what should I do here?") → Analyze just that position

**Key Principle:** Make mistakes tangible through visual feedback (actions) and explorable through alternatives (sequences with continuations)

**RESPONSE FORMAT (JSON)**
{{
  "explanation": "Your coaching explanation in 2-4 sentences",
  "sequences": [
    {{
      "label": "Better: 13...Qc7 (safe king + development)",
      "moves": ["Qc7", "Rac1", "O-O", "h3", "Bh5"]
    }}
  ],
  "actions": [
    {{"type": "highlight", "square": "d7", "intent": "threat", "comment": "King exposed"}},
    {{"type": "arrow", "from": "b3", "to": "d7", "intent": "threat", "comment": "Queen pressure"}}
  ]
}}

**CONSTRAINTS**
- sequences array: 0-4 items (empty if not applicable)
- actions array: 0-6 items (empty if not applicable)
- DON'T put same moves in both sequences and actions
- Each sequence: 3-8 moves, alternating White/Black
- All moves must be valid from current position
- NO text outside JSON structure"""
        else:
            prompt = f"""You are an expert GM Chess Coach providing strategic guidance to help students learn and improve.

**CURRENT POSITION**
FEN: {request.fen}
Turn: {turn}
History: {move_history}
Stockfish Analysis: {best_move_san} (eval {score:.2f})

**STUDENT QUESTION**
"{request.message}"

**YOUR COACHING TOOLKIT**

You have TWO tools to help students learn:

1. **SEQUENCES** - For strategic exploration
   Use when: Student needs to compare options, see multiple plans, understand strategic choices
   Format: 1-4 labeled variations, each 3-8 moves showing complete strategic idea
   Example: Teaching opening choices, comparing attacking vs defensive plans

2. **ACTIONS** - For immediate demonstration
   Use when: Pointing out specific threats, showing single best move, demonstrating tactics
   Types: highlight (emphasize square), arrow (show direction), ghost_move (visual demo)
   Example: Highlighting hanging piece, showing fork pattern

**GUIDELINES**
- Use sequences for strategic questions: "What's the plan?", "What should I do?", "Show me options"
- Use actions for tactical questions: "What's the threat?", "Best move?", "Show me the tactic"
- Both together when helpful: Highlight current threat + show defensive sequences
- Neither when answering factual: "What piece is on e4?" → just explanation
- Keep variations realistic and instructive
- Sequences start from CURRENT position, not earlier in game

**RESPONSE FORMAT (JSON)**
{{
  "explanation": "Your coaching explanation in 2-4 sentences",
  "sequences": [
    {{
      "label": "Short descriptive label (e.g., 'Aggressive: Castle kingside')",
      "moves": ["e4", "e5", "Nf3", "Nc6", ...]
    }}
  ],
  "actions": [
    {{"type": "highlight", "square": "f7", "intent": "threat", "comment": "Weak pawn"}},
    {{"type": "arrow", "from": "d1", "to": "f7", "intent": "threat", "comment": "Queen infiltration"}}
  ]
}}

**CONSTRAINTS**
- sequences array: 0-4 items (empty if not applicable)
- actions array: 0-6 items (empty if not applicable)
- DON'T put same moves in both sequences and actions
- Each sequence: 3-8 moves, alternating White/Black
- All moves must be valid from current position
- NO text outside JSON structure"""

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

        # Process sequences if present (new format)
        processed_sequences = []
        if 'sequences' in action_script and action_script['sequences']:
            for seq in action_script['sequences']:
                moves_with_fens = calculate_fens_for_sequence(
                    seq.get('moves', []),
                    request.fen
                )
                processed_sequences.append({
                    "label": seq.get('label', 'Move sequence'),
                    "moves": moves_with_fens
                })

        # Ensure explanation exists
        if 'explanation' not in action_script:
            action_script['explanation'] = 'Analysis complete.'

        # Return new format with sequences
        return {
            "explanation": action_script['explanation'],
            "sequences": processed_sequences,
            "actions": action_script.get('actions', [])  # For backward compatibility
        }
    except Exception as e:
        # Return a fallback response on error
        return {
            "explanation": f"Error: {str(e)}",
            "sequences": [],
            "actions": [
                {
                    "type": "move",
                    "lan": str(best_move) if 'best_move' in locals() else "e2e4",
                    "comment": "Unable to generate full analysis. Try again."
                }
            ]
        }
    finally:
        # Ensure Stockfish is properly closed even if there's an error
        if engine is not None:
            engine.quit()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)