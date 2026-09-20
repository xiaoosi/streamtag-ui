import { useEffect, useState } from 'react';

/** Replay raw text chunks, including splits inside numbers, attributes, and closing tags. */
export function useReplay(source: string) {
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [chunkSize, setChunkSize] = useState(12);
  const [interval, setIntervalMs] = useState(24);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      setCursor((previous) => Math.min(source.length, previous + chunkSize));
    }, interval);
    return () => window.clearInterval(timer);
  }, [playing, source, chunkSize, interval]);

  useEffect(() => {
    if (cursor >= source.length && source.length > 0) {
      setPlaying(false);
      setFinished(true);
    }
  }, [cursor, source]);

  return {
    content: source.slice(0, cursor),
    cursor,
    playing,
    finished,
    chunkSize,
    setChunkSize,
    interval,
    setIntervalMs,
    play: () => {
      if (finished) {
        setCursor(0);
        setFinished(false);
      }
      setPlaying(true);
    },
    pause: () => setPlaying(false),
    reset: () => {
      setCursor(0);
      setPlaying(false);
      setFinished(false);
    },
    complete: () => {
      setCursor(source.length);
      setPlaying(false);
      setFinished(true);
    },
    finishHere: () => {
      setPlaying(false);
      setFinished(true);
    },
    step: () =>
      setCursor((previous) => Math.min(source.length, previous + chunkSize)),
  };
}
