# 🚀 Pro AI Workspace: Intelligent LLM Interface

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)
![Python](https://img.shields.io/badge/Python-3.8+-blue.svg)
![Flask](https://img.shields.io/badge/Flask-Framework-green.svg)
![JavaScript](https://img.shields.io/badge/JavaScript-Vanilla-yellow.svg)

A professional-grade, full-stack AI chatbot application featuring a clean **ChatGPT-inspired UI**, **real-time streaming responses**, and **intelligent document analysis**.

This workspace is optimized for **Software Engineering workflows, DSA practice, and productivity**, bridging your local files with the powerful **Llama 3.1 (8B)** model via Groq API.

---

## ✨ Key Features

- ⚡ **Real-Time Streaming**  
  Word-by-word responses using Server-Sent Events (SSE) for smooth UX.

- 📄 **Intelligent PDF Discussion**  
  Ask contextual questions from local documents using `PyPDF2`.

- 🧠 **Thinking Mode (Developer Tool)**  
  View model reasoning in a collapsible UI (DeepSeek-style).

- 💾 **Persistent SQLite Memory**  
  Chat history is stored locally — resume anytime.

- 🎙 **Voice-to-Text Input**  
  Hands-free interaction via Web Speech API.

- 🎨 **Developer-Centric UI**
  - Markdown rendering + syntax highlighting (Prism.js)
  - Auto-expanding input box
  - Dark / Light mode toggle
  - Sidebar chat navigation

---

## 🛠 Tech Stack

| Layer        | Technology |
|-------------|-----------|
| Backend     | Python, Flask, Flask-CORS |
| Database    | SQLite3 |
| AI Engine   | Llama 3.1 8B (Groq API) |
| Frontend    | HTML5, CSS3, Vanilla JS |
| Libraries   | requests, PyPDF2, Marked.js, Prism.js |

---

## 📦 Installation & Setup

### 🔧 Prerequisites
- Python 3.8+
- Groq API Key → https://console.groq.com/

---

### 1️⃣ Clone Repository
```bash
git clone https://github.com/YashvanthG/AI-ChatBot.git
cd AI-ChatBot
```

---

### 2️⃣ Create Virtual Environment
```bash
python -m venv venv

# Windows
.\venv\Scripts\activate

# Mac/Linux
source venv/bin/activate
```

---

### 3️⃣ Install Dependencies
```bash
pip install flask flask-cors requests PyPDF2 python-dotenv
```

---

### 4️⃣ Configure API Key
Create `.env` file:

```env
GROQ_API_KEY=your_actual_api_key_here
```

---

### 5️⃣ Run Application
```bash
python app.py
```

👉 Open: http://127.0.0.1:5000

---

## 📂 Project Structure

```text
AI-ChatBot/
├── app.py          # Flask backend & API logic
├── index.html      # UI layout
├── style.css       # Styling & themes
├── script.js       # Frontend logic + SSE
├── .env            # API keys (ignored)
├── .gitignore
└── README.md
```

---

## 🧠 How "Thinking Mode" Works

When enabled, the system modifies the prompt to force the model to output structured reasoning.

- Backend intercepts structured output  
- Frontend parses it into `<details>` HTML  
- UI stays clean while logic remains inspectable  

👉 Perfect for debugging, learning, and interviews.

---

## 🤝 Contributing

Contributions are welcome!

```bash
1. Fork the repo
2. git checkout -b feature/AmazingFeature
3. git commit -m "Add AmazingFeature"
4. git push origin feature/AmazingFeature
5. Open a Pull Request
```

---

## 📜 License

Distributed under the MIT License.  
See `LICENSE` for more details.

---

## 👨‍💻 Author

**Yashvanth G**  
🔗 https://github.com/YashvanthG  

---

⭐ If you like this project, consider giving it a star!
