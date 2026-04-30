const chatBox = document.getElementById('chatBox');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const historyList = document.getElementById('historyList');
const currentChatTitle = document.getElementById('currentChatTitle');
const themeToggle = document.getElementById('themeToggle');
const welcomeScreen = document.getElementById('welcomeScreen');

let currentSessionId = null;
let currentPdfContext = "";
let isParsing = false; 
let isThinkingEnabled = false;

marked.setOptions({ breaks: true, gfm: true });

// --- UI AND MENUS ---
const plusBtn = document.getElementById('plusBtn');
const plusDropdown = document.getElementById('plusDropdown');
const thinkingToggleBtn = document.getElementById('thinkingToggleBtn');

plusBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    plusDropdown.classList.toggle('hidden');
});

document.addEventListener('click', () => plusDropdown.classList.add('hidden'));

thinkingToggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    isThinkingEnabled = !isThinkingEnabled;
    
    if (isThinkingEnabled) {
        thinkingToggleBtn.classList.add('active-feature');
        thinkingToggleBtn.style.backgroundColor = 'var(--hover-bg)';
    } else {
        thinkingToggleBtn.classList.remove('active-feature');
        thinkingToggleBtn.style.backgroundColor = 'transparent';
    }
    plusDropdown.classList.add('hidden');
});

userInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
    sendBtn.disabled = !(this.value.trim().length > 0 || currentPdfContext);
});

themeToggle.addEventListener('click', () => {
    const body = document.body;
    const isDark = body.getAttribute('data-theme') === 'dark';
    body.setAttribute('data-theme', isDark ? 'light' : 'dark');
});

function scrollToBottom() {
    chatBox.parentElement.scrollTop = chatBox.parentElement.scrollHeight;
}

// --- RENDER STATIC MESSAGES (History) ---
function renderStaticMessage(sender, text) {
    welcomeScreen.classList.add('hidden');
    const div = document.createElement('div');
    div.className = `message ${sender}-message`;
    let contentHtml = '';
    
    if (sender === 'ai') {
        const thoughtSplit = text.split('### FINAL ANSWER');
        if (thoughtSplit.length > 1) {
            let thoughtProcess = thoughtSplit[0].replace('### THOUGHT PROCESS', '').trim();
            let finalAnswer = thoughtSplit[1].trim();

            contentHtml += `
                <details class="thought-process">
                    <summary><i class="fas fa-brain"></i> Thought Process</summary>
                    <div>${marked.parse(thoughtProcess)}</div>
                </details>
            `;
            text = finalAnswer;
        }
    }

    contentHtml += `<div class="content markdown-body">${marked.parse(text)}</div>`;

    if (sender === 'ai') {
        div.innerHTML = `<div class="avatar-circle" style="background:#10a37f; color:white; margin-right:16px; flex-shrink:0;"><i class="fas fa-robot"></i></div> <div style="width: 100%">${contentHtml}</div>`;
    } else {
        div.innerHTML = `<div class="content">${marked.parse(text)}</div>`;
    }
    
    chatBox.appendChild(div);
    div.querySelectorAll('pre code').forEach((block) => Prism.highlightElement(block));
    scrollToBottom();
}

// --- DB & SESSIONS ---
async function loadSessions() {
    const res = await fetch('/sessions');
    const sessions = await res.json();
    historyList.innerHTML = '';
    
    sessions.forEach(session => {
        const container = document.createElement('div');
        container.className = `history-item-container ${session.id === currentSessionId ? 'active' : ''}`;
        
        container.innerHTML = `
            <div class="history-item-text" onclick="loadChat(${session.id}, '${session.title.replace(/'/g, "\\'")}')">
                ${session.title}
            </div>
            <button class="delete-chat-btn" onclick="deleteChat(event, ${session.id})">
                <i class="far fa-trash-alt"></i>
            </button>
        `;
        historyList.appendChild(container);
    });
}

