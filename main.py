import io, cv2, json
import numpy as np
from PIL import Image
import tensorflow as tf
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, File, UploadFile
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="FallGuard AI")

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
app.mount("/static", StaticFiles(directory="static"), name="static")

print("Loading model...")
model = tf.keras.models.load_model("fall_model.h5")
IMG_SIZE = (224, 224)
print("✅ Model ready")

def run_inference(image_bytes):
    img  = Image.open(io.BytesIO(image_bytes)).convert("RGB").resize(IMG_SIZE)
    arr  = np.expand_dims(np.array(img) / 255.0, 0).astype("float32")
    prob = float(model.predict(arr, verbose=0)[0][0])
    label = "non_fall" if prob > 0.5 else "fall"
    conf  = prob if prob > 0.5 else 1 - prob
    return label, round(conf * 100, 2)

@app.get("/")
def index(): return FileResponse("static/index.html")

@app.get("/health")
def health(): return {"status": "ok", "model": "MobileNetV2"}

@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    try:
        label, conf = run_inference(await file.read())
        return JSONResponse({"label": label, "confidence": conf,
                             "alert": label == "fall",
                             "message": "⚠️ Fall Detected!" if label == "fall" else "✅ Safe"})
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

@app.websocket("/ws")
async def websocket(ws: WebSocket):
    await ws.accept()
    try:
        while True:
            data  = await ws.receive_bytes()
            nparr = np.frombuffer(data, np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if frame is None: continue
            _, buf = cv2.imencode(".jpg", frame)
            label, conf = run_inference(buf.tobytes())
            await ws.send_json({"label": label, "confidence": conf, "alert": label == "fall"})
    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"WS error: {e}")