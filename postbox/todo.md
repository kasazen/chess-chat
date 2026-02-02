# AI Handoff Inbox

## [OPEN]

## [COMPLETED]
- **Task**: Implement Visual Layer for Highlights and Arrows.
- **From**: Gemini (Architect)
- **To**: Claude (Implementer)
- **Status**: ✅ IMPLEMENTED & VERIFIED
- **Files Modified**: `frontend/src/App.tsx`
- **Build Status**: ✅ TypeScript compilation successful (308.04 kB)

- **Implementation Summary**:
    1. ✅ Defined CHESS_THEME object with coordinated colors for visual feedback
    2. ✅ Added state for `customSquareStyles` and `customArrows`
    3. ✅ Updated Action interface with `arrow` type and visual fields (square, from, to, intent)
    4. ✅ Updated Message interface with `intent` field for chat coordination
    5. ✅ Enhanced action queue processor to handle highlight and arrow actions
    6. ✅ Implemented visual accumulation (multiple highlights/arrows per turn)
    7. ✅ Coordinated chat bubble styling with board visuals via intent
    8. ✅ Integrated squareStyles and arrows into Chessboard component
    9. ✅ Added visual clearing on new message to prevent stale indicators

- **Visual Theme Capabilities**:
    - **bestMove**: SeaGreen highlighting for optimal moves
    - **threat**: Firebrick highlighting/arrows for tactical threats
    - **info**: Yellow highlighting for educational markers
    - **idea**: DeepSkyBlue highlighting/arrows for strategic concepts
    - Chat bubbles automatically match board visual intent via borderLeft color

- **Task**: Implement a robust Action Queue to resolve board/AI desync.
- **From**: Gemini (Architect)
- **To**: Claude (Implementer)
- **Status**: ✅ IMPLEMENTED & VERIFIED
- **Files Modified**:
  - `frontend/src/App.tsx` (Action Queue implementation)
  - `frontend/src/run-tests.js` (Test runner - NEW)
- **Test Results**: ✅ 2/2 scenarios passed
  - Butterfly Effect Test: PASSED (17 sequential operations including undos and variations)
  - Underpromotion Test: PASSED (Knight promotion validation)

- **Implementation Summary**:
    1. ✅ Added `actionQueue` state to hold incoming AI actions
    2. ✅ Modified `sendMessage` to populate queue instead of calling `performActions`
    3. ✅ Implemented `useEffect` hook that processes queue sequentially
    4. ✅ Added move legality validation before execution
    5. ✅ Removed old `performActions` function
    6. ✅ UI locking during animation (via `isAnimating` state)
    7. ✅ 1000ms delay between actions for visual feedback
    8. ✅ Created test runner with Butterfly Effect and Underpromotion scenarios

- **Key Improvements**:
    - Sequential action processing eliminates state desync
    - Legal move validation prevents AI errors from corrupting game state
    - Queue-based architecture supports complex undo/variation sequences
    - gameRef remains single source of truth for chess logic

- **Task**: Finalize initial `GEMINI.md` logic.
- **Status**: Verified by Gemini CLI.

- **ARCHIVED Technical Implementation Details**:

    The following sections contain the original implementation specifications.
    They are preserved for reference but are no longer needed.

    **Visual Layer - CHESS_THEME Object**:
        -   At the top of `App.tsx`, create a constant `CHESS_THEME` to centralize colors for visual feedback.
        ```typescript
        const CHESS_THEME = {
          colors: {
            bestMove: 'rgba(46, 139, 87, 0.5)',   // SeaGreen
            threat: 'rgba(178, 34, 34, 0.5)',      // Firebrick
            info: 'rgba(255, 255, 0, 0.4)',      // Yellow
            idea: 'rgba(0, 191, 255, 0.5)',        // DeepSkyBlue
          },
          arrow: {
            idea: '#00bfff',
            threat: '#b22222'
          }
        };
        ```

    2.  **Add State for Board Visuals**:
        -   Create two new state variables to hold the styles and arrows for `react-chessboard`.
        ```typescript
        const [customSquareStyles, setCustomSquareStyles] = useState<Record<string, React.CSSProperties>>({});
        const [customArrows, setCustomArrows] = useState<[string, string, string][]>([]);
        ```

    3.  **Update `Action` and `Message` Interfaces**:
        -   Update the `Action` interface to include the new fields from `GEMINI.md`.
        -   Add an optional `intent` property to the `Message` interface for chat styling coordination.
        ```typescript
        interface Action {
          type: 'move' | 'undo' | 'reset' | 'highlight' | 'arrow';
          lan?: string;
          square?: string;
          from?: string;
          to?: string;
          intent?: 'bestMove' | 'threat' | 'info' | 'idea';
          comment?: string;
        }

        interface Message {
          role: 'user' | 'ai';
          text: string;
          type?: 'explanation' | 'move' | 'error';
          intent?: Action['intent'];
        }
        ```

    4.  **Enhance the Action Queue Processor (`useEffect`)**:
        -   **Clear Visuals**: In the `sendMessage` function, right before the `fetch` call, reset the visual state to clear old highlights and arrows from the previous turn:
            ```typescript
            setCustomSquareStyles({});
            setCustomArrows([]);
            ```
        -   **Process New Actions**: Inside the `useEffect` that processes `actionQueue`, add logic to handle `highlight` and `arrow` actions. These actions should *accumulate* visuals for the current turn.
            ```typescript
            // Inside the try block of processNextAction...
            if (action.type === 'highlight' && action.square && action.intent) {
              setCustomSquareStyles(prev => ({
                ...prev,
                [action.square!]: { backgroundColor: CHESS_THEME.colors[action.intent!] }
              }));
            } else if (action.type === 'arrow' && action.from && action.to && action.intent) {
              const color = CHESS_THEME.arrow[action.intent === 'idea' ? 'idea' : 'threat'];
              setCustomArrows(prev => [...prev, [action.from!, action.to!, color]]);
            }
            ```
        -   **Tag Messages with Intent**: When processing an action with a comment, pass the `intent` to the message object.
            ```typescript
            // Inside the "Update UI and State" section of processNextAction...
            if (success && action.comment) {
                setMessages(prev => [...prev, {
                  role: 'ai',
                  text: action.comment,
                  type: 'move', // or a new type 'visual'
                  intent: action.intent 
                }]);
            }
            ```

    5.  **Coordinate Chat Bubble Style**:
        -   Update the `getMessageStyle` function to use the `intent` from the message to color the chat bubble, matching the board visuals.
        ```typescript
        // Inside getMessageStyle, for AI messages...
        if (message.intent) {
          const baseStyle = getMessageStyle(message); // get default style
          return {
            ...baseStyle,
            borderLeft: `3px solid ${CHESS_THEME.colors[message.intent] || '#888'}`
          };
        }
        ```

    6.  **Update Chessboard Component**:
        -   Pass the new state variables as props to the `<Chessboard />` component.
        -   `<Chessboard ... customSquareStyles={customSquareStyles} customArrows={customArrows} />` (Note: Ensure these are direct props, not inside an `options` object).