async function deleteChat(event, id) {
    event.stopPropagation(); 
    if (!confirm("Delete this chat?")) return;

    try {
        const res = await fetch(`/sessions/${id}`, { method: 'DELETE' });
        if (res.ok) {
            if (currentSessionId === id) {
                currentSessionId = null;
                chatBox.innerHTML = '';
                welcomeScreen.classList.remove('hidden');
                currentChatTitle.innerHTML = `New Chat <i class="fas fa-chevron-down" style="font-size: 10px; color: #888;"></i>`;
            }
            loadSessions(); 
        }
    } catch (err) { console.error("Failed to delete chat", err); }
}

async function loadChat(id, title) {
    currentSessionId = id;
    currentChatTitle.innerHTML = `${title} <i class="fas fa-chevron-down" style="font-size: 10px; color: #888;"></i>`;
    chatBox.innerHTML = ''; 
    
    const res = await fetch(`/sessions/${id}/messages`);
    const messages = await res.json();
    
    if (messages.length === 0) {
        welcomeScreen.classList.remove('hidden');
    } else {
        welcomeScreen.classList.add('hidden');
        messages.forEach(msg => {
            renderStaticMessage(msg.role === 'assistant' ? 'ai' : 'user', msg.content);
        });
    }
    loadSessions(); 
}

document.getElementById('newChatBtn').addEventListener('click', () => {
    currentSessionId = null;
    currentChatTitle.innerHTML = `New Chat <i class="fas fa-chevron-down" style="font-size: 10px; color: #888;"></i>`;
    chatBox.innerHTML = '';
    welcomeScreen.classList.remove('hidden');
    loadSessions();
});

// --- STREAMING CHAT LOGIC ---
async function sendMessage() {
    if (isParsing) return;
    const message = userInput.value.trim();
    if (!message && !currentPdfContext) return;

    // Create session if it doesn't exist
    if (!currentSessionId) {
        const res = await fetch('/sessions', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: message ? message.substring(0, 25) + "..." : "Document Analysis" })
        });
        const data = await res.json();
        currentSessionId = data.id;
        currentChatTitle.innerHTML = `${data.title} <i class="fas fa-chevron-down" style="font-size: 10px; color: #888;"></i>`;
    }

    if (message) renderStaticMessage('user', message);
    
    userInput.value = '';
    userInput.style.height = 'auto'; 
    sendBtn.disabled = true;
    welcomeScreen.classList.add('hidden');

    // Create an empty AI message container for the stream
    const aiMessageDiv = document.createElement('div');
    aiMessageDiv.className = `message ai-message`;
    aiMessageDiv.innerHTML = `<div class="avatar-circle" style="background:#10a37f; color:white; margin-right:16px; flex-shrink:0;"><i class="fas fa-robot"></i></div><div class="content markdown-body" id="streamingContent">...</div>`;
    chatBox.appendChild(aiMessageDiv);
    scrollToBottom();

    const contentContainer = document.getElementById('streamingContent');
    let fullResponse = "";

    try {
        const response = await fetch('/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: message || "Analyze the attached document.",
                session_id: currentSessionId,
                pdf_context: currentPdfContext,
                thinking_enabled: isThinkingEnabled
            })
        });

        // Parse the SSE stream
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const dataStr = line.replace('data: ', '');
                    try {
                        const parsedData = JSON.parse(dataStr);
                        if (parsedData.chunk) {
                            fullResponse += parsedData.chunk;
                            
                            // Live parse logic for "Thinking" block vs Final Answer
                            let displayHtml = '';
                            const thoughtSplit = fullResponse.split('### FINAL ANSWER');
                            
                            if (thoughtSplit.length > 1) {
                                let thoughtProcess = thoughtSplit[0].replace('### THOUGHT PROCESS', '').trim();
                                let finalAnswer = thoughtSplit[1].trim();

                                displayHtml = `
                                    <details class="thought-process" open>
                                        <summary><i class="fas fa-brain"></i> Thought Process</summary>
                                        <div>${marked.parse(thoughtProcess)}</div>
                                    </details>
                                    <div>${marked.parse(finalAnswer)}</div>
                                `;
                            } else {
                                // If thinking is enabled, wrap the stream in the details tag until we see the final answer
                                if (isThinkingEnabled && fullResponse.includes('### THOUGHT PROCESS')) {
                                    let thoughtProcess = fullResponse.replace('### THOUGHT PROCESS', '').trim();
                                    displayHtml = `
                                        <details class="thought-process" open>
                                            <summary><i class="fas fa-brain"></i> Thought Process (Thinking...)</summary>
                                            <div>${marked.parse(thoughtProcess)}</div>
                                        </details>
                                    `;
                                } else {
                                    displayHtml = marked.parse(fullResponse);
                                }
                            }

                            contentContainer.innerHTML = displayHtml;
                            scrollToBottom();
                        } else if (parsedData.error) {
                            contentContainer.innerHTML = `*(Error: ${parsedData.error})*`;
                        }
                    } catch (e) {
                        // Incomplete JSON chunk, skip and wait for the next piece
                    }
                }
            }
        }
        
        // Final cleanup after stream finishes
        contentContainer.removeAttribute('id'); // Remove id so next message can use it
        contentContainer.querySelectorAll('pre code').forEach((block) => Prism.highlightElement(block));
        
        // Collapse the thought process by default after generation is complete
        const detailsTag = contentContainer.querySelector('.thought-process');
        if(detailsTag) detailsTag.removeAttribute('open');
        
        loadSessions(); 

    } catch (error) {
        contentContainer.innerHTML = 'Connection error.';
    }
}

