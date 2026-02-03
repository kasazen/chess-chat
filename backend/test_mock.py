#!/usr/bin/env python3
import os
import sys
import json

# Set mock mode
os.environ['USE_MOCKS'] = 'true'

# Import the app
from main import app, ActionScript
from fastapi.testclient import TestClient

client = TestClient(app)

# Test the mock endpoint
response = client.post("/ask", json={
    "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    "message": "Jobava London",
    "history": []
})

print("Status:", response.status_code)
print("Response:", json.dumps(response.json(), indent=2))

# Verify it's using mocks
data = response.json()
assert "Jobava London System" in data["explanation"], "Mock not used!"
assert len(data["actions"]) == 5, f"Expected 5 actions, got {len(data['actions'])}"

print("\n✅ Mock backend works correctly!")
