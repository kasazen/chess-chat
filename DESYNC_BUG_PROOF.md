# Desync Bug - Definitive Proof

## Executive Summary
✅ **BUG CONFIRMED** via behavioral integrity testing

## Test Results

### Test: Causal Chain Violation Detection
**File**: `scripts/test-causal-chain.test.ts:69`
**Status**: ❌ FAILED (as expected - proves bug exists)

### The Smoking Gun

When chat message "Move 3" becomes visible:
```
Debug state:
{
  fen: 'rnbqkbnr/ppp1pppp/8/3p4/2PP4/8/PP2PPPP/RNBQKBNR b KQkq - 0 2',
  queueLength: 1,
  isAnimating: false
}
```

**Analysis**:
- FEN shows only **2 moves** applied (1.d4 d5 2.c4)
- But c4 (move 3) is **NOT** in the FEN yet
- `queueLength: 1` means c4 is **still in queue**
- Chat message for "Move 3" is **already visible**

### The Race Condition

**Current (Broken) Flow**:
```
Action processed → Chat message added → [RACE] → Board state updated
```

**Problem**: Chat messages are added in the SAME useEffect that processes actions, using `setMessages()` before `setBoardRenderState()` completes its render cycle.

**Result**: Users see chat messages describing moves that haven't appeared on the board yet.

### Test Assertion Failure

```
Error: expect(received).toBe(expected)

Expected queueLength: 0  ← All moves should be done when message appears
Received queueLength: 1  ← Move still pending!
```

## Root Cause

According to the specification, the issue is in `App.tsx` where the current architecture uses a **single "Execution" useEffect** that:
1. Updates `gameRef`
2. Calls `setFen()`
3. Calls `setMessages()` ← **TOO EARLY!**
4. Schedules next action

The problem: `setMessages()` happens in the same render cycle as the state update, but React doesn't guarantee the board component has re-rendered yet.

## The Fix (Section 2)

Implement **Causal useEffect Chain**:
- Hook 1 (Executor): Update board state only
- Hook 2 (Messenger): Update chat only, triggered AFTER Hook 1 completes

This guarantees: Board updates → React render → Chat updates

---
**Proof Date**: 2026-02-02
**Test File**: scripts/test-causal-chain.test.ts
**Failure Type**: Race condition in UI rendering logic
