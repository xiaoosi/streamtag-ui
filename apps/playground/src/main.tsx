import { StrictMode, useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { getComponentDescriptions, StreamRenderer } from 'streamtag-ui';
import type { StreamIssue } from 'streamtag-ui';
import report from '../../../fixtures/revenue-report.xml?raw';
import errors from '../../../fixtures/component-errors.xml?raw';
import tailwind from '../../../fixtures/tailwind-dashboard.xml?raw';
import { components as reportComponents } from './components';
import { components as tailwindComponents } from '../../../examples/tailwind-react/src/components';
import { useReplay } from './replay/useReplay';
import './tailwind.css';
import './styles.css';

const examples = {
  report: {
    label: 'Revenue report',
    note: 'CSS layout · ECharts · React table',
    source: report,
    components: reportComponents,
  },
  tailwind: {
    label: 'Team overview · Tailwind',
    note: 'Tailwind CSS · React activity feed',
    source: tailwind,
    components: tailwindComponents,
  },
  errors: {
    label: 'Error isolation',
    note: 'Invalid component props · Sibling content preserved',
    source: errors,
    components: reportComponents,
  },
};

function Playground() {
  const [exampleId, setExampleId] = useState<keyof typeof examples>('report');
  const example = examples[exampleId];
  const [source, setSource] = useState(report);
  const [mode, setMode] = useState<'markup' | 'catalog' | 'issues'>('markup');
  const [issues, setIssues] = useState<StreamIssue[]>([]);
  const [generation, setGeneration] = useState(0);
  const replay = useReplay(source);
  const receivedText = useRef<HTMLPreElement>(null);
  useEffect(() => {
    if (receivedText.current)
      receivedText.current.scrollTop = receivedText.current.scrollHeight;
  }, [replay.content, mode]);
  const onError = useCallback(
    (issue: StreamIssue) =>
      setIssues((previous) =>
        previous.some(
          (existing) =>
            existing.code === issue.code &&
            existing.message === issue.message &&
            existing.nodeId === issue.nodeId,
        )
          ? previous
          : [...previous, issue],
      ),
    [],
  );
  const reset = () => {
    replay.reset();
    setIssues([]);
    setGeneration((value) => value + 1);
  };
  const load = (text: string) => {
    reset();
    setSource(text);
  };
  const status = replay.finished
    ? 'Complete'
    : replay.playing
      ? 'Streaming'
      : replay.cursor > 0
        ? 'Paused'
        : 'Ready to stream';
  const progress = source.length
    ? Math.round((replay.cursor / source.length) * 100)
    : 0;

  return (
    <div className="app-shell">
      <header className="topbar">
        <a href="./" className="brand" aria-label="StreamTag UI home">
          StreamTag UI
        </a>
        <span className="header-divider" />
        <span className="header-context">Playground</span>
      </header>
      <main>
        <section className="page-heading">
          <div>
            <h1>Streaming playground</h1>
            <p>
              Edit the markup. Watch your components update as text arrives.
            </p>
          </div>
          <span className="replay-label">
            <span />
            Local text replay
          </span>
        </section>
        <section className="workspace" aria-label="Streaming playground">
          <div className="toolbar">
            <div className="sample-select">
              <label htmlFor="example-select">Example</label>
              <select
                id="example-select"
                aria-label="Example"
                value={exampleId}
                onChange={(event) => {
                  const id = event.target.value as keyof typeof examples;
                  setExampleId(id);
                  setMode('markup');
                  load(examples[id].source);
                }}
              >
                {Object.entries(examples).map(([id, item]) => (
                  <option key={id} value={id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="playback">
              <button className="text-button" onClick={reset}>
                Reset
              </button>
              <button className="secondary-button" onClick={replay.complete}>
                Show complete
              </button>
              <button
                className="primary-button"
                onClick={() => {
                  if (replay.playing) replay.pause();
                  else {
                    if (replay.finished) {
                      setIssues([]);
                      setGeneration((value) => value + 1);
                    }
                    replay.play();
                  }
                }}
              >
                <span className="play-icon" aria-hidden="true">
                  {replay.playing ? 'Ⅱ' : replay.finished ? '↻' : '▶'}
                </span>
                {replay.playing
                  ? 'Pause'
                  : replay.finished
                    ? 'Replay'
                    : 'Play stream'}
              </button>
            </div>
          </div>
          <div className="workspace-body">
            <section className="source-panel" aria-label="Stream inspector">
              <div
                className="panel-tabs"
                role="group"
                aria-label="Inspector views"
              >
                <button
                  id="tab-markup"
                  aria-pressed={mode === 'markup'}
                  aria-controls="inspector-content"
                  className={mode === 'markup' ? 'active' : ''}
                  onClick={() => setMode('markup')}
                >
                  Markup
                </button>
                <button
                  id="tab-catalog"
                  aria-pressed={mode === 'catalog'}
                  aria-controls="inspector-content"
                  className={mode === 'catalog' ? 'active' : ''}
                  onClick={() => setMode('catalog')}
                >
                  Model instructions
                </button>
                <button
                  id="tab-issues"
                  aria-pressed={mode === 'issues'}
                  aria-controls="inspector-content"
                  className={mode === 'issues' ? 'active' : ''}
                  onClick={() => setMode('issues')}
                >
                  Issues
                  {issues.length > 0 && (
                    <span className="issue-count">{issues.length}</span>
                  )}
                </button>
              </div>
              <div
                id="inspector-content"
                className="inspector-content"
                role="region"
                aria-labelledby={`tab-${mode}`}
              >
                {mode === 'markup' ? (
                  <>
                    <div className="source-heading">
                      <span>Source markup</span>
                      <span>XML</span>
                    </div>
                    <textarea
                      aria-label="Source markup"
                      spellCheck={false}
                      value={source}
                      onChange={(event) => load(event.target.value)}
                    />
                    <div className="received-label">
                      <span>Received so far</span>
                      <span>
                        {replay.cursor.toLocaleString()} /{' '}
                        {source.length.toLocaleString()} chars
                      </span>
                    </div>
                    <pre
                      ref={receivedText}
                      className="received-text"
                      data-testid="received-text"
                    >
                      {replay.content || 'Waiting for the first chunk…'}
                    </pre>
                  </>
                ) : mode === 'catalog' ? (
                  <pre className="instructions">
                    {getComponentDescriptions(example.components)}
                  </pre>
                ) : (
                  <div className="issue-list">
                    {issues.length ? (
                      issues.map((issue, index) => (
                        <div className="issue" key={index}>
                          <strong>{issue.code}</strong>
                          <p>{issue.message}</p>
                        </div>
                      ))
                    ) : (
                      <div className="no-issues">
                        <h3>All clear.</h3>
                        <p>
                          Syntax and component diagnostics will appear here.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="stream-controls">
                <label>
                  Chunk size
                  <select
                    aria-label="Chunk size"
                    value={replay.chunkSize}
                    onChange={(event) =>
                      replay.setChunkSize(Number(event.target.value))
                    }
                  >
                    <option value="1">1 character</option>
                    <option value="12">12 characters</option>
                    <option value="48">48 characters</option>
                    <option value="160">160 characters</option>
                  </select>
                </label>
                <label>
                  Speed
                  <select
                    aria-label="Playback speed"
                    value={replay.interval}
                    onChange={(event) =>
                      replay.setIntervalMs(Number(event.target.value))
                    }
                  >
                    <option value="100">Slow</option>
                    <option value="24">Normal</option>
                    <option value="4">Fast</option>
                  </select>
                </label>
                <div>
                  <button
                    className="text-button"
                    onClick={replay.step}
                    disabled={replay.playing || replay.finished}
                  >
                    Step
                  </button>
                  <button
                    className="text-button"
                    onClick={replay.finishHere}
                    disabled={replay.finished}
                  >
                    End here
                  </button>
                </div>
              </div>
            </section>
            <section className="preview-panel" aria-label="Rendered preview">
              <div className="preview-heading">
                <span>Preview</span>
                <span
                  className={`stream-status ${replay.playing ? 'is-live' : ''}`}
                  role="status"
                >
                  <i />
                  {status}
                </span>
              </div>
              <div className="preview-scroll">
                {replay.cursor === 0 ? (
                  <div className="empty-preview">
                    <span className="empty-code" aria-hidden="true">
                      &lt; / &gt;
                    </span>
                    <h2>No output yet</h2>
                    <p>
                      Play the stream or step through individual chunks.
                      <br />
                      The rendered interface will appear here.
                    </p>
                  </div>
                ) : (
                  <StreamRenderer
                    key={generation}
                    components={example.components}
                    content={replay.content}
                    streaming={!replay.finished}
                    onError={onError}
                  />
                )}
              </div>
              <div className="preview-caption">
                <span>{example.note}</span>
                <span>{progress}%</span>
              </div>
              <div
                className="progress-track"
                role="progressbar"
                aria-label="Stream progress"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress}
              >
                <div style={{ width: `${progress}%` }} />
              </div>
            </section>
          </div>
        </section>
      </main>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Playground />
  </StrictMode>,
);
