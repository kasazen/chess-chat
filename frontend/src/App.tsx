import { useState, useRef, useEffect } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';

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
}

interface Action {
  type: 'move' | 'undo' | 'reset' | 'highlight' | 'arrow';
  lan?: string;
  square?: string;
  from?: string;
  to?: string;
  intent?: 'bestMove' | 'threat' | 'info' | 'idea';
  comment?: string;
}

interface ActionScript {
  explanation: string;
  actions: Action[];
}

function App() {
  const gameRef = useRef(new Chess());
  const [fen, setFen] = useState(gameRef.current.fen());
  const [boardOrientation] = useState<'white' | 'black'>('white');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [actionQueue, setActionQueue] = useState<Action[]>([]);
  const [customSquareStyles, setCustomSquareStyles] = useState<Record<string, React.CSSProperties>>({});
  const [customArrows, setCustomArrows] = useState<Array<{ startSquare: string; endSquare: string; color: string }>>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
  function onDrop({ sourceSquare, targetSquare }: { sourceSquare: string; targetSquare: string | null }): boolean {
    if (isAnimating || !targetSquare) return false;

    try {
      const move = gameRef.current.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: 'q',
      });

      if (!move) return false;

      // Sync UI state with ref
      setFen(gameRef.current.fen());
      return true;
    } catch (e) {
      return false;
    }
  }

  // 2. Clear Board / New Game
  function resetGame() {
    gameRef.current = new Chess();
    setFen(gameRef.current.fen());
    setMessages([]);
  }

  // 3. Handle sending a message to the Backend
  async function sendMessage() {
    if (!input.trim() || isAnimating) return;

    const userMsg: Message = { role: 'user', text: input };
    setMessages((prev) => [...prev, userMsg]);
    const currentInput = input;
    const currentFen = gameRef.current.fen();
    const moveHistory = gameRef.current.history();

    setInput('');
    setIsTyping(true);

    // Clear previous visual indicators
    setCustomSquareStyles({});
    setCustomArrows([]);

    try {
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

      const data: ActionScript = await response.json();

      // Validate response structure
      if (!data.explanation || !data.actions) {
        throw new Error('Invalid response format from backend');
      }

      // Show the explanation first
      setMessages((prev) => [...prev, {
        role: 'ai',
        text: data.explanation,
        type: 'explanation'
      }]);

      setIsTyping(false);

      // Populate the action queue (the useEffect will process them)
      if (data.actions && data.actions.length > 0) {
        setActionQueue(data.actions);
      }

    } catch (error) {
      console.error("Connection Error:", error);
      setMessages((prev) => [...prev, {
        role: 'ai',
        text: "I'm having trouble connecting to my brain. Please check if the backend server is running and your API key is correct.",
        type: 'error'
      }]);
      setIsTyping(false);
    }
  }

  // 4. Action Queue Processor (useEffect-based)
  useEffect(() => {
    if (actionQueue.length === 0 || isAnimating) {
      return;
    }

    const processNextAction = async () => {
      setIsAnimating(true);

      const action = actionQueue[0];
      let success = true;
      let errorMsg = '';

      try {
        if (action.type === 'move' && action.lan) {
          // Validate move is legal before attempting
          const legalMoves = gameRef.current.moves({ verbose: true });
          const isLegal = legalMoves.some(m => m.from + m.to === action.lan?.substring(0, 4));

          if (!isLegal) {
            throw new Error(`Illegal move suggested by AI: ${action.lan}`);
          }

          const move = gameRef.current.move({
            from: action.lan.substring(0, 2),
            to: action.lan.substring(2, 4),
            promotion: (action.lan.length > 4 ? action.lan[4] : 'q') as 'q' | 'r' | 'b' | 'n'
          });

          if (!move) throw new Error(`Move execution failed for: ${action.lan}`);

        } else if (action.type === 'undo') {
          if (!gameRef.current.undo()) throw new Error('No moves to undo.');
        } else if (action.type === 'reset') {
          gameRef.current.reset();
        } else if (action.type === 'highlight' && action.square && action.intent) {
          // Accumulate highlights for this turn
          setCustomSquareStyles(prev => ({
            ...prev,
            [action.square!]: { backgroundColor: CHESS_THEME.colors[action.intent!] }
          }));
        } else if (action.type === 'arrow' && action.from && action.to && action.intent) {
          // Accumulate arrows for this turn
          const color = CHESS_THEME.arrow[action.intent === 'idea' ? 'idea' : 'threat'];
          setCustomArrows(prev => [...prev, { startSquare: action.from!, endSquare: action.to!, color }]);
        }
      } catch (e: any) {
        success = false;
        errorMsg = e.message;
      }

      // Update UI state
      setFen(gameRef.current.fen());

      // Post messages for commentary or errors with intent coordination
      if (success && action.comment) {
        setMessages(prev => [...prev, {
          role: 'ai',
          text: action.comment || '',
          type: 'move',
          intent: action.intent
        }]);
      } else if (!success) {
        setMessages(prev => [...prev, { role: 'ai', text: `Coach Error: ${errorMsg}`, type: 'error' }]);
      }

      // Wait for animation, then process next action
      setTimeout(() => {
        setIsAnimating(false);
        setActionQueue(prevQueue => prevQueue.slice(1));
      }, 1000);
    };

    processNextAction();
  }, [actionQueue, isAnimating]);

  return (
    <div style={{ 
      display: 'flex', 
      height: '100vh', 
      width: '100vw', 
      backgroundColor: '#1a1a1a', 
      color: '#ffffff',
      fontFamily: 'sans-serif',
      margin: 0,
      overflow: 'hidden'
    }}>
      
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
              position: fen,
              onPieceDrop: onDrop,
              boardOrientation: boardOrientation,
              darkSquareStyle: { backgroundColor: '#779556' },
              lightSquareStyle: { backgroundColor: '#ebecd0' },
              allowDragging: !isAnimating,
              squareStyles: customSquareStyles,
              arrows: customArrows
            }}
          />
        </div>
        <button
          onClick={resetGame}
          disabled={isAnimating}
          style={{
            marginTop: '20px',
            padding: '12px 24px',
            backgroundColor: isAnimating ? '#2a2a2a' : '#d32f2f',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: isAnimating ? 'not-allowed' : 'pointer',
            fontWeight: 'bold',
            fontSize: '0.95rem',
            opacity: isAnimating ? 0.5 : 1,
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            if (!isAnimating) {
              e.currentTarget.style.backgroundColor = '#b71c1c';
            }
          }}
          onMouseLeave={(e) => {
            if (!isAnimating) {
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
          {messages.length === 0 && (
            <div style={{ color: '#666', textAlign: 'center', marginTop: '20px' }}>
              Ask me about the position or the best next move!
            </div>
          )}
          {messages.map((m, i) => {
            const style = getMessageStyle(m);
            return (
              <div key={i} style={{
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
            );
          })}
          {isTyping && <div style={{ color: '#aaa', fontSize: '0.8rem', paddingLeft: '5px' }}>Coach is thinking...</div>}
          {isAnimating && <div style={{ color: '#aaa', fontSize: '0.8rem', paddingLeft: '5px' }}>Playing moves...</div>}
          <div ref={messagesEndRef} />
        </div>

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
                opacity: isAnimating ? 0.5 : 1
              }}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !isAnimating && sendMessage()}
              placeholder={isAnimating ? "Wait for moves to finish..." : "Ask the coach..."}
              disabled={isAnimating}
            />
            <button
              onClick={sendMessage}
              disabled={isAnimating}
              style={{
                padding: '10px 16px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: isAnimating ? '#555' : '#007bff',
                color: 'white',
                cursor: isAnimating ? 'not-allowed' : 'pointer',
                fontWeight: 'bold',
                opacity: isAnimating ? 0.5 : 1
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