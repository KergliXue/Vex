import { useState, useEffect } from 'react';
import './Settings.css';

const DEFAULT_LIVE2D_MODEL_PATH = '/live2d/zzz_belle/zzz_belle.model3.json';

function Settings() {
  const [apiKey, setApiKey] = useState(localStorage.getItem('deepseek_api_key') || '');
  const [geminiKey, setGeminiKey] = useState(localStorage.getItem('gemini_api_key') || '');
  const [doubaoKey, setDoubaoKey] = useState(localStorage.getItem('doubao_api_key') || '');
  const [doubaoEndpoint, setDoubaoEndpoint] = useState(localStorage.getItem('doubao_endpoint_id') || '');
  const [provider, setProvider] = useState(localStorage.getItem('ai_provider') || 'deepseek');
  const [prompt] = useState(localStorage.getItem('companion_prompt') || '你是一个桌宠伴侣...');
  const [chatProbability, setChatProbability] = useState(localStorage.getItem('chat_probability') || '0.4');
  const [isDebugMode, setIsDebugMode] = useState(localStorage.getItem('debug_mode') === 'true');
  const [live2dModelPath, setLive2dModelPath] = useState(localStorage.getItem('live2d_model_path') || DEFAULT_LIVE2D_MODEL_PATH);
  const [live2dScale, setLive2dScale] = useState(localStorage.getItem('live2d_scale') || '1');
  const [saved, setSaved] = useState(false);
  const [userDataPath, setUserDataPath] = useState('');

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.getUserDataPath().then((path: string) => {
        setUserDataPath(path);
      });
    }
  }, []);

  const handleSave = () => {
    localStorage.setItem('deepseek_api_key', apiKey);
    localStorage.setItem('gemini_api_key', geminiKey);
    localStorage.setItem('doubao_api_key', doubaoKey);
    localStorage.setItem('doubao_endpoint_id', doubaoEndpoint);
    localStorage.setItem('ai_provider', provider);
    localStorage.setItem('companion_prompt', prompt);
    localStorage.setItem('chat_probability', chatProbability);
    localStorage.setItem('debug_mode', isDebugMode.toString());
    localStorage.setItem('live2d_model_path', live2dModelPath.trim());
    localStorage.setItem('live2d_scale', live2dScale);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="settings-container">
      <h2>Vex 控制台</h2>
      
      <div className="form-group">
        <label style={{ fontSize: '15px', fontWeight: 'bold' }}>运行模式:</label>
        <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
          <button 
            className={`mode-btn ${provider === 'deepseek' ? 'active' : ''}`}
            onClick={() => setProvider('deepseek')}
          >
            模式 1：纯文本 (DeepSeek)
          </button>
          <button 
            className={`mode-btn ${provider === 'gemini' ? 'active' : ''}`}
            onClick={() => setProvider('gemini')}
          >
            模式 2：视觉增强 (Gemini)
          </button>
          <button 
            className={`mode-btn ${provider === 'doubao' ? 'active' : ''}`}
            onClick={() => setProvider('doubao')}
          >
            模式 3：视觉增强 (豆包/Ark)
          </button>
        </div>
      </div>

      <div className="form-group">
        <label>DeepSeek API Key (对话大脑):</label>
        <input 
          type="password" 
          value={apiKey} 
          onChange={e => setApiKey(e.target.value)}
          placeholder="sk-..." 
        />
      </div>

      {provider === 'gemini' && (
        <div className="form-group" style={{ animation: 'slide-down 0.3s' }}>
          <label>Gemini API Key (视觉双眼):</label>
          <input 
            type="password" 
            value={geminiKey} 
            onChange={e => setGeminiKey(e.target.value)}
            placeholder="AIza..." 
          />
          <small style={{ color: '#888' }}>模式 2 下，Gemini 将负责截取并理解屏幕内容，DeepSeek 负责回复。</small>
        </div>
      )}

      {provider === 'doubao' && (
        <div className="form-group" style={{ animation: 'slide-down 0.3s' }}>
          <label>豆包 (Ark) API Key:</label>
          <input 
            type="password" 
            value={doubaoKey} 
            onChange={e => setDoubaoKey(e.target.value)}
            placeholder="火山引擎 API Key" 
          />
          <label style={{ marginTop: '10px' }}>豆包 (Ark) Endpoint ID (推理终端 ID):</label>
          <input 
            type="text" 
            value={doubaoEndpoint} 
            onChange={e => setDoubaoEndpoint(e.target.value)}
            placeholder="ep-2024..." 
          />
          <small style={{ color: '#888' }}>模式 3 下，豆包 (Doubao Vision) 将负责截取并理解屏幕内容。</small>
        </div>
      )}

      <div className="form-group">
        <label>系统提示词 (Prompt):</label>
        <div style={{ padding: '10px', background: '#f5f5f5', borderRadius: '6px', fontSize: '12px', color: '#666', wordBreak: 'break-all' }}>
          为了方便高级调试，灵魂设定已迁移至系统标准配置目录：
          <br/>
          <a 
            href="#" 
            onClick={(e) => {
              e.preventDefault();
              if (window.electronAPI) {
                window.electronAPI.openSoulFile();
              }
            }}
            style={{ color: '#007aff', fontWeight: 'bold', textDecoration: 'underline', cursor: 'pointer' }}
          >
            {userDataPath}/soul.md
          </a>
          <br/>
          点击上方链接即可使用默认编辑器修改，保存后实时生效！
        </div>
      </div>

      <div className="form-group">
        <label>Live2D 模型路径:</label>
        <input
          type="text"
          value={live2dModelPath}
          onChange={e => setLive2dModelPath(e.target.value)}
          placeholder="/live2d/haru/runtime/haru.model3.json"
        />
        <small style={{ color: '#888', marginTop: '6px' }}>
          先把 `live2dcubismcore.min.js` 和模型文件放到 `public/live2d/`，再填写模型配置文件路径。
        </small>
      </div>

      <div className="form-group">
        <label>Live2D 缩放: {live2dScale}</label>
        <input
          type="range"
          min="0.4" max="2.5" step="0.1"
          value={live2dScale}
          onChange={e => setLive2dScale(e.target.value)}
        />
      </div>

      <div className="form-group">
        <label>搭话概率 (0 到 1, 越高越话唠): {chatProbability}</label>
        <input 
          type="range" 
          min="0.1" max="1" step="0.1"
          value={chatProbability} 
          onChange={e => setChatProbability(e.target.value)} 
        />
      </div>

      <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <input 
          type="checkbox" 
          id="debug_mode"
          checked={isDebugMode} 
          onChange={e => setIsDebugMode(e.target.checked)} 
          style={{ width: 'auto' }}
        />
        <label htmlFor="debug_mode" style={{ margin: 0 }}>开启调试模式 (Console 打印详细日志)</label>
      </div>

      <div style={{ display: 'flex', gap: '10px' }}>
        <button onClick={handleSave} className="save-btn" style={{ flex: 1 }}>
          {saved ? '已保存！' : '保存设置'}
        </button>
        <button 
          onClick={() => {
            if(window.confirm('确定要清空所有的聊天记忆吗？')) {
              localStorage.removeItem('chat_history');
              window.location.reload();
            }
          }} 
          className="save-btn" 
          style={{ flex: 1, backgroundColor: '#ff3b30' }}
        >
          清空记忆
        </button>
      </div>
    </div>
  );
}

export default Settings;
