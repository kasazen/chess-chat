import { useState, useRef, useEffect, useReducer, useCallback } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import mockResponses from '../tests/mocks/responses.json';
import { MoveSequenceComponent } from './components/MoveSequence';
import type { MoveSequence, MoveChip } from './components/MoveSequence';
import { calculateFensForSequence } from './utils/fenCalculator';

const CHESS_THEME = {
  colors: {
    bestMove: 'rgba(46, 139, 87, 0.5)',   // SeaGreen
    threat: 'rgba(178, 34, 34, 0.5)',      // Firebrick
    info: 'rgba(255, 255, 0, 0.4)',        // Yellow
    idea: 'rgba(0, 191, 255, 0.5)',        // DeepSkyBlue
  },
  arrow: {
    idea: '#00bfff',
    threat: '#b22222'
  }
};

interface Message {
  role: 'user' | 'ai';
  text: string;
  type?: 'explanation' | 'move' | 'error';
  intent?: 'bestMove' | 'threat' | 'info' | 'idea';
  sequences?: MoveSequence[];  // NEW: Attached move sequences
}

interface Action {
  type: 'move' | 'undo' | 'reset' | 'highlight' | 'arrow' | 'ghost_move';
  san?: string;  // Standard Algebraic Notation for real moves
  square?: string;  // For highlight actions
  from?: string;  // For arrow and ghost_move actions
  to?: string;  // For arrow and ghost_move actions
  intent?: 'bestMove' | 'threat' | 'info' | 'idea';
  comment?: string;
}

interface ActionScript {
  explanation: string;
  actions: Action[];
  sequences?: Array<{
    label: string;
    moves: Array<{ san: string; fen: string }>;
  }>;
}

// Consolidated Board Render State (Section 2.1)
interface BoardRenderState {
  fen: string;
  arrows: Array<{ startSquare: string; endSquare: string; color: string }>;
  squares: Record<string, React.CSSProperties>;
}

// Master application state interface
interface AppState {
  boardRenderState: BoardRenderState;
  messages: Message[];
  isTyping: boolean;
  isAnimating: boolean;
  isProcessingDelay: boolean;
  untrustedActionQueue: Action[];
  actionQueue: Action[];
}

// Reducer action types
type ReducerAction =
  | { type: 'START_SEND_MESSAGE'; payload: { userMessage: Message } }
  | { type: 'RECEIVE_AI_EXPLANATION'; payload: { explanation: string; actions?: Action[]; sequences?: MoveSequence[] } }
  | { type: 'PROCESS_ACTION'; payload: { fen: string; arrows: Array<{ startSquare: string; endSquare: string; color: string }>; squares: Record<string, React.CSSProperties>; comment?: string; intent?: Action['intent'] } }
  | { type: 'START_PROCESSING_DELAY' }
  | { type: 'END_PROCESSING_DELAY' }
  | { type: 'REMOVE_FIRST_ACTION' }
  | { type: 'FINISH_ACTION_PROCESSING' }
  | { type: 'HANDLE_SEND_ERROR'; payload: string }
  | { type: 'RESET_GAME'; payload: { fen: string } }
  | { type: 'SET_UNTRUSTED_QUEUE'; payload: Action[] }
  | { type: 'SET_ACTION_QUEUE'; payload: Action[] }
  | { type: 'CLEAR_BOARD_VISUALS' };

