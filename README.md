# FallGuard AI

Vision-based elderly fall detection system using MobileNetV2.

## Run locally
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
# Put fall_model.h5 in root folder
uvicorn main:app --reload --port 8000
```

## Deploy to Render
1. Push to GitHub
2. Go to render.com → New Web Service
3. Connect your repo
4. Build: `pip install -r requirements.txt`
5. Start: `uvicorn main:app --host 0.0.0.0 --port $PORT`
6. Upload fall_model.h5 via Render dashboard → Environment → Secret Files
