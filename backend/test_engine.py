import chess
import chess.engine

# This path matches your '/usr/local/bin/stockfish' result
ENGINE_PATH = "/usr/local/bin/stockfish"

def test_engine():
    print(f"Attempting to start engine at: {ENGINE_PATH}")
    try:
        # FIX: The library returns just the engine object, no unpacking needed
        engine = chess.engine.SimpleEngine.popen_uci(ENGINE_PATH)
        
        # Setup a basic board
        board = chess.Board()
        
        # Ask Stockfish for the best move (thinking for 0.1 seconds)
        result = engine.play(board, chess.engine.Limit(time=0.1))
        
        print(f"✅ Success! Stockfish is alive.")
        print(f"🤖 Suggested move for starting position: {result.move}")
        
        # Properly shut down
        engine.quit()
    except Exception as e:
        print(f"❌ Error: {e}")
        print("\nDouble-check that you have saved the file (Cmd + S) before running.")

if __name__ == "__main__":
    test_engine()