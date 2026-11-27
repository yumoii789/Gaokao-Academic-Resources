'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  DEFAULT_CONFIG,
  fetchModelList,
  getUsage,
  getVisitStats,
  loadAiConfig,
  resetVisitStats,
  saveAiConfig,
} from '@/lib/ai-config';
import type { AiConfig, AiProviderConfig } from '@/lib/ai-config';

const PASS_KEY = 'xiaomo-admin-pass-v1';
const SESSION_KEY = 'xiaomo-admin-session-v1';

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

const card = 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm';
const label = 'block text-xs font-medium text-slate-500 mb-1';
const input = 'w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-400';
const primaryBtn = 'px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors';
const ghostBtn = 'px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors';

function emptyProvider(): AiProviderConfig {
  return { id: 'custom', name: '自定义服务商', baseUrl: '', apiKey: '', models: [], selectedModel: '' };
}

export default function AdminPage() {
  const [ready, setReady] = useState(false);
  const [storedHash, setStoredHash] = useState<string | null>(null);
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [authError, setAuthError] = useState('');

  const [config, setConfig] = useState<AiConfig>(DEFAULT_CONFIG);
  const [newModel, setNewModel] = useState('');
  const [modelError, setModelError] = useState('');
  const [fetching, setFetching] = useState(false);
  const [savedAt, setSavedAt] = useState('');

  const [usage, setUsage] = useState({ count: 0, maxPerDay: 50 });
  const [visits, setVisits] = useState({ pv: 0, firstVisit: '', days: 0 });

  useEffect(() => {
    setStoredHash(window.localStorage.getItem(PASS_KEY));
    setAuthed(window.sessionStorage.getItem(SESSION_KEY) === '1');
    setConfig(loadAiConfig());
    setUsage(getUsage());
    setVisits(getVisitStats());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!savedAt) return;
    const timer = window.setTimeout(() => setSavedAt(''), 3000);
    return () => window.clearTimeout(timer);
  }, [savedAt]);

  async function handleSetPassword() {
    if (password.length < 4) { setAuthError('密码至少 4 位'); return; }
    if (password !== password2) { setAuthError('两次输入的密码不一致'); return; }
    const hash = await sha256(password);
    window.localStorage.setItem(PASS_KEY, hash);
    window.sessionStorage.setItem(SESSION_KEY, '1');
    setStoredHash(hash);
    setAuthed(true);
    setAuthError('');
  }

  async function handleLogin() {
    const hash = await sha256(password);
    if (hash === storedHash) {
      window.sessionStorage.setItem(SESSION_KEY, '1');
      setAuthed(true);
      setAuthError('');
    } else {
      setAuthError('密码不正确');
    }
    setPassword('');
  }

  function handleLogout() {
    window.sessionStorage.removeItem(SESSION_KEY);
    setAuthed(false);
    setPassword('');
  }

  function ensureProvider(): AiProviderConfig {
    return config.customProvider ?? emptyProvider();
  }

  async function handleFetchModels() {
    const provider = ensureProvider();
    if (!provider.baseUrl.trim()) { setModelError('请先填写接口地址'); return; }
    setFetching(true);
    setModelError('');
    try {
      const ids = await fetchModelList(provider.baseUrl.trim(), provider.apiKey.trim());
      setConfig(prev => {
        const p = prev.customProvider ?? emptyProvider();
        const selected = p.selectedModel && ids.includes(p.selectedModel) ? p.selectedModel : ids[0];
        return { ...prev, customProvider: { ...p, models: ids, selectedModel: selected } };
      });
    } catch (error) {
      setModelError((error as Error).message);
    } finally {
      setFetching(false);
    }
  }

  function handleAddModel() {
    const id = newModel.trim();
    if (!id) return;
    if (!ensureProvider().baseUrl.trim()) { setModelError('请先填写接口地址，再添加模型'); return; }
    setConfig(prev => {
      const p = prev.customProvider ?? emptyProvider();
      if (p.models.includes(id)) return prev;
      return { ...prev, customProvider: { ...p, models: [...p.models, id], selectedModel: p.selectedModel || id } };
    });
    setNewModel('');
    setModelError('');
  }

  function handleRemoveModel(id: string) {
    setConfig(prev => {
      if (!prev.customProvider) return prev;
      const models = prev.customProvider.models.filter(m => m !== id);
      return {
        ...prev,
        customProvider: {
          ...prev.customProvider,
          models,
          selectedModel: prev.customProvider.selectedModel === id ? (models[0] ?? '') : prev.customProvider.selectedModel,
        },
      };
    });
  }

  function handleSave() {
    const next: AiConfig = { ...config, maxPerDay: Math.max(1, Math.round(config.maxPerDay) || 50) };
    setConfig(next);
    saveAiConfig(next);
    setUsage(getUsage());
    setSavedAt('已保存 ' + new Date().toLocaleTimeString('zh-CN'));
  }

  function handleRestoreDefault() {
    setConfig({ ...DEFAULT_CONFIG });
    saveAiConfig({ ...DEFAULT_CONFIG });
    setUsage(getUsage());
    setSavedAt('已恢复默认（Pollinations 免费·无需配置）');
  }

  function handleResetVisits() {
    resetVisitStats();
    setVisits(getVisitStats());
  }

  if (!ready) return null;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-2xl space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-slate-800">后台管理</h1>
          <Link href="/" className="text-sm text-indigo-600 hover:underline">← 返回首页</Link>
        </div>

        <p className="text-xs leading-relaxed text-slate-500 rounded-xl bg-white/70 border border-slate-100 px-4 py-3">
          隐私说明：本站为纯静态站点，API Key、管理密码（仅存 SHA-256 哈希）与全部统计只保存在你当前浏览器的本地存储中，不会上传到任何服务器；换设备或清空浏览器数据后需重新配置。
        </p>

        {!authed ? (
          <div className={card + ' space-y-4'}>
            {storedHash ? (
              <>
                <h2 className="font-semibold text-slate-700">管理员登录</h2>
                <div>
                  <label className={label} htmlFor="admin-pass">管理密码</label>
                  <input
                    id="admin-pass"
                    type="password"
                    className={input}
                    value={password}
                    onChange={event => setPassword(event.target.value)}
                    onKeyDown={event => { if (event.key === 'Enter') void handleLogin(); }}
                    placeholder="输入本机管理密码"
                  />
                </div>
                <button className={primaryBtn} onClick={() => void handleLogin()}>登录</button>
                <p className="text-xs text-slate-400">忘记密码？清空浏览器本站数据后即可重新设置。</p>
              </>
            ) : (
              <>
                <h2 className="font-semibold text-slate-700">首次使用：设置管理密码</h2>
                <div>
                  <label className={label} htmlFor="new-pass">密码（至少 4 位）</label>
                  <input
                    id="new-pass"
                    type="password"
                    className={input}
                    value={password}
                    onChange={event => setPassword(event.target.value)}
                  />
                </div>
                <div>
                  <label className={label} htmlFor="new-pass2">确认密码</label>
                  <input
                    id="new-pass2"
                    type="password"
                    className={input}
                    value={password2}
                    onChange={event => setPassword2(event.target.value)}
                    onKeyDown={event => { if (event.key === 'Enter') void handleSetPassword(); }}
                  />
                </div>
                <button className={primaryBtn} onClick={() => void handleSetPassword()}>设置并进入</button>
                <p className="text-xs text-slate-400">密码仅以 SHA-256 哈希存于本浏览器，用于保护本页配置。</p>
              </>
            )}
            {authError && <p className="text-sm text-red-600">{authError}</p>}
          </div>
        ) : (
          <>
            <section className={card + ' space-y-4'}>
              <h2 className="font-semibold text-slate-700">AI 服务配置</h2>
              <p className="text-xs text-slate-500">
                默认使用内置免费服务（Pollinations，无需配置）。配置自定义 OpenAI 兼容服务商后将改走你的服务。
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={label} htmlFor="base-url">接口地址（到版本段前，如 https://api.deepseek.com 或 …/v1）</label>
                  <input
                    id="base-url"
                    className={input}
                    value={config.customProvider?.baseUrl ?? ''}
                    onChange={event => {
                      const value = event.target.value;
                      setConfig(prev => ({
                        ...prev,
                        customProvider: { ...(prev.customProvider ?? emptyProvider()), baseUrl: value },
                      }));
                    }}
                    placeholder="https://api.deepseek.com"
                  />
                </div>
                <div>
                  <label className={label} htmlFor="api-key">API Key（仅存本浏览器）</label>
                  <input
                    id="api-key"
                    type="password"
                    className={input}
                    value={config.customProvider?.apiKey ?? ''}
                    onChange={event => {
                      const value = event.target.value;
                      setConfig(prev => ({
                        ...prev,
                        customProvider: { ...(prev.customProvider ?? emptyProvider()), apiKey: value },
                      }));
                    }}
                    placeholder="sk-…"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button className={ghostBtn} onClick={() => void handleFetchModels()} disabled={fetching}>
                  {fetching ? '获取中…' : '自动获取模型列表'}
                </button>
                <input
                  className={input + ' flex-1 min-w-40'}
                  value={newModel}
                  onChange={event => setNewModel(event.target.value)}
                  onKeyDown={event => { if (event.key === 'Enter') handleAddModel(); }}
                  placeholder="或手动添加模型 id，如 deepseek-chat"
                />
                <button className={ghostBtn} onClick={handleAddModel}>添加</button>
              </div>

              {modelError && <p className="text-sm text-red-600">{modelError}</p>}

              {config.customProvider && config.customProvider.models.length > 0 && (
                <div className="max-h-44 overflow-y-auto rounded-lg border border-slate-100 divide-y divide-slate-50">
                  {config.customProvider.models.map(model => (
                    <label key={model} className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-slate-50">
                      <input
                        type="radio"
                        name="selected-model"
                        checked={config.customProvider?.selectedModel === model}
                        onChange={() => patchSelectedModel(model)}
                      />
                      <span className="flex-1 truncate text-slate-700">{model}</span>
                      <button
                        className="text-xs text-slate-400 hover:text-red-500"
                        onClick={event => { event.preventDefault(); handleRemoveModel(model); }}
                      >
                        删除
                      </button>
                    </label>
                  ))}
                </div>
              )}

              <label className="flex items-start gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={config.includeImages}
                  onChange={event => setConfig(prev => ({ ...prev, includeImages: event.target.checked }))}
                />
                <span>
                  将题目图片随首轮 AI 解析一并发送
                  <span className="block text-xs text-slate-400">消耗更多 token，且要求所选模型支持视觉；关闭时仅发送 OCR 文本。</span>
                </span>
              </label>

              <div className="sm:w-48">
                <label className={label} htmlFor="max-per-day">每日本机 AI 使用上限</label>
                <input
                  id="max-per-day"
                  type="number"
                  min={1}
                  className={input}
                  value={config.maxPerDay}
                  onChange={event => setConfig(prev => ({ ...prev, maxPerDay: Number(event.target.value) || 1 }))}
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button className={primaryBtn} onClick={handleSave}>保存配置</button>
                <button className={ghostBtn} onClick={handleRestoreDefault}>恢复默认</button>
                {savedAt && <span className="text-sm text-emerald-600">{savedAt}</span>}
              </div>
            </section>

            <section className={card + ' space-y-3'}>
              <h2 className="font-semibold text-slate-700">使用统计</h2>
              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                <div className="rounded-xl bg-indigo-50/60 px-4 py-3">
                  <div className="text-xs text-slate-500">今日 AI 使用（本机）</div>
                  <div className="text-lg font-semibold text-indigo-700">{usage.count} / {usage.maxPerDay}</div>
                </div>
                <div className="rounded-xl bg-slate-50 px-4 py-3">
                  <div className="text-xs text-slate-500">累计浏览量 PV（本机）</div>
                  <div className="text-lg font-semibold text-slate-700">{visits.pv}</div>
                </div>
                <div className="rounded-xl bg-slate-50 px-4 py-3">
                  <div className="text-xs text-slate-500">访问天数（本机）</div>
                  <div className="text-lg font-semibold text-slate-700">{visits.days}</div>
                </div>
              </div>
              <p className="text-xs text-slate-400">
                本站为纯静态部署，无法按真实 IP 跨设备汇总：以上为「当前浏览器」的本机近似统计，刷新间隔内不重复计 PV。
                {visits.firstVisit && ' 首次记录：' + new Date(visits.firstVisit).toLocaleString('zh-CN')}
              </p>
              <button className={ghostBtn} onClick={handleResetVisits}>重置访客统计</button>
            </section>

            <div className="flex justify-end">
              <button className={ghostBtn} onClick={handleLogout}>退出登录</button>
            </div>
          </>
        )}
      </div>
    </main>
  );

  function patchSelectedModel(model: string) {
    setConfig(prev => ({
      ...prev,
      customProvider: prev.customProvider ? { ...prev.customProvider, selectedModel: model } : prev.customProvider,
    }));
  }
}
