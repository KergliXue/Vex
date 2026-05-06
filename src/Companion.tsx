import { useState, useEffect, useRef } from 'react'
import './App.css'
import Live2DCanvas from './Live2DCanvas'

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const DEFAULT_LIVE2D_MODEL_PATH = '/live2d/zzz_belle/zzz_belle.model3.json'

function Companion() {
  const [activeApp, setActiveApp] = useState('Unknown')
  const [activeTitle, setActiveTitle] = useState('Unknown')
  const [activeContext, setActiveContext] = useState('')
  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = localStorage.getItem('chat_history')
    return saved ? JSON.parse(saved) : []
  })
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [inputText, setInputText] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [recentAutoMessage, setRecentAutoMessage] = useState('')
  const [showAutoMessage, setShowAutoMessage] = useState(false)
  const [live2dModelPath, setLive2dModelPath] = useState(localStorage.getItem('live2d_model_path') || DEFAULT_LIVE2D_MODEL_PATH)
  const [live2dScale, setLive2dScale] = useState(parseFloat(localStorage.getItem('live2d_scale') || '1'))

  // Organic state tracking
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const lastSeenAppRef = useRef('')
  const switchHistoryRef = useRef<number[]>([])
  const lastSpokeTimeRef = useRef(0)
  const lastSwitchTimeRef = useRef(0)

  // Load config
  const getConfig = () => {
    return {
      apiKey: localStorage.getItem('deepseek_api_key') || import.meta.env.VITE_DEEPSEEK_API_KEY || '',
      prompt: localStorage.getItem('companion_prompt') || '你是一个傲娇、俏皮的电脑桌宠伴侣。回复要简短，像聊天软件一样。',
      chatProbability: parseFloat(localStorage.getItem('chat_probability') || '0.4'),
      debug: localStorage.getItem('debug_mode') === 'true',
    };
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    if (isChatOpen) scrollToBottom()
  }, [messages, isChatOpen])

  useEffect(() => {
    localStorage.setItem('chat_history', JSON.stringify(messages))
  }, [messages])

  useEffect(() => {
    lastSwitchTimeRef.current = Date.now()

    const syncLive2DConfig = () => {
      setLive2dModelPath(localStorage.getItem('live2d_model_path') || DEFAULT_LIVE2D_MODEL_PATH)
      setLive2dScale(parseFloat(localStorage.getItem('live2d_scale') || '1'))
    }

    if (!localStorage.getItem('live2d_model_path')) {
      localStorage.setItem('live2d_model_path', DEFAULT_LIVE2D_MODEL_PATH)
    }

    window.addEventListener('storage', syncLive2DConfig)
    return () => window.removeEventListener('storage', syncLive2DConfig)
  }, [])

  // Polling active window (just to update state)
  useEffect(() => {
    const fetchActiveWindow = async () => {
      if (window.electronAPI) {
        const result = await window.electronAPI.getActiveWindow()
        if (result && result.app !== 'Unknown') {
          if (result.app !== lastSeenAppRef.current) {
            // Track app switch
            const now = Date.now();
            switchHistoryRef.current.push(now);
            // Keep only last 60 seconds of history
            switchHistoryRef.current = switchHistoryRef.current.filter(t => now - t < 60000);
            lastSwitchTimeRef.current = now;
            lastSeenAppRef.current = result.app;
          }
          setActiveApp(result.app)
          setActiveTitle(result.title)
          setActiveContext(result.context || '')
        }
      }
    }

    const intervalId = setInterval(fetchActiveWindow, 3000);
    fetchActiveWindow();

    // Handle manual trigger from global shortcut
    let cleanupShortcut: (() => void) | null = null;
    const electronAPI = window.electronAPI;
    if (electronAPI) {
      cleanupShortcut = electronAPI.onScreenshotAnalysis(() => {
        const config = getConfig();
        if (config.debug) {
          const log = "Manual trigger: Global Shortcut Cmd+Opt+Shift+T detected.";
          console.log(log);
          electronAPI.writeLog(log);
        }
        const prompt = `[手动触发观察] 我现在主动给你发了一张我屏幕的截图。请仔细观察我在干什么，并用简短、毒舌或俏皮的语气吐槽一下。`;
        callAI(prompt, true, true);
      });
    }

    return () => {
      clearInterval(intervalId);
      if (cleanupShortcut) cleanupShortcut();
    };
  }, [])

  async function callAI(userMessage: string, isAutoObserve: boolean, forceVision: boolean = false) {
    const config = getConfig();
    const isDebug = config.debug;
    const provider = localStorage.getItem('ai_provider') || 'deepseek';
    const deepseekKey = config.apiKey;
    const geminiKey = localStorage.getItem('gemini_api_key') || '';
    const doubaoKey = localStorage.getItem('doubao_api_key') || '';

    if (isDebug) {
      const log = `[AI Call] Mode: ${isAutoObserve ? 'Auto' : 'Manual'}, Provider: ${provider}\n[AI Call] Prompt: ${userMessage.substring(0, 100)}...`;
      console.log(log);
      if (window.electronAPI) window.electronAPI.writeLog(log);
    }

    let systemPrompt = config.prompt;
    if (window.electronAPI) {
      systemPrompt = await window.electronAPI.readSoul();
    }

    if (!deepseekKey || deepseekKey === 'your_deepseek_api_key_here') {
      handleAIReply("请先在设置中配置 DeepSeek API Key", true);
      return;
    }

    setIsTyping(true);

    try {
      let visionContext = "";

      // --- Mode 2: Eyes (Vision Analysis) ---
      if ((provider === 'gemini' || provider === 'doubao') && (isAutoObserve || forceVision)) {
        if (window.electronAPI) {
          const screenshotData = await window.electronAPI.captureScreen();
          if (screenshotData) {
            const base64Data = screenshotData.split(',')[1];
            
            if (provider === 'gemini' && geminiKey) {
              try {
                const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${geminiKey}`;
                const geminiRes = await fetch(url, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    contents: [{
                      parts: [
                        { text: "请仔细观察这张屏幕截图，描述用户当前正在进行的操作。请用一两句话简明扼要地概括。" },
                        { inline_data: { mime_type: "image/png", data: base64Data } }
                      ]
                    }]
                  })
                });
                if (geminiRes.ok) {
                  const data = await geminiRes.json();
                  const description = data.candidates[0].content.parts[0].text.trim();
                  visionContext = "【视觉观察到：" + description + "】";
                  if (isDebug && window.electronAPI) window.electronAPI.writeLog("[Gemini] Vision result: " + description);
                }
              } catch (e) { console.error("Gemini Vision Error:", e); }

            } else if (provider === 'doubao' && doubaoKey) {
              try {
                const url = `https://ark.cn-beijing.volces.com/api/v3/chat/completions`;
                const doubaoEndpoint = localStorage.getItem('doubao_endpoint_id') || '';
                const doubaoRes = await fetch(url, {
                  method: 'POST',
                  headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${doubaoKey}`
                  },
                  body: JSON.stringify({
                    model: doubaoEndpoint,
                    messages: [
                      {
                        role: "user",
                        content: [
                          { type: "text", text: "请仔细观察这张屏幕截图，描述用户当前正在进行的操作。请用一两句话简明扼要地概括。" },
                          { type: "image_url", image_url: { url: screenshotData } }
                        ]
                      }
                    ]
                  })
                });
                if (doubaoRes.ok) {
                  const data = await doubaoRes.json();
                  const description = data.choices[0].message.content.trim();
                  visionContext = "【视觉观察到：" + description + "】";
                  if (isDebug && window.electronAPI) window.electronAPI.writeLog("[Doubao] Vision result: " + description);
                }
              } catch (e) { console.error("Doubao Vision Error:", e); }
            }
          }
        }
      }

      // --- Brain (DeepSeek) ---
      const fullUserMessage = visionContext ? `${visionContext}\n${userMessage}` : userMessage;
      const conversationHistory = (isAutoObserve && !forceVision) ? [] : messages.map(m => ({ role: m.role, content: m.content })).slice(-10);

      if (isDebug) {
        console.log("[DeepSeek] Sending prompt to Brain...");
        if (window.electronAPI) window.electronAPI.writeLog("[DeepSeek] Sending prompt to Brain...");
      }

      const response = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${deepseekKey}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: systemPrompt },
            ...conversationHistory,
            { role: 'user', content: fullUserMessage }
          ],
          temperature: 0.8,
          max_tokens: 150
        })
      });

      if (response.ok) {
        const data = await response.json();
        const reply = data.choices[0].message.content.trim();
        if (isDebug) {
          console.log("[DeepSeek] Reply received:", reply);
          if (window.electronAPI) window.electronAPI.writeLog("[DeepSeek] Reply received: " + reply);
        }
        handleAIReply(reply, isAutoObserve);
      } else {
        const err = await response.json();
        console.error("DeepSeek Error:", err);
        if (isDebug && window.electronAPI) window.electronAPI.writeLog("[DeepSeek] Error: " + JSON.stringify(err));
      }
    } catch (error) {
      console.error("AI Fetch Error:", error);
    } finally {
      setIsTyping(false);
    }
  }

  const handleAIReply = (reply: string, isAutoObserve: boolean) => {
    lastSpokeTimeRef.current = Date.now();

    if (window.electronAPI) {
      window.electronAPI.writeLog(`🤖 AI: ${reply}`);
    }

    if (isAutoObserve && !isChatOpen) {
      setRecentAutoMessage(reply);
      setShowAutoMessage(true);
      setTimeout(() => setShowAutoMessage(false), 8000);
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: reply }]);
    } else {
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: reply }]);
    }
  };

  // Organic Intelligence Loop
  useEffect(() => {
    const organicCheck = setInterval(() => {
      if (activeApp === 'Unknown' || isTyping || isChatOpen) return;

      const now = Date.now();
      const silenceDuration = now - lastSpokeTimeRef.current;
      const appDwellTime = now - lastSwitchTimeRef.current;
      const busyScore = switchHistoryRef.current.length; // Switches in last 60s
      const config = getConfig();

      // Rule 1: If user is busy (frequent switching), DO NOT disturb.
      if (busyScore > 3) return;

      // Rule 2: Cooldown - don't speak more than once every 30 seconds automatically
      if (silenceDuration < 30000) return;

      // Scenario A: Just switched to a new app, have settled for a bit (5-15s).
      if (appDwellTime > 5000 && appDwellTime < 20000) {
        // Base probability scaled by chatProbability setting
        if (Math.random() < (config.chatProbability * 0.8)) { // e.g. 0.4 * 0.8 = 32% chance
          const prompt = `[内心独白] 我注意到用户刚刚开始使用软件：${activeApp}，窗口标题是：${activeTitle}。窗口内的部分文本内容是：${activeContext}。请用一句简短俏皮的话吐槽、关心或者好奇一下。`;
          callAI(prompt, true);
        }
      }
      // Scenario B: Dwelling on the same app for a long time (> 60s)
      else if (appDwellTime > 60000) {
        // Small probability every 10 seconds to say something random
        if (Math.random() < (config.chatProbability * 0.3)) { // e.g. 0.4 * 0.3 = 12% chance every 10s
          const prompt = `[内心独白] 用户已经在 ${activeApp} (${activeTitle}) 停留很久了。屏幕上的内容大约是：${activeContext}。请莫名其妙地说一句简短的话发起话题，可以是闲聊、突然的脑洞、或者是提醒用户休息。`;
          callAI(prompt, true);
        }
      }
    }, 10000); // Check every 10 seconds

    return () => clearInterval(organicCheck);
  }, [activeApp, activeTitle, isTyping, isChatOpen]);

  const handleSend = () => {
    const content = inputText.trim();
    if (!content) return;

    // --- Command Handling ---
    if (content.startsWith('/')) {
      const cmd = content.toLowerCase().split(' ')[0];
      if (cmd === '/clear') {
        setMessages([]);
        setInputText('');
        if (window.electronAPI) window.electronAPI.writeLog("🧹 Chat cleared by command.");
        return;
      }
      if (cmd === '/help') {
        const helpMsg: Message = { 
          id: 'help-' + Date.now(), 
          role: 'assistant', 
          content: '【可用指令】\n/clear - 清空屏幕上的聊天记录\n/help - 查看此帮助' 
        };
        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', content: '/help' }, helpMsg]);
        setInputText('');
        return;
      }
    }

    const newMsg: Message = { id: Date.now().toString(), role: 'user', content };
    setMessages(prev => [...prev, newMsg]);
    setInputText('');
    setShowAutoMessage(false);

    if (window.electronAPI) {
      window.electronAPI.writeLog(`👤 User: ${content}`);
    }

    callAI(content, false);
  };

  const handlePetMouseDown = (e: React.MouseEvent) => {
    if (e.metaKey) {
      e.preventDefault();
      isDraggingRef.current = true;
      didDragRef.current = false;
      const eAPI = window.electronAPI;
      if (eAPI) eAPI.setIgnoreMouseEvents(false);

      let lastX = e.screenX;
      let lastY = e.screenY;

      const onMouseMove = (moveEvent: MouseEvent) => {
        const dx = moveEvent.screenX - lastX;
        const dy = moveEvent.screenY - lastY;
        lastX = moveEvent.screenX;
        lastY = moveEvent.screenY;
        if (dx !== 0 || dy !== 0) didDragRef.current = true;
        if (eAPI) eAPI.moveWindow({ x: dx, y: dy, relative: true });
      };

      const onMouseUp = () => {
        isDraggingRef.current = false;
        // Restore click-through
        if (eAPI) eAPI.setIgnoreMouseEvents(true, { forward: true });
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    }
  };

  const handlePetWheel = (e: React.WheelEvent) => {
    if (!live2dModelPath) return;

    e.preventDefault();
    e.stopPropagation();

    const direction = e.deltaY > 0 ? -1 : 1;
    const nextScale = Math.min(2.5, Math.max(0.4, Number((live2dScale + direction * 0.1).toFixed(1))));
    setLive2dScale(nextScale);
    localStorage.setItem('live2d_scale', String(nextScale));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Check if the user is using an IME (like Chinese input) and is currently composing
    if (e.nativeEvent.isComposing || e.keyCode === 229) {
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const openSettings = () => {
    if (window.electronAPI) {
      window.electronAPI.openSettings();
    }
  };

  // Dynamic Click-through: use mousemove + whitelist selector detection
  const isDraggingRef = useRef(false);
  const didDragRef = useRef(false); // track if actual movement happened during Cmd+drag

  // These are the only elements that should receive mouse events
  const INTERACTIVE = '.pet-avatar, .pet-face, .live2d-stage, .live2d-canvas, .chat-panel, .floating-bubble, textarea, button, .message-bubble, .chat-input-area, .empty-state';

  useEffect(() => {
    const eAPI = window.electronAPI;
    if (!eAPI) return;

    eAPI.setIgnoreMouseEvents(true, { forward: true });

    const onMouseMove = (e: MouseEvent) => {
      if (isDraggingRef.current) return;

      const el = document.elementFromPoint(e.clientX, e.clientY);
      const isOverInteractive = el ? el.closest(INTERACTIVE) !== null : false;

      if (isOverInteractive) {
        eAPI.setIgnoreMouseEvents(false);
      } else {
        eAPI.setIgnoreMouseEvents(true, { forward: true });
      }
    };

    document.addEventListener('mousemove', onMouseMove);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
    };
  }, []);

  return (
    <div className="container" style={{ pointerEvents: 'none' }}>

      {/* Floating Chat History & Input */}
      {isChatOpen && (
        <div className="chat-panel">
          <div className="chat-messages">
            {messages.length === 0 && (
              <div className="empty-state">和我打个招呼吧~</div>
            )}
            {messages.map(msg => (
              <div key={msg.id} className={`message-row ${msg.role}`}>
                <div className={`message-bubble ${msg.role}`}>
                  {msg.content}
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="message-row assistant">
                <div className="message-bubble assistant typing">
                  <span className="dot"></span>
                  <span className="dot"></span>
                  <span className="dot"></span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="chat-input-area">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="说点什么... (Enter 发送)"
              rows={1}
            />
            <button onClick={handleSend} disabled={!inputText.trim() || isTyping}>
              发送
            </button>
          </div>
        </div>
      )}

      {/* Pet Avatar & Floating Bubble */}
      <div className="pet-container">
        {showAutoMessage && !isChatOpen && (
          <div className="floating-bubble" onClick={() => { setIsChatOpen(true); setShowAutoMessage(false); }}>
            {recentAutoMessage}
          </div>
        )}

        <div
          className={`pet-avatar ${live2dModelPath ? 'live2d-mode' : ''}`}
          onMouseDown={handlePetMouseDown}
          onWheel={handlePetWheel}
          onClick={() => {
            if (didDragRef.current) { didDragRef.current = false; return; }
            setIsChatOpen(!isChatOpen);
          }}
          onDoubleClick={openSettings}
          title={live2dModelPath ? `点击聊天 | 滚轮缩放 | Cmd+拖动移动 | 双击设置 | 当前缩放 ${live2dScale.toFixed(1)}` : '点击聊天 | Cmd+拖动移动 | 双击设置'}
        >
          {live2dModelPath ? (
            <Live2DCanvas modelPath={live2dModelPath} scale={live2dScale} />
          ) : (
            <div className="pet-face">🤖</div>
          )}
        </div>
      </div>

    </div>
  )
}

export default Companion
