# Move Sequence Chips - Quick Testing Guide

## Prerequisites

```bash
# Terminal 1: Start Frontend
cd frontend
npm run dev
# Open http://localhost:5173

# Terminal 2 (Optional): Start Backend for Live API
cd backend
python main.py
# Runs on http://localhost:8000
```

---

## Test 1: Basic Chip Rendering

**Steps:**
1. Click "Mock Data ON" button (should turn green)
2. Type: `Multiple Sequences Test`
3. Press Send

**Expected Result:**
```
Coach: Here are two strategic approaches for White:

┌─────────────────────────────────────────┐
│ Aggressive: King's Gambit               │
│ [1. e4] [e5] [2. f4]                   │
│   ⬜️    ⬛️    ⬜️                        │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ Solid: Italian Game                     │
│ [1. e4] [e5] [2. Nf3] [Nc6] [3. Bc4]  │
│   ⬜️    ⬛️    ⬜️      ⬛️      ⬜️       │
└─────────────────────────────────────────┘
```

**Verify:**
- ✅ Two sequence boxes appear below message
- ✅ Labels display correctly
- ✅ White chips have white background
- ✅ Black chips have black background
- ✅ Chips have monospace font

---

## Test 2: Chip Click Navigation

**Steps:**
1. From Test 1, click on "[1. e4]" chip (first white chip)
2. Observe board
3. Click on "[e5]" chip (first black chip)
4. Observe board

**Expected Result:**
- After clicking "1. e4":
  - ✅ Board shows position after 1. e4 (white pawn on e4)
  - ✅ Chip has green border
  - ✅ Chip text is bold

- After clicking "e5":
  - ✅ Board shows position after 1. e4 e5 (pawns on e4 and e5)
  - ✅ "1. e4" chip loses green border
  - ✅ "e5" chip gains green border
  - ✅ "e5" chip text is bold

---

## Test 3: Chip Hover Effects