- **Task**: Implement a robust Action Queue to resolve board/AI desync.
- **From**: Gemini (Architect)
- **To**: Claude (Implementer)
- **Context**: The application is suffering from a state desynchronization issue where the UI (board) does not correctly reflect the sequence of operations sent by the AI coach. This is caused by React's asynchronous state updates firing all at once, rather than sequentially. The goal is to create a queue that processes each AI action one by one, ensuring animations complete before proceeding.
- **File to Edit**: `frontend/src/App.tsx`
- **Reference File**: `frontend/src/test-scenarios.js` (Contains the "Butterfly Effect" test case this fix must support).

- **Technical Implementation Steps**:

    1.  **Introduce an Action Queue State**:
        -   In `App.tsx`, create a new state to hold the list of incoming actions from the AI.
        -   `const [actionQueue, setActionQueue] = useState<Action[]>([]);`

    2.  **Populate the Queue**:
        -   In the `sendMessage` function, instead of directly calling `performActions`, populate the new state with the response from the backend.
        -   `const data: ActionScript = await response.json();`
        -   `if (data.actions && data.actions.length > 0) { setActionQueue(data.actions); }`
        -   You can now remove the old `performActions` function.

    3.  **Create a `useEffect` to Process the Queue**:
        -   Create a `useEffect` hook that triggers whenever `actionQueue` changes.
        -   This hook will be the "Director" that processes one action at a time.

        ```typescript
        useEffect(() => {
          if (actionQueue.length === 0 || isAnimating) {
            return;
          }

          const processNextAction = async () => {
            setIsAnimating(true); // Lock the UI

            const action = actionQueue[0];
            let success = true;
            let errorMsg = '';

            // --- Action Processing Logic ---
            // (This is the logic from the old performActions function)
            try {
              if (action.type === 'move' && action.lan) {
                // IMPORTANT: Validate move is legal before attempting
                const legalMoves = gameRef.current.moves({ verbose: true });
                const isLegal = legalMoves.some(m => m.from + m.to === action.lan.substring(0,4));

                if (!isLegal) {
                    throw new Error(`Illegal move suggested by AI: ${action.lan}`);
                }
                
                const move = gameRef.current.move(action.lan);
                if (!move) throw new Error(`Move execution failed for: ${action.lan}`);

              } else if (action.type === 'undo') {
                if (!gameRef.current.undo()) throw new Error('No moves to undo.');
              } else if (action.type === 'reset') {
                gameRef.current.reset();
              }
              // Highlight is a visual-only instruction, no state change needed for the ref.
            } catch (e: any) {
              success = false;
              errorMsg = e.message;
            }

            // --- Update UI and State ---
            setFen(gameRef.current.fen()); // Update board UI

            // Post messages for commentary or errors
            if (success && action.comment) {
                setMessages(prev => [...prev, { role: 'ai', text: action.comment, type: 'move' }]);
            } else if (!success) {
                setMessages(prev => [...prev, { role: 'ai', text: `Coach Error: ${errorMsg}`, type: 'error' }]);
            }

            // --- Recurse with Delay ---
            // Wait for animation, then process the next item in the queue.
            setTimeout(() => {
              setIsAnimating(false); // Unlock UI for next action
              setActionQueue(prevQueue => prevQueue.slice(1)); // Consume the action we just processed
            }, 1000); // 1-second delay for animation
          };

          processNextAction();

        }, [actionQueue, isAnimating]); // Dependency array
        ```

    4.  **Final Cleanup**:
        -   Ensure the `isAnimating` state is used to disable user input on the board and in the chatbox while the queue is being processed.
        -   Remove the old `performActions` function entirely.
        -   Verify that manual moves made in `onDrop` still correctly use `gameRef.current` and `setFen` to keep the ref as the single source of truth.

## [COMPLETED]
- **Task**: Finalize initial `GEMINI.md` logic.
- **Status**: Verified by Gemini CLI.