sendBtn.addEventListener('click', sendMessage);
userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if(!sendBtn.disabled) sendMessage();
    }
});

// --- VOICE TYPING LOGIC ---
const voiceBtn = document.getElementById('voiceBtn');
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (SpeechRecognition) {
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true; 

    let isRecording = false;

    voiceBtn.addEventListener('click', () => {
        if (isRecording) {
            recognition.stop();
        } else {
            recognition.start();
        }
    });

    recognition.onstart = () => {
        isRecording = true;
        voiceBtn.classList.add('recording');
        userInput.placeholder = "Listening...";
    };

    recognition.onresult = (event) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript;
        }
        userInput.value = transcript;
        userInput.dispatchEvent(new Event('input')); // Activate send button
    };

    recognition.onend = () => {
        isRecording = false;
        voiceBtn.classList.remove('recording');
        userInput.placeholder = "Ask anything";
    };

    recognition.onerror = (event) => {
        console.error("Speech error", event.error);
        isRecording = false;
        voiceBtn.classList.remove('recording');
        userInput.placeholder = "Ask anything";
    };
}

// --- PDF UPLOAD LOGIC ---
const pdfInput = document.getElementById('pdfInput');
const attachmentIndicator = document.getElementById('attachmentIndicator');
const attachedFileName = document.getElementById('attachedFileName');

pdfInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    plusDropdown.classList.add('hidden'); 
    isParsing = true;
    sendBtn.disabled = true;
    
    const formData = new FormData(); formData.append('file', file);
    attachedFileName.innerText = file.name; 
    attachmentIndicator.classList.remove('hidden');
    
    try {
        const res = await fetch('/upload', { method: 'POST', body: formData });
        const data = await res.json();
        if (res.ok) { 
            currentPdfContext = data.text; 
            sendBtn.disabled = false; 
        } else { 
            alert(data.error); clearAttachment(); 
        }
    } catch (e) { clearAttachment(); } finally { isParsing = false; }
});

function clearAttachment() { 
    currentPdfContext = ""; pdfInput.value = ""; 
    attachmentIndicator.classList.add('hidden'); 
    if(userInput.value.trim().length === 0) sendBtn.disabled = true;
}

// Init
loadSessions();