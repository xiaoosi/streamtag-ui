import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  ChartNoAxesCombined,
  Check,
  ChevronDown,
  Code2,
  Copy,
  ListChecks,
  LoaderCircle,
  MapPin,
  Menu,
  MessageSquare,
  Plus,
  RotateCcw,
  Square,
  X,
} from 'lucide-react';
import { StreamRenderer, type StreamIssue } from 'streamtag-ui';
import { components } from './components/GeneratedComponents';
import {
  loadConversations,
  modelHistory,
  newConversation,
  persistConversations,
  type Message,
} from './lib/conversations';
import { streamChat } from './lib/chat';
import type { ModelOption } from '../shared/protocol';

const suggestions = [
  {
    icon: ChartNoAxesCombined,
    title: '帮我分析上半年的经营情况',
    label: '一起看数据',
    prompt:
      '帮我分析上半年的经营情况：1–6 月收入分别为 58、62、71、68、85、96 万元，成本分别为 32、35、39、38、43、47 万元。把收入和成本画成两条折线，列出每月利润，并告诉我你发现了什么。',
  },
  {
    icon: MapPin,
    title: '周末去杭州，怎么玩比较好？',
    label: '做个小计划',
    prompt:
      '周末想去杭州玩两天，喜欢咖啡、书店和自然风景，不想太赶。你有什么建议？给我一个大致行程和可以勾选的出行清单。',
  },
  {
    icon: ListChecks,
    title: '第一次开源，需要准备什么？',
    label: '把想法落地',
    prompt:
      '我准备把一个 React 流式渲染库开源，已经有可以运行的 demo。第一次做开源，你觉得最应该先准备什么？帮我排个优先级，做成可勾选的清单。',
  },
];

function AssistantReply({
  message,
  model,
  latest,
  busy,
  onRetry,
}: {
  message: Message;
  model?: string;
  latest: boolean;
  busy: boolean;
  onRetry: () => void;
}) {
  const [issues, setIssues] = useState<StreamIssue[]>([]);
  const [source, setSource] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState('');
  const onError = useCallback(
    (issue: StreamIssue) =>
      setIssues((current) => [...current, issue].slice(-30)),
    [],
  );
  const streaming = message.status === 'streaming';
  async function copy() {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setCopyError('');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyError('无法访问剪贴板，可以在源码中手动复制。');
      setSource(true);
    }
  }
  return (
    <article
      className="assistant-message"
      data-testid="assistant-message"
      data-status={message.status}
    >
      <div className="assistant-heading">
        <span className="agent-avatar">
          <Code2 size={16} />
        </span>
        <strong>助手</strong>
        <span className="reply-model">{model || message.model}</span>
      </div>
      <div className="assistant-body">
        {message.content ? (
          <>
            <div
              hidden={source}
              className="rendered-page"
              data-testid="rendered-reply"
            >
              <StreamRenderer
                components={components}
                content={message.content}
                streaming={streaming}
                onError={onError}
              />
            </div>
            {source && (
              <div className="reply-source">
                <div>
                  <Code2 size={12} />
                  这条回复的原始输出
                </div>
                <pre data-testid="source-code">
                  <code>{message.content}</code>
                </pre>
              </div>
            )}
          </>
        ) : streaming ? (
          <div className="thinking">
            <span />
            <span />
            <span />
            <p>正在组织回答</p>
          </div>
        ) : null}
        {streaming && message.content && (
          <div className="reply-streaming">
            <LoaderCircle className="spin" size={12} />
            正在回复…
          </div>
        )}
        {message.error && (
          <p className="reply-error" role="alert">
            {message.error}
          </p>
        )}
        {message.status === 'stopped' && (
          <p className="reply-note">
            已停止回复{message.content ? '，收到的内容已保留。' : '。'}
          </p>
        )}
        {message.status === 'truncated' && (
          <p className="reply-error">
            回复达到模型输出上限，内容可能不完整。可以继续追问。
          </p>
        )}
        {issues.length > 0 && !streaming && (
          <details className="diagnostics">
            <summary>渲染提示 · {issues.length}</summary>
            {issues.map((issue, index) => (
              <p key={index}>
                <code>{issue.code}</code> {issue.message}
              </p>
            ))}
          </details>
        )}
        <div className="reply-actions">
          {message.content && (
            <>
              <button
                className={source ? 'active' : ''}
                onClick={() => setSource(!source)}
                aria-label={source ? '查看渲染后的回复' : '查看回复源码'}
              >
                <Code2 size={13} />
                {source ? '查看回复' : '源码'}
              </button>
              <button onClick={() => void copy()} aria-label="复制回复源码">
                {copied ? <Check size={13} /> : <Copy size={13} />}
              </button>
            </>
          )}
          {latest && !busy && (
            <button onClick={onRetry}>
              <RotateCcw size={12} />
              重新回答
            </button>
          )}
          {!streaming && message.elapsedMs && (
            <span>{(message.elapsedMs / 1000).toFixed(1)} 秒</span>
          )}
        </div>
        {copyError && <p className="reply-note">{copyError}</p>}
      </div>
    </article>
  );
}