**Steps:**
1. Hover mouse over any chip (don't click)
2. Move mouse away

**Expected Result:**
- ✅ On hover: Chip lifts up slightly (translateY)
- ✅ On hover: Shadow appears under chip
- ✅ On mouse leave: Chip returns to normal position
- ✅ On mouse leave: Shadow disappears

---

## Test 4: Multiple Sequences

**Steps:**
1. Refresh page (or reset board)
2. Enable Mock Data
3. Type: `Show me opening plans`
4. Press Send

**Expected Result:**
```
Coach: Here are three classical opening approaches for White:

┌─────────────────────────────────────────────────────┐
│ King's Pawn Opening: Central Control                │
│ [1. e4] [e5] [2. Nf3] [Nc6] [3. Bb5]              │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ Queen's Pawn Opening: Solid Development             │
│ [1. d4] [Nf6] [2. c4] [e6] [3. Nc3] [Bb4]         │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ English Opening: Flexible System                     │
│ [1. c4] [e5] [2. Nc3] [Nf6] [3. g3]               │
└─────────────────────────────────────────────────────┘
```

**Verify:**
- ✅ Three sequences appear
- ✅ Each has distinct label
- ✅ Move notation correct (move numbers for white, plain SAN for black)
- ✅ Can click chips in any sequence
- ✅ Clicking chip in different sequence updates board correctly

---

## Test 5: Sequence Persistence

**Steps:**
1. Send "Multiple Sequences Test"
2. Click chip "[2. Nf3]" in Italian Game
3. Send "Show me opening plans"
4. Scroll up to see first sequences
5. Click chip "[2. f4]" in King's Gambit
6. Scroll down to new sequences
7. Click chip "[3. Nc3]" in Queen's Pawn Opening

**Expected Result:**
- ✅ Old sequences remain visible after new message
- ✅ Can scroll between all sequences
- ✅ Clicking chip in old sequence works
- ✅ Clicking chip in new sequence works
- ✅ Only one chip highlighted at a time (across all sequences)

---

## Test 6: Manual Moves After Chip Click

**Steps:**
1. Click chip "[1. e4]"
2. Board shows starting position with e4
3. Drag black knight from g8 to f6
4. Observe result

**Expected Result:**
- ✅ Manual move executes successfully
- ✅ Board updates to show knight on f6
- ✅ Can continue making moves normally
- ✅ Sequences remain in chat (not affected by manual moves)

---

## Test 7: Chip Click During Animation

**Steps:**
1. Switch to old action-based test
2. Type: `London System` (triggers sequential moves)
3. While moves are playing, try clicking a chip

**Expected Result:**
- ✅ If chips are from an old message, they might be clickable
- ✅ Board updates correctly after animation finishes
- OR
- ✅ Chip clicks are prevented during animation (depending on implementation)

**Note:** Current implementation doesn't disable chips during animation, so this is "best effort" behavior.

---

## Test 8: Backward Compatibility

**Steps:**
1. Enable Mock Data
2. Type: `What's the plan for White here?`
3. Press Send

**Expected Result:**
- ✅ Old action-based response works
- ✅ Arrows and highlights appear
- ✅ No sequences (this scenario uses old format)
- ✅ No errors in console

**Then:**
4. Type: `Multiple Sequences Test`
5. Press Send

**Expected Result:**
- ✅ New sequence-based response works
- ✅ Both old and new formats work in same session

---

## Test 9: Edge Cases

### 9.1 Empty Chat
**Steps:** Fresh page load
**Expected:** No sequences shown, welcome message visible

### 9.2 Very Long Sequence
**Steps:** Create mock with 15+ moves
**Expected:** Chips wrap to new line, all clickable

### 9.3 Rapid Chip Clicking
**Steps:** Click 5 different chips rapidly in succession
**Expected:** Board updates to last clicked chip position, no errors

### 9.4 Reset Board After Chip Click
**Steps:**
1. Click chip
2. Click "Reset Board" button
**Expected:**
- ✅ Board resets to starting position
- ✅ Chip highlighting clears
- ✅ Sequences remain in chat

---

## Console Log Verification

Open browser DevTools (F12) and check Console tab while testing.

**Expected Logs:**

After clicking chip:
```
[Chip Click] Loaded position: 1. e4 -> rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1
```

After sending message with sequences:
```
[sendMessage] Received data: { explanation: "...", sequences: [...] }
[sendMessage] Processed sequences: [{ id: "seq-0", label: "...", chips: [...] }]
```

**No Errors Expected:**
- ❌ No TypeScript errors
- ❌ No "undefined" chip IDs
- ❌ No FEN parsing errors
- ❌ No React rendering errors

---

## Visual Inspection Checklist

### Chip Appearance
- [ ] Monospace font (looks like chess notation)
- [ ] Correct spacing between chips (4px gap)
- [ ] Rounded corners (6px radius)
- [ ] Proper padding (6px vertical, 12px horizontal)
- [ ] White chips: white bg, black text
- [ ] Black chips: black bg (#333), white text
- [ ] Border visible (1px #666 or 2px green when selected)

### Sequence Box Appearance
- [ ] Gray background (#2a2a2a)
- [ ] Green left border (3px solid #4CAF50)
- [ ] Rounded corners (8px)
- [ ] Label text light gray (#aaa), smaller font (0.85rem)
- [ ] Proper margin above box (12px)

### Interactive Feedback
- [ ] Hover: chip lifts and shows shadow
- [ ] Click: green border appears, text becomes bold
- [ ] Smooth transitions (0.2s)
- [ ] Cursor changes to pointer on hover

---

## Performance Check

Test with multiple sequences over several messages:

1. Send 5 different sequence-based queries
2. Scroll through chat with 15+ sequences
3. Click chips from different messages

**Expected:**
- ✅ No lag when scrolling
- ✅ Chip clicks respond instantly
- ✅ Board updates without delay
- ✅ Memory usage reasonable (check DevTools Performance tab)

---

## Success Criteria Summary

All tests should pass with:
- ✅ No console errors
- ✅ Correct visual appearance
- ✅ Smooth interactions
- ✅ Backward compatibility maintained
- ✅ Board state always matches selected chip
- ✅ Sequences persist in chat history

---

## Troubleshooting

### Chips Don't Appear
- Check: Mock Data is enabled
- Check: Exact scenario name typed correctly
- Check: Console for errors
- Check: responses.json has sequences field

### Chips Don't Highlight
- Check: selectedChipId state updating (React DevTools)
- Check: onClick handler firing (add console.log)
- Check: Chip ID matching logic

### Board Doesn't Update
- Check: gameRef.current.load() executing
- Check: FEN string is valid
- Check: PROCESS_ACTION dispatching

### Multiple Chips Highlighted
- Check: Only one chip should have matching selectedChipId
- Check: Previous chip ID clearing on new click

---

## Reporting Issues

If tests fail, collect:
1. Console error messages
2. Screenshot of unexpected behavior
3. Steps to reproduce
4. Browser/OS information
5. Which test failed

This helps diagnose issues quickly.