// Application state reducer
function appReducer(state: AppState, action: ReducerAction): AppState {
  switch (action.type) {
    case 'START_SEND_MESSAGE':
      return {
        ...state,
        messages: [...state.messages, action.payload.userMessage],
        isTyping: true,
        isAnimating: true,
      };

    case 'RECEIVE_AI_EXPLANATION':
      return {
        ...state,
        messages: [
          ...state.messages,
          {
            role: 'ai',
            text: action.payload.explanation,
            type: 'explanation',
            sequences: action.payload.sequences  // NEW: Attach sequences
          }
        ],
        isTyping: false,
        untrustedActionQueue: action.payload.actions || [],
      };

    case 'SET_UNTRUSTED_QUEUE':
      return {
        ...state,
        untrustedActionQueue: action.payload,
      };

    case 'SET_ACTION_QUEUE':
      return {
        ...state,
        actionQueue: action.payload,
      };

    case 'CLEAR_BOARD_VISUALS':
      return {
        ...state,
        boardRenderState: {
          ...state.boardRenderState,
          arrows: [],
          squares: {},
        },
      };

    case 'PROCESS_ACTION':
      // ATOMIC UPDATE: Board state and message updated together
      return {
        ...state,
        boardRenderState: {
          fen: action.payload.fen,
          arrows: action.payload.arrows,
          squares: action.payload.squares,
        },
        messages: action.payload.comment
          ? [
              ...state.messages,
              {
                role: 'ai',
                text: action.payload.comment,
                type: 'move',
                intent: action.payload.intent,
              },
            ]
          : state.messages,
      };

    case 'REMOVE_FIRST_ACTION':
      return {
        ...state,
        actionQueue: state.actionQueue.slice(1),
      };

    case 'START_PROCESSING_DELAY':
      return {
        ...state,
        isProcessingDelay: true,
      };

    case 'END_PROCESSING_DELAY':
      return {
        ...state,
        isProcessingDelay: false,
      };

    case 'FINISH_ACTION_PROCESSING':
      return {
        ...state,
        isAnimating: false,
      };

    case 'HANDLE_SEND_ERROR':
      return {
        ...state,
        messages: [
          ...state.messages,
          {
            role: 'ai',
            text: action.payload,
            type: 'error',
          },
        ],
        isTyping: false,
      };

    case 'RESET_GAME':
      return {
        ...state,
        boardRenderState: {
          fen: action.payload.fen,
          arrows: [],
          squares: {},
        },
        messages: [],
        actionQueue: [],
        untrustedActionQueue: [],
        isAnimating: false,
      };

    default:
      return state;
  }
}

const promptPills = [
  { label: "Plan for White", prompt: "What's the plan for White here?" },
  { label: "Black's Tactic", prompt: "Show me a tactic for Black." },
  { label: "Undo & Suggest", prompt: "Undo my last move and suggest something else." },
];