export function App() {
  const [conversations, setConversations] = useState(loadConversations);
  const [activeId, setActiveId] = useState(conversations[0]!.id);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [modelError, setModelError] = useState('');
  const [storageError, setStorageError] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [atBottom, setAtBottom] = useState(true);
  const abortRef = useRef<AbortController | null>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const chatScroll = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const active = conversations.find(
    (conversation) => conversation.id === activeId,
  )!;
  const busy = active.messages.some(
    (message) => message.status === 'streaming',
  );
  const currentModel = models.find((model) => model.id === active.model);
  const latest = active.messages.at(-1);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/models', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('模型配置加载失败，请检查本地服务。');
        const data = (await response.json()) as {
          models: ModelOption[];
          defaultModel: string;
        };
        setModels(data.models);
        setConversations((current) =>
          current.map((item) =>
            data.models.some((model) => model.id === item.model)
              ? item
              : { ...item, model: data.defaultModel },
          ),
        );
      })
      .catch((error: Error) => {
        if (!controller.signal.aborted) setModelError(error.message);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        persistConversations(conversations);
        setStorageError(false);
      } catch {
        setStorageError(true);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [conversations]);

  useLayoutEffect(() => {
    if (stickToBottom.current && chatScroll.current)
      chatScroll.current.scrollTop = chatScroll.current.scrollHeight;
  }, [active.messages.length, latest?.content, latest?.status, activeId]);
  useEffect(() => () => abortRef.current?.abort(), []);
  useEffect(() => {
    if (textarea.current) {
      textarea.current.style.height = 'auto';
      textarea.current.style.height = `${Math.min(textarea.current.scrollHeight, 180)}px`;
    }
  }, [prompt]);

  async function generate(text: string, retry = false) {
    if (abortRef.current || !active.model || (!retry && !text.trim())) return;
    const conversationId = activeId;
    const base = retry
      ? active.messages.slice(0, -1)
      : [
          ...active.messages,
          {
            id: crypto.randomUUID(),
            role: 'user' as const,
            content: text.trim(),
            status: 'complete' as const,
            chunks: 0,
          },
        ];
    const assistant: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      status: 'streaming',
      model: active.model,
      chunks: 0,
    };
    const controller = new AbortController();
    abortRef.current = controller;
    setPrompt('');
    setSidebarOpen(false);
    stickToBottom.current = true;
    setConversations((current) =>
      current.map((item) =>
        item.id === conversationId
          ? {
              ...item,
              messages: [...base, assistant],
              updatedAt: Date.now(),
              title:
                base
                  .find((message) => message.role === 'user')
                  ?.content.slice(0, 24) || item.title,
            }
          : item,
      ),
    );
    const update = (changes: Partial<Message>) =>
      setConversations((current) =>
        current.map((item) =>
          item.id === conversationId
            ? {
                ...item,
                messages: item.messages.map((message) =>
                  message.id === assistant.id
                    ? { ...message, ...changes }
                    : message,
                ),
              }
            : item,
        ),
      );
    let content = '',
      chunks = 0,
      frame = 0;
    const started = performance.now();
    const flush = () => {
      frame = 0;
      update({ content, chunks });
    };
    try {
      await streamChat(
        {
          model: active.model,
          sessionId: activeId,
          messages: modelHistory(base),
        },
        controller.signal,
        (event) => {
          if (event.type === 'delta') {
            content += event.text;
            chunks += 1;
            if (!frame) frame = requestAnimationFrame(flush);
          }
          if (event.type === 'done') {
            cancelAnimationFrame(frame);
            frame = 0;
            update({
              content,
              chunks,
              elapsedMs: event.elapsedMs,
              status:
                event.finishReason === 'length' ? 'truncated' : 'complete',
            });
          }
        },
      );
    } catch (error) {
      cancelAnimationFrame(frame);
      update({
        content,
        chunks,
        elapsedMs: performance.now() - started,
        status: controller.signal.aborted ? 'stopped' : 'error',
        error: controller.signal.aborted
          ? undefined
          : error instanceof Error
            ? error.message
            : '回复失败，请重试。',
      });
    } finally {
      abortRef.current = null;
    }
  }

  function startConversation() {
    if (busy) return;
    const conversation = newConversation(active.model);
    setConversations((current) =>
      [conversation, ...current.filter((item) => item.messages.length)].slice(
        0,
        12,
      ),
    );
    setActiveId(conversation.id);
    setPrompt('');
    setSidebarOpen(false);
    stickToBottom.current = true;
    textarea.current?.focus();
  }

  return (
    <div className="app-shell">
      {sidebarOpen && (
        <button
          className="sidebar-backdrop"
          aria-label="关闭对话列表"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside
        className={`sidebar ${sidebarOpen ? 'open' : ''}`}
        aria-label="对话列表"
      >
        <div className="sidebar-brand">
          <span>
            StreamTag <em>Chat</em>
          </span>
          <button
            className="icon-button mobile-only"
            aria-label="关闭侧栏"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={17} />
          </button>
        </div>
        <button
          className="new-chat"
          onClick={startConversation}
          disabled={busy}
        >
          <Plus size={16} />
          新对话
        </button>
        <div className="history-label">最近对话</div>
        <nav className="conversation-list" aria-label="历史对话">
          {conversations
            .filter((item) => item.messages.length)
            .map((conversation) => (
              <button
                key={conversation.id}
                disabled={busy}
                className={conversation.id === activeId ? 'active' : ''}
                onClick={() => {
                  setActiveId(conversation.id);
                  setPrompt('');
                  setSidebarOpen(false);
                  stickToBottom.current = true;
                }}
              >
                <MessageSquare size={14} />
                <span>{conversation.title}</span>
              </button>
            ))}
          {!conversations.some((item) => item.messages.length) && (
            <p className="empty-history">聊过的话题会留在这里。</p>
          )}
        </nav>
        <a
          className="sidebar-footer"
          href="https://www.npmjs.com/package/streamtag-ui"
          target="_blank"
          rel="noreferrer"
        >
          <Code2 size={14} />
          <span>由 StreamTag UI 渲染</span>
          <ArrowUpRight size={12} />
        </a>
      </aside>
      <main className="chat-main">
        <header className="chat-header">
          <button
            className="icon-button mobile-only"
            aria-label="打开对话列表"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={19} />
          </button>
          <h1>{active.messages.length ? active.title : '新对话'}</h1>
          <span className="chat-header-status">
            <i className={busy ? 'live' : ''} />
            {busy ? '正在回复' : '对话'}
          </span>
        </header>
        <div
          className="chat-scroll"
          ref={chatScroll}
          onScroll={() => {
            const element = chatScroll.current!;
            const bottom =
              element.scrollHeight - element.scrollTop - element.clientHeight <
              90;
            stickToBottom.current = bottom;
            setAtBottom(bottom);
          }}
        >
          {!active.messages.length ? (
            <div className="welcome">
              <span className="welcome-mark">
                <MessageSquare size={24} strokeWidth={1.6} />
              </span>
              <h2>有什么可以帮你？</h2>
              <p>问问题、聊想法，或者一起分析数据。</p>
              <div className="suggestions">
                {suggestions.map((item) => (
                  <button
                    key={item.title}
                    disabled={!models.length}
                    onClick={() => {
                      setPrompt(item.prompt);
                      textarea.current?.focus();
                    }}
                  >
                    <item.icon size={18} strokeWidth={1.6} />
                    <span>{item.label}</span>
                    <strong>{item.title}</strong>
                    <ArrowUpRight className="suggestion-arrow" size={14} />
                  </button>
                ))}
              </div>
              <p className="welcome-footnote">
                不止文字，回答也可以是图表、表格和可以交互的小组件。
              </p>
            </div>
          ) : (
            <div className="message-list">
              {active.messages.map((message) =>
                message.role === 'user' ? (
                  <article className="user-message" key={message.id}>
                    <p>{message.content}</p>
                  </article>
                ) : (
                  <AssistantReply
                    key={message.id}
                    message={message}
                    model={
                      models.find((model) => model.id === message.model)?.label
                    }
                    latest={latest?.id === message.id}
                    busy={busy}
                    onRetry={() => void generate('', true)}
                  />
                ),
              )}
            </div>
          )}
        </div>
        <div className="composer-dock">
          {!atBottom && active.messages.length > 0 && (
            <button
              className="scroll-bottom"
              aria-label="滚动到最新回复"
              onClick={() => {
                stickToBottom.current = true;
                chatScroll.current?.scrollTo({
                  top: chatScroll.current.scrollHeight,
                  behavior: 'smooth',
                });
              }}
            >
              <ArrowDown size={15} />
            </button>
          )}
          <div className="composer-width">
            {(modelError || storageError) && (
              <div className="reply-error" role="alert">
                {modelError || '浏览器存储空间不足，此次对话暂时无法保存。'}
              </div>
            )}
            <form
              className="composer"
              onSubmit={(event) => {
                event.preventDefault();
                void generate(prompt);
              }}
            >
              <textarea
                ref={textarea}
                aria-label="发送消息给助手"
                placeholder={
                  active.messages.length ? '继续聊聊…' : '有什么想问的，尽管说…'
                }
                value={prompt}
                maxLength={8000}
                rows={2}
                onChange={(event) => setPrompt(event.target.value)}
                onKeyDown={(event) => {
                  if (
                    event.key === 'Enter' &&
                    !event.shiftKey &&
                    !event.nativeEvent.isComposing
                  ) {
                    event.preventDefault();
                    void generate(prompt);
                  }
                }}
              />
              <div className="composer-controls">
                <div className="model-select">
                  <span className="model-dot" />
                  <select
                    aria-label="选择模型"
                    value={active.model}
                    disabled={busy || !models.length}
                    onChange={(event) =>
                      setConversations((current) =>
                        current.map((item) =>
                          item.id === activeId
                            ? { ...item, model: event.target.value }
                            : item,
                        ),
                      )
                    }
                  >
                    {!models.length && <option value="">加载模型…</option>}
                    {models.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={12} />
                </div>
                {busy ? (
                  <button
                    className="send-button stop-button"
                    type="button"
                    aria-label="停止回复"
                    title="停止回复"
                    onClick={() => abortRef.current?.abort()}
                  >
                    <Square size={13} fill="currentColor" />
                  </button>
                ) : (
                  <button
                    className="send-button"
                    type="submit"
                    aria-label="发送消息"
                    disabled={!prompt.trim() || !currentModel}
                  >
                    <ArrowUp size={19} />
                  </button>
                )}
              </div>
            </form>
            <div className="composer-footnote">
              <span>回答实时呈现，可继续追问</span>
              <span>Enter 发送 · Shift + Enter 换行</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
