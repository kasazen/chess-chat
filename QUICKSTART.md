# Chess Chat - Quick Start Guide

## 🚀 Start the Application

### Terminal 1: Backend
```bash
cd backend
source venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Expected output:
```
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     Started reloader process [xxxxx] using StatReload
INFO:     Started server process [xxxxx]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
```

### Terminal 2: Frontend
```bash
cd frontend
npm run dev
```

Expected output:
```
  VITE v7.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
  ➜  press h + enter to show help
```

### Open Browser
Navigate to: **http://localhost:5173**

---

## 🧪 Test the Backend Manually

```bash
curl -X POST http://localhost:8000/ask \
  -H "Content-Type: application/json" \
  -d '{
    "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    "message": "What is the best opening move?"
  }'
```

---

## 🛠️ Troubleshooting

### Backend won't start
1. Check Python version: `python --version` (need 3.9+)
2. Verify virtual environment is activated: `which python` should show path with `venv`
3. Check Stockfish: `which stockfish` should return `/usr/local/bin/stockfish`
4. Verify API key: `cat backend/.env` should show GEMINI_API_KEY

### Frontend won't start
1. Check Node version: `node --version` (need 18+)
2. Reinstall dependencies: `cd frontend && npm install`

### "Coach connection failed" error
1. Verify backend is running on port 8000: `lsof -ti:8000`
2. Test backend directly with curl (see above)
3. Check browser console for CORS errors

### Gemini API errors
- Verify your API key is valid
- Check you're using a 2026-compatible model (gemini-flash-latest)
- Ensure you have API credits/quota remaining

---

## 📝 Environment Variables

Create `backend/.env` with:
```env
GEMINI_API_KEY=your_actual_api_key_here
STOCKFISH_PATH=/usr/local/bin/stockfish
```

---

## 🎯 Usage Tips

1. **Move pieces** by dragging them on the board
2. **Ask questions** like:
   - "What should I play next?"
   - "Is this position good for white or black?"
   - "Should I castle now?"
   - "What's the best move?"
3. **Reset game** with the "New Game" button
4. **View coaching advice** in the chat panel on the right

---

## 🔧 Development Commands

### Backend
```bash
# Install dependencies
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Run server
uvicorn main:app --reload

# Test Stockfish separately
python test_engine.py
```

### Frontend
```bash
# Install dependencies
cd frontend
npm install

# Run dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint
npm run lint
```

---

## 📦 Project Structure

```
chess-chat/
├── backend/
│   ├── .env              # Environment variables
│   ├── main.py           # FastAPI application
│   ├── requirements.txt  # Python dependencies
│   ├── test_engine.py    # Stockfish test script
│   └── venv/             # Python virtual environment
│
├── frontend/
│   ├── src/
│   │   └── App.tsx       # Main React component
│   ├── package.json      # Node dependencies
│   ├── vite.config.ts    # Vite configuration
│   └── node_modules/     # Installed packages
│
├── SYSTEM_AUDIT.md       # Full audit report
└── QUICKSTART.md         # This file
```

---

## 🌐 Ports Used

- **Backend:** http://localhost:8000
- **Frontend:** http://localhost:5173

To stop the servers, press **Ctrl+C** in each terminal.
