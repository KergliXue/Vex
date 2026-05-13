import { useState, useEffect } from 'react';
import './Settings.css';
import type { RoleDetail, RoleInfo } from './electron';

const DEFAULT_LIVE2D_MODEL_PATH = '/live2d/zzz_belle/zzz_belle.model3.json';
const DEFAULT_CHAT_OFFSET_X = '28';
const DEFAULT_CHAT_OFFSET_Y = '20';
const DEFAULT_CHAT_PANEL_WIDTH = '360';
const DEFAULT_CHAT_PANEL_HEIGHT = '520';
const EMPTY_ROLE_FORM = {
  roleId: '',
  name: '',
  description: '',
  soulContent: '',
  imageSourcePath: '',
  imagePreview: '',
};

type SettingsTab = 'appearance' | 'ai' | 'advanced';

const tabs: Array<{ id: SettingsTab; label: string; hint: string }> = [
  { id: 'appearance', label: '外观布局', hint: '人物、聊天框和舞台相关' },
  { id: 'ai', label: 'AI 与观察', hint: '模型、视觉和搭话行为' },
  { id: 'advanced', label: '高级', hint: '灵魂文件、调试和数据清理' },
];

function Settings() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('appearance');
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
  const [chatOffsetX, setChatOffsetX] = useState(localStorage.getItem('chat_offset_x') || DEFAULT_CHAT_OFFSET_X);
  const [chatOffsetY, setChatOffsetY] = useState(localStorage.getItem('chat_offset_y') || DEFAULT_CHAT_OFFSET_Y);
  const [chatPanelWidth, setChatPanelWidth] = useState(localStorage.getItem('chat_panel_width') || DEFAULT_CHAT_PANEL_WIDTH);
  const [chatPanelHeight, setChatPanelHeight] = useState(localStorage.getItem('chat_panel_height') || DEFAULT_CHAT_PANEL_HEIGHT);
  const [saved, setSaved] = useState(false);
  const [userDataPath, setUserDataPath] = useState('');
  const [roles, setRoles] = useState<RoleInfo[]>([]);
  const [roleMessage, setRoleMessage] = useState('');
  const [roleError, setRoleError] = useState('');
  const [roleEditorOpen, setRoleEditorOpen] = useState(false);
  const [roleEditorLoading, setRoleEditorLoading] = useState(false);
  const [roleSaving, setRoleSaving] = useState(false);
  const [roleForm, setRoleForm] = useState(EMPTY_ROLE_FORM);

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.getUserDataPath().then((path: string) => {
        setUserDataPath(path);
      });
      window.electronAPI.listRoles().then(setRoles).catch((error: unknown) => {
        setRoleError(error instanceof Error ? error.message : '加载角色失败');
      });
    }
  }, []);

  useEffect(() => {
    const electronAPI = window.electronAPI;
    if (!electronAPI) return;

    return electronAPI.onRolesUpdated((nextRoles) => {
      setRoles(nextRoles);
      setRoleError('');
    });
  }, []);

  const setRoleNotice = (message: string, isError = false) => {
    if (isError) {
      setRoleError(message);
      setRoleMessage('');
    } else {
      setRoleMessage(message);
      setRoleError('');
    }
  };

  const resetRoleEditor = () => {
    setRoleEditorOpen(false);
    setRoleEditorLoading(false);
    setRoleSaving(false);
    setRoleForm(EMPTY_ROLE_FORM);
  };

  const refreshRoles = async () => {
    if (!window.electronAPI) return;
    const nextRoles = await window.electronAPI.listRoles();
    setRoles(nextRoles);
  };

  const handleImportRole = async () => {
    if (!window.electronAPI) return;
    try {
      const nextRoles = await window.electronAPI.importRole();
      setRoles(nextRoles);
      setRoleNotice('角色已导入，可以直接启用。');
    } catch (error) {
      setRoleNotice(error instanceof Error ? error.message : '导入角色失败', true);
    }
  };

  const handleExportRole = async (roleId: string) => {
    if (!window.electronAPI) return;
    try {
      const result = await window.electronAPI.exportRole(roleId);
      if (result?.exportedTo) {
        setRoleNotice(`角色已导出到 ${result.exportedTo}`);
      }
    } catch (error) {
      setRoleNotice(error instanceof Error ? error.message : '导出角色失败', true);
    }
  };

  const handleEnableRole = async (roleId: string) => {
    if (!window.electronAPI) return;
    try {
      const nextRoles = await window.electronAPI.setActiveRole(roleId);
      setRoles(nextRoles);
      setRoleNotice('已切换当前角色，后续对话会立即使用新灵魂。');
    } catch (error) {
      setRoleNotice(error instanceof Error ? error.message : '切换角色失败', true);
    }
  };

  const openCreateRoleEditor = () => {
    setRoleEditorOpen(true);
    setRoleEditorLoading(false);
    setRoleForm({
      ...EMPTY_ROLE_FORM,
      soulContent: '# 新角色设定\n\n在这里写这个角色的性格、说话方式和规则。',
    });
    setRoleNotice('');
  };

  const openEditRoleEditor = async (roleId: string) => {
    if (!window.electronAPI) return;
    setRoleEditorOpen(true);
    setRoleEditorLoading(true);
    setRoleNotice('');
    try {
      const detail: RoleDetail = await window.electronAPI.getRoleDetail(roleId);
      setRoleForm({
        roleId: detail.id,
        name: detail.name,
        description: detail.description,
        soulContent: detail.soulContent,
        imageSourcePath: '',
        imagePreview: detail.avatarDataUrl || '',
      });
    } catch (error) {
      setRoleNotice(error instanceof Error ? error.message : '加载角色详情失败', true);
      setRoleEditorOpen(false);
    } finally {
      setRoleEditorLoading(false);
    }
  };

  const handlePickRoleImage = async () => {
    if (!window.electronAPI) return;
    try {
      const result = await window.electronAPI.pickRoleImage();
      if (!result) return;
      setRoleForm(prev => ({
        ...prev,
        imageSourcePath: result.path,
        imagePreview: result.dataUrl,
      }));
    } catch (error) {
      setRoleNotice(error instanceof Error ? error.message : '选择角色图片失败', true);
    }
  };

  const handleSaveRole = async () => {
    if (!window.electronAPI) return;
    setRoleSaving(true);
    try {
      const result = await window.electronAPI.saveRole({
        roleId: roleForm.roleId || undefined,
        name: roleForm.name,
        description: roleForm.description,
        soulContent: roleForm.soulContent,
        imageSourcePath: roleForm.imageSourcePath || undefined,
      });
      setRoles(result.roles);
      setRoleNotice(roleForm.roleId ? '角色已更新。' : '角色已创建。');
      await openEditRoleEditor(result.roleId);
    } catch (error) {
      setRoleNotice(error instanceof Error ? error.message : '保存角色失败', true);
    } finally {
      setRoleSaving(false);
    }
  };

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
    localStorage.setItem('chat_offset_x', chatOffsetX);
    localStorage.setItem('chat_offset_y', chatOffsetY);
    localStorage.setItem('chat_panel_width', chatPanelWidth);
    localStorage.setItem('chat_panel_height', chatPanelHeight);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="settings-container">
      <div className="settings-shell">
        <div className="settings-header">
          <div>
            <p className="settings-eyebrow">Vex Console</p>
            <h2>Vex 控制台</h2>
            {/* <p className="settings-subtitle">把角色布局、对话行为和调试能力分开管理，别再把所有开关堆在一页里。</p> */}
          </div>
          <button onClick={handleSave} className="save-btn header-save-btn">
            {saved ? '已保存' : '保存设置'}
          </button>
        </div>

        <div className="settings-tabs" role="tablist" aria-label="设置分组">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`settings-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span>{tab.label}</span>
              <small>{tab.hint}</small>
            </button>
          ))}
        </div>

        <div className="settings-panel">
          {activeTab === 'appearance' && (
            <>
              <div className="settings-section">
                <div className="section-heading">
                  <h3>人物与舞台</h3>
                  <p>控制 Live2D 的模型来源和默认体积。</p>
                </div>

                <div className="form-group">
                  <label>Live2D 模型路径</label>
                  <input
                    type="text"
                    value={live2dModelPath}
                    onChange={e => setLive2dModelPath(e.target.value)}
                    placeholder="/live2d/haru/runtime/haru.model3.json"
                  />
                  <small className="field-hint">
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
              </div>

              <div className="settings-section">
                <div className="section-heading">
                  <h3>聊天窗口相对人物</h3>
                  <p>这两个值会在不越屏的前提下，调节聊天框和人物的相对距离。</p>
                </div>

                <div className="form-group">
                  <label>水平距离</label>
                  <input
                    type="number"
                    value={chatOffsetX}
                    onChange={e => setChatOffsetX(e.target.value)}
                    placeholder="28"
                  />
                  <small className="field-hint">值越大，聊天窗口离人物越远。</small>
                </div>

                <div className="form-group">
                  <label>垂直距离</label>
                  <input
                    type="number"
                    value={chatOffsetY}
                    onChange={e => setChatOffsetY(e.target.value)}
                    placeholder="20"
                  />
                  <small className="field-hint">值越大，聊天窗口整体越往上收。</small>
                </div>

                <div className="form-group two-col-grid">
                  <div>
                    <label>聊天窗口宽度</label>
                    <input
                      type="number"
                      value={chatPanelWidth}
                      onChange={e => setChatPanelWidth(e.target.value)}
                      placeholder="360"
                    />
                  </div>
                  <div>
                    <label>聊天窗口高度</label>
                    <input
                      type="number"
                      value={chatPanelHeight}
                      onChange={e => setChatPanelHeight(e.target.value)}
                      placeholder="520"
                    />
                  </div>
                  <small className="field-hint grid-span-2">会优先使用你填写的尺寸，只有快越出屏幕时才会被安全裁剪。</small>
                </div>
              </div>
            </>
          )}

          {activeTab === 'ai' && (
            <>
              <div className="settings-section">
                <div className="section-heading">
                  <h3>运行模式</h3>
                  <p>决定谁负责视觉观察，谁负责生成回复。</p>
                </div>

                <div className="mode-grid">
                  <button
                    className={`mode-btn ${provider === 'deepseek' ? 'active' : ''}`}
                    onClick={() => setProvider('deepseek')}
                  >
                    <strong>模式 1</strong>
                    <span>纯文本 · DeepSeek</span>
                  </button>
                  <button
                    className={`mode-btn ${provider === 'gemini' ? 'active' : ''}`}
                    onClick={() => setProvider('gemini')}
                  >
                    <strong>模式 2</strong>
                    <span>视觉增强 · Gemini</span>
                  </button>
                  <button
                    className={`mode-btn ${provider === 'doubao' ? 'active' : ''}`}
                    onClick={() => setProvider('doubao')}
                  >
                    <strong>模式 3</strong>
                    <span>视觉增强 · 豆包/Ark</span>
                  </button>
                </div>
              </div>

              <div className="settings-section">
                <div className="section-heading">
                  <h3>密钥与接口</h3>
                  <p>先配对话大脑，再按需补视觉模型。</p>
                </div>

                <div className="form-group">
                  <label>DeepSeek API Key</label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={e => setApiKey(e.target.value)}
                    placeholder="sk-..."
                  />
                </div>

                {provider === 'gemini' && (
                  <div className="form-group section-anim">
                    <label>Gemini API Key</label>
                    <input
                      type="password"
                      value={geminiKey}
                      onChange={e => setGeminiKey(e.target.value)}
                      placeholder="AIza..."
                    />
                    <small className="field-hint">Gemini 负责看屏幕，DeepSeek 负责说话。</small>
                  </div>
                )}

                {provider === 'doubao' && (
                  <div className="form-group section-anim">
                    <label>豆包 (Ark) API Key</label>
                    <input
                      type="password"
                      value={doubaoKey}
                      onChange={e => setDoubaoKey(e.target.value)}
                      placeholder="火山引擎 API Key"
                    />
                    <label className="sub-label">豆包 Endpoint ID</label>
                    <input
                      type="text"
                      value={doubaoEndpoint}
                      onChange={e => setDoubaoEndpoint(e.target.value)}
                      placeholder="ep-2024..."
                    />
                    <small className="field-hint">豆包负责截图理解，DeepSeek 继续负责回复风格。</small>
                  </div>
                )}
              </div>

              <div className="settings-section">
                <div className="section-heading">
                  <h3>主动搭话</h3>
                  <p>控制 Vex 主动开口的频率。</p>
                </div>

                <div className="form-group">
                  <label>搭话概率: {chatProbability}</label>
                  <input
                    type="range"
                    min="0.1" max="1" step="0.1"
                    value={chatProbability}
                    onChange={e => setChatProbability(e.target.value)}
                  />
                </div>
              </div>
            </>
          )}

          {activeTab === 'advanced' && (
            <>
              <div className="settings-section">
                <div className="section-heading">
                  <h3>角色卡</h3>
                  <p>每个角色都是一个独立文件夹，至少包含 `config.json` 和 `soul.md`。</p>
                </div>

                <div className="role-toolbar">
                  <button type="button" className="save-btn" onClick={openCreateRoleEditor}>
                    新建角色
                  </button>
                  <button type="button" className="save-btn secondary-btn" onClick={handleImportRole}>
                    导入角色文件夹
                  </button>
                  <button type="button" className="save-btn ghost-btn" onClick={() => void refreshRoles()}>
                    刷新列表
                  </button>
                </div>

                {(roleMessage || roleError) && (
                  <div className={`role-notice ${roleError ? 'error' : 'success'}`}>
                    {roleError || roleMessage}
                  </div>
                )}

                <div className="path-card">
                  <p>角色仓库路径</p>
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      if (window.electronAPI) {
                        window.electronAPI.openRolesRoot();
                      }
                    }}
                  >
                    {userDataPath}/roles
                  </a>
                  <small>当前启用角色的目录会被打开；你也可以手动把别的角色文件夹放进来再点刷新。</small>
                </div>

                <div className="role-list">
                  {roles.map((role) => (
                    <div key={role.id} className={`role-card ${role.isActive ? 'active' : ''}`}>
                      <div className="role-card-main">
                        <div className="role-avatar">
                          {role.avatarDataUrl ? (
                            <img src={role.avatarDataUrl} alt={role.name} />
                          ) : (
                            <span>{role.name.slice(0, 1)}</span>
                          )}
                        </div>
                        <div className="role-meta">
                          <div className="role-title-row">
                            <strong>{role.name}</strong>
                            {role.isActive && <span className="role-badge">当前启用</span>}
                          </div>
                          <p>{role.description}</p>
                          <small>{role.folderPath}</small>
                        </div>
                      </div>

                      <div className="role-actions">
                        <button
                          type="button"
                          className="save-btn ghost-btn"
                          onClick={() => {
                            if (window.electronAPI) {
                              window.electronAPI.openRoleFolder(role.id);
                            }
                          }}
                        >
                          打开目录
                        </button>
                        <button
                          type="button"
                          className="save-btn ghost-btn"
                          onClick={() => void openEditRoleEditor(role.id)}
                        >
                          编辑角色卡
                        </button>
                        <button
                          type="button"
                          className="save-btn ghost-btn"
                          onClick={() => {
                            if (window.electronAPI) {
                              window.electronAPI.openRoleSoulFile(role.id);
                            }
                          }}
                        >
                          外部编辑
                        </button>
                        <button
                          type="button"
                          className="save-btn ghost-btn"
                          onClick={() => void handleExportRole(role.id)}
                        >
                          导出
                        </button>
                        <button
                          type="button"
                          className="save-btn"
                          onClick={() => void handleEnableRole(role.id)}
                          disabled={role.isActive}
                        >
                          {role.isActive ? '已启用' : '启用角色'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {roleEditorOpen && (
                  <div className="role-editor-card">
                    <div className="section-heading">
                      <h3>{roleForm.roleId ? '编辑角色' : '新建角色'}</h3>
                      <p>在这里直接编辑角色名称、简介、头像和 `soul.md` 内容。</p>
                    </div>

                    {roleEditorLoading ? (
                      <div className="role-editor-loading">正在加载角色内容...</div>
                    ) : (
                      <>
                        <div className="role-editor-grid">
                          <div className="form-group">
                            <label>角色名称</label>
                            <input
                              type="text"
                              value={roleForm.name}
                              onChange={(e) => setRoleForm(prev => ({ ...prev, name: e.target.value }))}
                              placeholder="例如：Vex Noir"
                            />
                          </div>

                          <div className="form-group">
                            <label>角色简介</label>
                            <input
                              type="text"
                              value={roleForm.description}
                              onChange={(e) => setRoleForm(prev => ({ ...prev, description: e.target.value }))}
                              placeholder="一句话说明这个角色的风格与定位"
                            />
                          </div>
                        </div>

                        <div className="form-group">
                          <label>角色头像</label>
                          <div className="role-image-row">
                            <div className="role-editor-avatar">
                              {roleForm.imagePreview ? (
                                <img src={roleForm.imagePreview} alt={roleForm.name || '角色头像'} />
                              ) : (
                                <span>{(roleForm.name || '角').slice(0, 1)}</span>
                              )}
                            </div>
                            <div className="role-image-actions">
                              <button type="button" className="save-btn ghost-btn" onClick={handlePickRoleImage}>
                                选择图片
                              </button>
                              <small className="field-hint">
                                {roleForm.imageSourcePath || '未选择新图片时，将保留当前头像。'}
                              </small>
                            </div>
                          </div>
                        </div>

                        <div className="form-group">
                          <label>灵魂设定 (`soul.md`)</label>
                          <textarea
                            className="role-soul-editor"
                            value={roleForm.soulContent}
                            onChange={(e) => setRoleForm(prev => ({ ...prev, soulContent: e.target.value }))}
                            placeholder="在这里写角色设定、说话风格和规则"
                            rows={14}
                          />
                        </div>

                        <div className="role-editor-actions">
                          <button
                            type="button"
                            className="save-btn ghost-btn"
                            onClick={resetRoleEditor}
                            disabled={roleSaving}
                          >
                            取消
                          </button>
                          <button
                            type="button"
                            className="save-btn"
                            onClick={() => void handleSaveRole()}
                            disabled={roleSaving}
                          >
                            {roleSaving ? '保存中...' : roleForm.roleId ? '保存角色' : '创建角色'}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              <div className="settings-section">
                <div className="section-heading">
                  <h3>调试与维护</h3>
                  <p>查看日志、排查问题或清理历史数据时用。</p>
                </div>

                <div className="checkbox-row">
                  <input
                    type="checkbox"
                    id="debug_mode"
                    checked={isDebugMode}
                    onChange={e => setIsDebugMode(e.target.checked)}
                    style={{ width: 'auto' }}
                  />
                  <label htmlFor="debug_mode">开启调试模式 (Console 打印详细日志)</label>
                </div>

                <div className="danger-zone">
                  <button
                    onClick={() => {
                      if (window.confirm('确定要清空所有的聊天记忆吗？')) {
                        localStorage.removeItem('chat_history');
                        localStorage.removeItem('chat_threads');
                        localStorage.removeItem('active_chat_thread_id');
                        localStorage.removeItem('story_messages');
                        localStorage.removeItem('story_mode_enabled');
                        localStorage.removeItem('story_mode_locked');
                        window.location.reload();
                      }
                    }}
                    className="save-btn danger-btn"
                  >
                    清空聊天记忆
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="settings-footer">
          <button onClick={handleSave} className="save-btn footer-save-btn">
            {saved ? '已保存！' : '保存全部设置'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Settings;