function App() {
  const gameRef = useRef(new Chess());
  console.log('App init: typeof gameRef.current.isGameOver', typeof gameRef.current.isGameOver);

  // Initialize reducer state
  const initialState: AppState = {
    boardRenderState: {
      fen: gameRef.current.fen(),
      arrows: [],
      squares: {},
    },
    messages: [],
    isTyping: false,
    isAnimating: false,
    isProcessingDelay: false,
    untrustedActionQueue: [],
    actionQueue: [],
  };

  const [state, dispatch] = useReducer(appReducer, initialState);

  // Simple, non-related state variables remain as useState
  const [boardOrientation] = useState<'white' | 'black'>('white');
  const [input, setInput] = useState('');
  const [useMockData, setUseMockData] = useState(false);
  const [selectedChipId, setSelectedChipId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Ref for sendMessage function to expose stable test hook
  const sendMessageRef = useRef<((msg?: string) => Promise<void>) | undefined>(undefined);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.messages]);

  // Test backdoor for Playwright behavioral testing
  useEffect(() => {
    // Always expose test vars in development/test mode
    (window as any).__test_vars = {
      game: gameRef.current,
      gameRef: gameRef,
      customArrows: state.boardRenderState.arrows,
      fen: state.boardRenderState.fen,
      isAnimating: state.isAnimating,
      actionQueue: state.actionQueue,
      // Stable test hook for triggering AI responses
      sendMessage: (msg: string) => sendMessageRef.current?.(msg),
      // NEW DEBUG HOOK: Get full Chess.js state from App's context
      getChessDebugState: () => {
        const game = gameRef.current;
        console.log('DEBUG inside App.tsx getChessDebugState: game object:', game);
        console.log('DEBUG inside App.tsx getChessDebugState: typeof game:', typeof game);
        console.log('DEBUG inside App.tsx getChessDebugState: game.constructor.name:', game?.constructor?.name);
        console.log('DEBUG inside App.tsx getChessDebugState: Object.getPrototypeOf(game):', Object.getPrototypeOf(game));
        console.log('DEBUG inside App.tsx getChessDebugState: game.fen is a function:', typeof game?.fen === 'function');
        console.log('DEBUG inside App.tsx getChessDebugState: game.isGameOver is a function:', typeof game?.isGameOver === 'function');

        let dummyMoveAttempt = { success: false, reason: '' };
        try {
          const tempGameForMoveTest = new Chess(game.fen()); // Create a temp game for move test
          const testMove = tempGameForMoveTest.move('e2e4'); // Try a standard opening move for white
          dummyMoveAttempt = { success: !!testMove, reason: testMove ? 'Legal/successful' : 'Move returned null' };
        } catch (e: any) {
          dummyMoveAttempt = { success: false, reason: e.message };
        }

        let dummyMoveOnGameRefAttempt = { success: false, reason: '' };
        try {
          const testMove = game.move('e2e4'); // Try making a move DIRECTLY on gameRef.current
          dummyMoveOnGameRefAttempt = { success: !!testMove, reason: testMove ? 'Legal/successful' : 'Move returned null' };
        } catch (e: any) {
          dummyMoveOnGameRefAttempt = { success: false, reason: e.message };
        }


        return {
          fen: game.fen(),
          // isGameOver: game.game_over(), // Commented out for debug isolation
          // inCheckmate: game.in_checkmate(), // Commented out for debug isolation
          // inDraw: game.in_draw(), // Commented out for debug isolation
          // inThreefoldRepetition: game.in_threefold_repetition(), // Commented out for debug isolation
          // inStalemate: game.in_stalemate(), // Commented out for debug isolation
          turn: game.turn(),
          dummyMoveAttempt,
          dummyMoveOnGameRefAttempt, // NEW LOG
        };
      },
    };
  }, [state.boardRenderState, state.isAnimating, state.actionQueue, gameRef]);

  // PHASE 1: Triage - Validate and transform untrusted actions
  useEffect(() => {
    console.log('[Triage useEffect] Triggered. Queue length:', state.untrustedActionQueue.length);

    // Don't process during animation
    if (state.isAnimating) {
      console.log('[Triage] Skipping - animation in progress');
      return;
    }

    if (state.untrustedActionQueue.length === 0) {
      console.log('[Triage useEffect] Queue empty, returning');
      return;
    }

    console.log('[Triage] Starting validation. Current FEN:', gameRef.current.fen());
    const validatedActions: Action[] = [];
    const tempGame = new Chess(gameRef.current.fen());

    for (const action of state.untrustedActionQueue) {
      console.log('[Triage] Processing action:', action);
      if (action.type === 'move' && action.san) {
        console.log('[Triage] Move action detected, san:', action.san);
        // Dry-run the move against temp game state
        let isValid;
        try {
          isValid = tempGame.move(action.san);
          console.log('[Triage] Move result:', isValid);
        } catch (error) {
          console.error('[Triage] Error during move:', error);
          isValid = null;
        }

        if (isValid) {
          // Move is legal - pass through unchanged
          console.log('[Triage] Move is LEGAL, passing through');
          validatedActions.push(action);
        } else {
          // Move is illegal - transform to ghost_move for visual-only display
          // Parse SAN to extract squares (simple approach for common cases)
          console.log('[Triage] Illegal move detected:', action.san, 'Current turn:', tempGame.turn());
          const from = parseSanToSquares(action.san, tempGame);
          console.log('[Triage] Parsed squares:', from);
          if (from) {
            const ghostAction = {
              type: 'ghost_move' as const,
              from: from.from,
              to: from.to,
              intent: action.intent || 'idea' as const,
              comment: action.comment ? `${action.comment} (visual-only)` : undefined
            };
            console.log('[Triage] Created ghost_move action:', ghostAction);
            validatedActions.push(ghostAction);
          } else {
            console.log('[Triage] Failed to parse squares, dropping action');
          }
        }
      } else if (action.type === 'undo') {
        tempGame.undo();
        validatedActions.push(action);
      } else {
        // Visual actions (highlight, arrow, ghost_move) pass through
        validatedActions.push(action);
      }
    }

    // Feed validated actions to execution phase
    dispatch({ type: 'SET_ACTION_QUEUE', payload: validatedActions });
    dispatch({ type: 'SET_UNTRUSTED_QUEUE', payload: [] });
  }, [state.untrustedActionQueue, state.isAnimating]);

  // Helper to parse SAN notation to from/to squares
  function parseSanToSquares(san: string, game: Chess): { from: string; to: string } | null {
    try {
      // First try: Check if it's legal in current position
      const moves = game.moves({ verbose: true });
      for (const move of moves) {
        if (move.san === san) {
          return { from: move.from, to: move.to };
        }
      }

      // Second try: Create a hypothetical game with flipped turn to extract squares
      // This handles the case where AI suggests a move for the wrong player
      const hypotheticalGame = new Chess(game.fen());

      // Manually flip turn by modifying FEN
      const fenParts = hypotheticalGame.fen().split(' ');
      fenParts[1] = fenParts[1] === 'w' ? 'b' : 'w'; // Flip turn
      const flippedFen = fenParts.join(' ');

      try {
        hypotheticalGame.load(flippedFen);
        const hypotheticalMoves = hypotheticalGame.moves({ verbose: true });

        for (const move of hypotheticalMoves) {
          if (move.san === san) {
            return { from: move.from, to: move.to };
          }
        }
      } catch (e) {
        // Flipped FEN might be invalid, continue to pattern matching
      }

      // Third try: Pattern matching for explicit square moves like "e2e4"
      const explicitMatch = san.match(/([a-h][1-8]).*?([a-h][1-8])/);
      if (explicitMatch) {
        return { from: explicitMatch[1], to: explicitMatch[2] };
      }

      // Fourth try: For simple piece moves like "Nf3", extract destination
      // and find a piece that could move there
      const pieceMatch = san.match(/^([NBRQK])([a-h])?([1-8])?x?([a-h][1-8])/);
      if (pieceMatch) {
        const destSquare = pieceMatch[4];
        const piece = pieceMatch[1];

        // Find pieces of this type on the board
        const board = game.board();
        for (let rank = 0; rank < 8; rank++) {
          for (let file = 0; file < 8; file++) {
            const square = board[rank][file];
            if (square && square.type.toUpperCase() === piece) {
              const fromSquare = String.fromCharCode(97 + file) + (8 - rank);
              // Return this as a potential source
              // (In a real scenario, we'd check if the piece can actually reach the dest)
              return { from: fromSquare, to: destSquare };
            }
          }
        }
      }

      // Fifth try: Pawn moves like "e4"
      const pawnMatch = san.match(/^([a-h])([1-8])$/);
      if (pawnMatch) {
        const file = pawnMatch[1];
        const rank = parseInt(pawnMatch[2]);
        const destSquare = file + rank;

        // Pawn could come from one or two squares back
        const fromRank = game.turn() === 'w' ? rank - 1 : rank + 1;
        const fromSquare = file + fromRank;

        return { from: fromSquare, to: destSquare };
      }

    } catch (e) {
      console.error('Failed to parse SAN:', san, e);
    }
    return null;
  }

  // Helper to get message styling based on type and intent
  function getMessageStyle(message: Message) {
    if (message.role === 'user') {
      return {
        backgroundColor: '#007bff',
        fontStyle: 'normal' as const,
        borderLeft: 'none'
      };
    }

    // Base style for AI messages
    let baseStyle: {
      backgroundColor: string;
      fontStyle: 'normal' | 'italic';
      borderLeft: string;
    } = {
      backgroundColor: '#383838',
      fontStyle: 'normal',
      borderLeft: '3px solid #888'
    };

    // Type-specific styling
    switch (message.type) {
      case 'explanation':
        baseStyle = {
          backgroundColor: '#2d5016',
          fontStyle: 'normal',
          borderLeft: '3px solid #4CAF50'
        };
        break;
      case 'move':
        baseStyle = {
          backgroundColor: '#3a3a3a',
          fontStyle: 'italic',
          borderLeft: '3px solid #888'
        };
        break;
      case 'error':
        baseStyle = {
          backgroundColor: '#5c1a1a',
          fontStyle: 'normal',
          borderLeft: '3px solid #f44336'
        };
        break;
    }

    // Intent-based styling coordination (overrides border color)
    if (message.intent) {
      return {
        ...baseStyle,
        borderLeft: `3px solid ${CHESS_THEME.colors[message.intent] || '#888'}`
      };
    }

    return baseStyle;
  }

  // 1. Handle user moving a piece on the board
  function onDrop({ sourceSquare, targetSquare }: { piece: { isSparePiece: boolean; position: string; pieceType: string }; sourceSquare: string; targetSquare: string | null }): boolean {
    if (state.isAnimating || !targetSquare) return false;

    try {
      const move = gameRef.current.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: 'q',
      });

      if (!move) return false;

      // Sync UI state with ref
      dispatch({
        type: 'PROCESS_ACTION',
        payload: {
          fen: gameRef.current.fen(),
          arrows: state.boardRenderState.arrows,
          squares: state.boardRenderState.squares,
        },
      });
      return true;
    } catch (e) {
      return false;
    }
  }

  // 2. Clear Board / New Game
  function resetGame() {
    gameRef.current.reset();
    dispatch({
      type: 'RESET_GAME',
      payload: { fen: gameRef.current.fen() }
    });
  }

  // 2.1. Handle chip click to navigate to position
  function handleChipClick(chip: MoveChip) {
    // If animation running, interrupt it
    if (state.isAnimating) {
      console.log('[Chip Click] Interrupting animation to explore variation');

      // Clear action queues
      dispatch({ type: 'SET_ACTION_QUEUE', payload: [] });
      dispatch({ type: 'SET_UNTRUSTED_QUEUE', payload: [] });

      // Release animation lock
      dispatch({ type: 'FINISH_ACTION_PROCESSING' });
      dispatch({ type: 'END_PROCESSING_DELAY' });
    }

    // Snap to absolute position stored in chip
    gameRef.current.load(chip.fen);

    // Update board display (clears any animated visuals)
    dispatch({
      type: 'PROCESS_ACTION',
      payload: {
        fen: chip.fen,
        arrows: [],
        squares: {},
      },
    });

    // Highlight this chip
    setSelectedChipId(chip.id);

    console.log(`[Chip Click] Exploring variation: ${chip.notation} @ ${chip.fen}`);
  }

  // 3. Handle sending a message to the Backend
  const sendMessage = useCallback(async (messageOverride?: string) => {
    const messageToSend = messageOverride || input;
    if (!messageToSend.trim() || state.isAnimating) return;

    const userMsg: Message = { role: 'user', text: messageToSend };
    const currentInput = messageToSend;
    const currentFen = gameRef.current.fen();
    const moveHistory = gameRef.current.history();

    setInput('');

    // STEP 1: Start send message - lock and add user message
    dispatch({ type: 'START_SEND_MESSAGE', payload: { userMessage: userMsg } });
    dispatch({ type: 'CLEAR_BOARD_VISUALS' });

    try {
      let data: ActionScript;
      const processedInput = currentInput.trim(); // Ensure input is trimmed for lookup

      if (useMockData) {
        // Frontend-side mock interception
        console.log('[Frontend Mock] Attempting to use mock data for scenario:', processedInput);

        // Handle module-style JSON import
        let mockData = mockResponses as any;
        if (mockData.default) {
          mockData = mockData.default;
        }

        const mockResponse = mockData[processedInput]; // Use trimmed input as key
        if (mockResponse) {
          // Simulate network delay for better realism
          await new Promise(resolve => setTimeout(resolve, 500));
          data = mockResponse; // Direct assignment of mock data
        } else {
          // CRITICAL: Provide specific error for mock mode
          throw new Error(`Mock scenario "${processedInput}" not found in responses.json.`);
        }
      } else {
        // Proceed with actual API call
        const response = await fetch('http://localhost:8000/ask', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fen: currentFen,
            message: currentInput,
            history: moveHistory
          }),
        });

        if (!response.ok) throw new Error('Backend not reachable');
        data = await response.json();
      }

      console.log('[sendMessage] Received data:', data);

      // Validate response structure
      if (!data.explanation) {
        console.error('[sendMessage] Invalid response structure:', data);
        throw new Error('Invalid response format from backend');
      }

      // Process sequences if present (new format)
      let processedSequences: MoveSequence[] | undefined;
      if (data.sequences && data.sequences.length > 0) {
        processedSequences = data.sequences.map((seq: any, seqIdx: number) => {
          // ✅ CALCULATE FENS IF NEEDED
          let movesWithFens: Array<{ san: string; fen: string }>;

          if (seq.moves.length > 0 && typeof seq.moves[0] === 'string') {
            // String array - calculate FENs
            console.log(`[sendMessage] Calculating FENs for sequence: ${seq.label}`);
            movesWithFens = calculateFensForSequence(seq.moves, gameRef.current.fen());
          } else {
            // Object array - use as-is
            movesWithFens = seq.moves;
          }

          const chips = movesWithFens.map((move, moveIdx) => {
            const fullMoveNumber = Math.floor(moveIdx / 2) + 1;
            const isWhiteMove = moveIdx % 2 === 0;

            return {
              id: `seq-${seqIdx}-chip-${moveIdx}`,
              notation: isWhiteMove
                ? `${fullMoveNumber}. ${move.san}`
                : move.san,
              fen: move.fen,
              moveNumber: fullMoveNumber,
              color: isWhiteMove ? 'white' : 'black'
            } as MoveChip;
          });

          return {
            id: `seq-${seqIdx}`,
            label: seq.label,
            chips: chips
          } as MoveSequence;
        });
      }

      console.log('[sendMessage] Processed sequences:', processedSequences);
      console.log('[sendMessage] Actions received:', data.actions);

      // Dispatch AI explanation with sequences and/or actions
      dispatch({
        type: 'RECEIVE_AI_EXPLANATION',
        payload: {
          explanation: data.explanation,
          sequences: processedSequences,
          actions: data.actions || []
        }
      });

    } catch (error: any) {
      console.error("Error in sendMessage:", error);
      let errorMessage = "I'm having trouble connecting to my brain. Please check if the backend server is running and your API key is correct.";

      // Refined error message when in mock mode
      if (useMockData && error.message.includes("Mock scenario")) {
        errorMessage = `Mock Data Error: ${error.message} Please check frontend/tests/mocks/responses.json.`;
      } else if (error.message.includes("Backend not reachable")) {
        errorMessage = "Backend not reachable. Is the server running?";
      }

      dispatch({ type: 'HANDLE_SEND_ERROR', payload: errorMessage });
    }
  }, [input, state.isAnimating, useMockData, dispatch, setInput, gameRef]);

  // Keep sendMessageRef updated with current sendMessage function
  useEffect(() => {
    sendMessageRef.current = sendMessage;
  }, [sendMessage]);

  // STEP 3: Causal useEffect Chain (Section 2.2)

  // Hook 1: The "Executor" useEffect
  // Responsibility: Process actions and dispatch atomic state updates
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    // Phase 1: Check for work
    if (state.actionQueue.length === 0 && !state.isProcessingDelay) { // <-- MODIFIED CONDITION
      // Transaction complete - release the lock if it was engaged
      if (state.isAnimating) {
        dispatch({ type: 'FINISH_ACTION_PROCESSING' });
      }
      return;
    }

    // Don't process if we're in the delay period between actions
    if (state.isProcessingDelay) {
      return;
    }

    // If we are here, there are actions to process
    dispatch({ type: 'START_PROCESSING_DELAY' });
    const action = state.actionQueue[0];

    // Phase 2: Execute the action and prepare new board state
    try {
      let messageIntent: Action['intent'] | undefined;
      let newArrows = [...state.boardRenderState.arrows];
      let newSquares = { ...state.boardRenderState.squares };

      if (action.type === 'move' && action.san) {
        const move = gameRef.current.move(action.san);
        if (!move) {
          console.error(`Illegal move in Executor: ${action.san}`);
          dispatch({
            type: 'HANDLE_SEND_ERROR',
            payload: `Invalid move attempted: ${action.san}. This action was skipped.`,
          });
          dispatch({ type: 'REMOVE_FIRST_ACTION' });
          timeoutId = setTimeout(() => {
            dispatch({ type: 'END_PROCESSING_DELAY' });
          }, 750);
          // Early return - don't process this action further
          // Cleanup will be handled by the useEffect's main return statement at the end
          return () => {
            if (timeoutId) clearTimeout(timeoutId);
          };
        }
      }
      else if (action.type === 'undo') {
        gameRef.current.undo();
      }
      else if (action.type === 'reset') {
        gameRef.current.reset();
      }
      else if (action.type === 'highlight' && action.square) {
        newSquares = {
          ...newSquares,
          [action.square]: { backgroundColor: CHESS_THEME.colors[action.intent!] }
        };
        messageIntent = action.intent;
      }
      else if (action.type === 'arrow' && action.from && action.to) {
        const color = CHESS_THEME.arrow[action.intent === 'idea' ? 'idea' : 'threat'];
        newArrows = [...newArrows, { startSquare: action.from, endSquare: action.to, color }];
        messageIntent = action.intent;
      }
      else if (action.type === 'ghost_move' && action.from && action.to) {
        // VISUAL ONLY - DO NOT touch gameRef
        console.log('[Executor] Processing ghost_move:', action.from, '->', action.to);
        const color = CHESS_THEME.arrow[action.intent === 'idea' ? 'idea' : 'threat'];
        const arrow = { startSquare: action.from, endSquare: action.to, color };
        console.log('[Executor] Creating arrow:', arrow);
        newArrows = [...newArrows, arrow];
        console.log('[Executor] New arrows state:', newArrows);
        messageIntent = action.intent;
      }

      // ATOMIC UPDATE: Dispatch single action that updates BOTH board and messages
      dispatch({
        type: 'PROCESS_ACTION',
        payload: {
          fen: gameRef.current.fen(),
          arrows: newArrows,
          squares: newSquares,
          comment: action.comment,
          intent: messageIntent,
        },
      });

      // Remove action from queue
      dispatch({ type: 'REMOVE_FIRST_ACTION' });

    } catch (error: any) {
      console.error("Action failed:", error.message);
      dispatch({
        type: 'HANDLE_SEND_ERROR',
        payload: `State transition failed: ${error.message}`,
      });
      dispatch({ type: 'REMOVE_FIRST_ACTION' });
    }

    // Phase 3: Delay before processing next action (750ms between actions)
    timeoutId = setTimeout(() => {
      dispatch({ type: 'END_PROCESSING_DELAY' });
    }, 750);

    // Cleanup function to prevent memory leaks
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };

  }, [state.actionQueue, state.isAnimating, state.isProcessingDelay, state.boardRenderState.arrows, state.boardRenderState.squares]);

  // Watchdog: Prevent permanently stuck lock
  useEffect(() => {
    if (!state.isAnimating) return;

    const watchdogTimer = setTimeout(() => {
      console.error('[WATCHDOG] Lock stuck for 30s, forcing unlock');
      dispatch({ type: 'FINISH_ACTION_PROCESSING' });
      dispatch({ type: 'SET_ACTION_QUEUE', payload: [] });
      dispatch({ type: 'END_PROCESSING_DELAY' });
    }, 30000); // 30 second failsafe

    return () => clearTimeout(watchdogTimer);
  }, [state.isAnimating, dispatch]);

  // Note: Messenger hook removed - reducer now handles atomic board+message updates

  return (
    <div
      data-testid="game-container"
      data-fen={state.boardRenderState.fen}
      style={{
        display: 'flex',
        height: '100vh',
        width: '100vw',
        backgroundColor: '#1a1a1a',
        color: '#ffffff',
        fontFamily: 'sans-serif',
        margin: 0,
        overflow: 'hidden',
        position: 'relative'
      }}>

      {/* MOCK DATA TOGGLE */}
      <button
        onClick={() => setUseMockData(!useMockData)}
        style={{
          position: 'absolute',
          top: '10px',
          left: '10px',
          padding: '10px 15px',
          backgroundColor: useMockData ? '#4CAF50' : '#666',
          color: 'white',
          border: 'none',
          borderRadius: '5px',
          cursor: 'pointer',
          fontWeight: 'bold',
          zIndex: 1000
        }}
      >
        {useMockData ? 'Mock Data ON' : 'Live API'}
      </button>

      {/* LEFT SIDE: CHESSBOARD CONTAINER */}
      <div style={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column',
        justifyContent: 'center', 
        alignItems: 'center', 
        padding: '40px' 
      }}>
        <div style={{ width: 'min(70vh, 600px)' }}>
          <Chessboard
            options={{
              position: state.boardRenderState.fen,
              onPieceDrop: onDrop,
              boardOrientation: boardOrientation,
              darkSquareStyle: { backgroundColor: '#779556' },
              lightSquareStyle: { backgroundColor: '#ebecd0' },
              allowDragging: !state.isAnimating,
              squareStyles: state.boardRenderState.squares,
              arrows: state.boardRenderState.arrows,
            }}
          />
        </div>
        <button
          onClick={resetGame}
          disabled={state.isAnimating}
          style={{
            marginTop: '20px',
            padding: '12px 24px',
            backgroundColor: state.isAnimating ? '#2a2a2a' : '#d32f2f',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: state.isAnimating ? 'not-allowed' : 'pointer',
            fontWeight: 'bold',
            fontSize: '0.95rem',
            opacity: state.isAnimating ? 0.5 : 1,
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            if (!state.isAnimating) {
              e.currentTarget.style.backgroundColor = '#b71c1c';
            }
          }}
          onMouseLeave={(e) => {
            if (!state.isAnimating) {
              e.currentTarget.style.backgroundColor = '#d32f2f';
            }
          }}
        >
          🔄 Reset Board
        </button>
      </div>

      {/* RIGHT SIDE: CHAT UI */}
      <div style={{ 
        width: '450px', 
        borderLeft: '1px solid #333', 
        display: 'flex', 
        flexDirection: 'column',
        backgroundColor: '#242424'
      }}>
        
        {/* CHAT MESSAGES AREA */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          {/* PREPOPULATED PROMPT PILLS */}
          {state.messages.length === 0 && (
            <div style={{
              display: 'flex',
              gap: '8px',
              flexWrap: 'wrap',
              marginBottom: '16px'
            }}>
              {promptPills.map((pill, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    sendMessage(pill.prompt);
                  }}
                  style={{
                    padding: '8px 12px',
                    backgroundColor: '#4a4a4a',
                    color: '#fff',
                    border: '1px solid #666',
                    borderRadius: '16px',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: '500',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#5a5a5a'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#4a4a4a'}
                >
                  {pill.label}
                </button>
              ))}
            </div>
          )}
          {state.messages.length === 0 && (
            <div style={{ color: '#666', textAlign: 'center', marginTop: '20px' }}>
              Ask me about the position or the best next move!
            </div>
          )}
          {state.messages.map((m, i) => {
            const style = getMessageStyle(m);
            return (
              <div key={i}>
                {/* Message bubble */}
                <div style={{
                  alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                  backgroundColor: style.backgroundColor,
                  padding: '10px 14px',
                  borderRadius: '12px',
                  maxWidth: '85%',
                  lineHeight: '1.4',
                  fontSize: '0.95rem',
                  wordWrap: 'break-word',
                  fontStyle: style.fontStyle,
                  borderLeft: style.borderLeft
                }}>
                  <strong>{m.role === 'user' ? 'You' : 'Coach'}:</strong><br />
                  {m.text}
                </div>

                {/* NEW: Render move sequences if present */}
                {m.sequences && m.sequences.map((seq) => (
                  <MoveSequenceComponent
                    key={seq.id}
                    sequence={seq}
                    selectedChipId={selectedChipId}
                    onChipClick={handleChipClick}
                  />
                ))}
              </div>
            );
          })}
          {state.isTyping && <div style={{ color: '#aaa', fontSize: '0.8rem', paddingLeft: '5px' }}>Coach is thinking...</div>}
          {state.isAnimating && <div style={{ color: '#aaa', fontSize: '0.8rem', paddingLeft: '5px' }}>Playing moves...</div>}
          <div ref={messagesEndRef} />
        </div>

        {/* POSITION EXPLORER INDICATOR */}
        {selectedChipId && (
          <div style={{
            padding: '10px 20px',
            backgroundColor: '#2a3a4a',
            borderLeft: '3px solid #4CAF50',
            borderTop: '1px solid #333',
            fontSize: '0.85rem',
            color: '#b0c4de',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <span>
              📍 <strong>Exploring variation</strong> - Click another chip or make a move to continue
            </span>
            <button
              onClick={() => setSelectedChipId(null)}
              style={{
                padding: '4px 10px',
                backgroundColor: '#3a4a5a',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.75rem',
                fontWeight: '500',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4a5a6a'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#3a4a5a'}
            >
              Clear Selection
            </button>
          </div>
        )}

        {/* CHAT INPUT AREA */}
        <div style={{
          padding: '20px',
          borderTop: '1px solid #333',
          backgroundColor: '#1a1a1a'
        }}>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '6px',
                border: '1px solid #444',
                backgroundColor: '#333',
                color: 'white',
                outline: 'none',
                opacity: state.isAnimating ? 0.5 : 1
              }}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !state.isAnimating && sendMessage()}
              placeholder={state.isAnimating ? "Wait for moves to finish..." : "Ask the coach..."}
              disabled={state.isAnimating}
            />
            <button
              onClick={() => sendMessage()}
              disabled={state.isAnimating}
              style={{
                padding: '10px 16px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: state.isAnimating ? '#555' : '#007bff',
                color: 'white',
                cursor: state.isAnimating ? 'not-allowed' : 'pointer',
                fontWeight: 'bold',
                opacity: state.isAnimating ? 0.5 : 1
              }}
            >
              Send
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

export default App;