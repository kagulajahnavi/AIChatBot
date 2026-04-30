from flask import Flask, request, jsonify, send_from_directory, Response
from flask_cors import CORS
import PyPDF2
import requests
import urllib3
import sqlite3
import os
import logging
import json
from datetime import datetime
import os
from dotenv import load_dotenv

# Load the variables from the .env file
load_dotenv()

# Access the key using os.getenv
API_KEY = os.getenv("GROQ_API_KEY")
# Hide harmless 404 browser extension logs from terminal
log = logging.getLogger('werkzeug')
log.setLevel(logging.ERROR)

# Suppress insecure request warnings for your campus Wi-Fi
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

app = Flask(__name__)
CORS(app)


API_URL = "https://api.groq.com/openai/v1/chat/completions"
DB_NAME = "chat_history.db"

# --- DATABASE SETUP ---
def init_db():
    with sqlite3.connect(DB_NAME) as conn:
        c = conn.cursor()
        c.execute('''CREATE TABLE IF NOT EXISTS sessions (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)''')
        c.execute('''CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, session_id INTEGER, role TEXT, content TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(session_id) REFERENCES sessions(id))''')
        conn.commit()

init_db()

# --- FRONTEND ROUTES ---
@app.route('/')
def home():
    return send_from_directory('.', 'index.html')

@app.route('/<path:filename>')
def serve_static(filename):
    return send_from_directory('.', filename)

# --- API ROUTES ---
@app.route('/sessions', methods=['GET'])
def get_sessions():
    with sqlite3.connect(DB_NAME) as conn:
        conn.row_factory = sqlite3.Row
        sessions = conn.execute("SELECT * FROM sessions ORDER BY created_at DESC").fetchall()
        return jsonify([dict(s) for s in sessions])

@app.route('/sessions', methods=['POST'])
def create_session():
    title = request.json.get("title", "New Chat")
    with sqlite3.connect(DB_NAME) as conn:
        cursor = conn.cursor()
        cursor.execute("INSERT INTO sessions (title) VALUES (?)", (title,))
        conn.commit()
        return jsonify({"id": cursor.lastrowid, "title": title})

@app.route('/sessions/<int:session_id>/messages', methods=['GET'])
def get_messages(session_id):
    with sqlite3.connect(DB_NAME) as conn:
        conn.row_factory = sqlite3.Row
        messages = conn.execute("SELECT role, content FROM messages WHERE session_id = ? ORDER BY id ASC", (session_id,)).fetchall()
        return jsonify([dict(m) for m in messages])

@app.route('/sessions/<int:session_id>', methods=['DELETE'])
def delete_session(session_id):
    try:
        with sqlite3.connect(DB_NAME) as conn:
            conn.execute("DELETE FROM messages WHERE session_id = ?", (session_id,))
            conn.execute("DELETE FROM sessions WHERE id = ?", (session_id,))
            conn.commit()
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/upload', methods=['POST'])
def upload_pdf():
    if 'file' not in request.files: 
        return jsonify({"error": "No file provided"}), 400
    
    file = request.files['file']
    if file and file.filename.lower().endswith('.pdf'):
        try:
            reader = PyPDF2.PdfReader(file)
            text = ""
            for page in reader.pages:
                extracted = page.extract_text()
                if extracted:
                    text += extracted + "\n"
            
            if not text.strip():
                return jsonify({"error": "Could not extract any text. Is this a scanned PDF or an image?"}), 400
                
            return jsonify({"text": text, "filename": file.filename})
        except Exception as e:
            return jsonify({"error": f"Failed to parse PDF: {str(e)}"}), 500
            
    return jsonify({"error": "Invalid format. Upload a PDF."}), 400

@app.route('/chat', methods=['POST'])
def chat():
    data = request.json
    user_message = data.get("message")
    pdf_context = data.get("pdf_context", "")
    session_id = data.get("session_id")
    thinking_enabled = data.get("thinking_enabled", False)

    if not session_id:
        return jsonify({"error": "No session ID provided"}), 400

    # Save user message
    with sqlite3.connect(DB_NAME) as conn:
        conn.execute("INSERT INTO messages (session_id, role, content) VALUES (?, ?, ?)", (session_id, 'user', user_message))
        
        # Auto-title logic
        count = conn.execute("SELECT COUNT(*) FROM messages WHERE session_id = ?", (session_id,)).fetchone()[0]
        if count <= 2:
            new_title = user_message[:25] + "..." if len(user_message) > 25 else user_message
            conn.execute("UPDATE sessions SET title = ? WHERE id = ?", (new_title, session_id))
        conn.commit()

    # Get history
    with sqlite3.connect(DB_NAME) as conn:
        history = conn.execute("SELECT role, content FROM messages WHERE session_id = ? ORDER BY id ASC LIMIT 10", (session_id,)).fetchall()
        messages = [{"role": row[0], "content": row[1]} for row in history]

    if thinking_enabled:
        system_prompt = "You are an elite software engineering AI. You MUST provide your internal reasoning under the header '### THOUGHT PROCESS', followed by your final answer under '### FINAL ANSWER'. Use markdown."
    else:
        system_prompt = "You are an elite, professional software engineering AI assistant. Provide direct, highly accurate Markdown answers. Do not show your thought process."
    
    if pdf_context:
        system_prompt += f"\n\nContext from document:\n{pdf_context}"

    messages.insert(0, {"role": "system", "content": system_prompt})

    # --- THE STREAMING LOGIC ---
    def generate_stream():
        headers = {"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"}
        payload = {
            "model": "llama-3.1-8b-instant",
            "messages": messages,
            "temperature": 0.5,
            "stream": True # <--- Enable API Streaming
        }

        full_response = ""
        try:
            # We must use requests with stream=True
            with requests.post(API_URL, headers=headers, json=payload, verify=False, stream=True) as response:
                response.raise_for_status()
                for line in response.iter_lines():
                    if line:
                        line = line.decode('utf-8')
                        if line.startswith('data: ') and line != 'data: [DONE]':
                            try:
                                json_data = json.loads(line[6:]) # strip 'data: '
                                chunk = json_data['choices'][0]['delta'].get('content', '')
                                if chunk:
                                    full_response += chunk
                                    # Yield the chunk to the frontend formatted as Server-Sent Events
                                    yield f"data: {json.dumps({'chunk': chunk})}\n\n"
                            except Exception as e:
                                pass
                
            # Once the stream finishes, save the final string to the database
            if full_response:
                with sqlite3.connect(DB_NAME) as conn:
                    conn.execute("INSERT INTO messages (session_id, role, content) VALUES (?, ?, ?)", (session_id, 'assistant', full_response))
                    conn.commit()
                    
        except requests.exceptions.RequestException as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    # Return a Flask Response object configured for streaming
    return Response(generate_stream(), mimetype='text/event-stream')

if __name__ == '__main__':
    app.run(debug=True, port=5000)