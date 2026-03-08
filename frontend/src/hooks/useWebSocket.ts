import { useRef, useCallback, useEffect } from "react";

export type JsonMessage =
  | { type: "session_started" }
  | { type: "session_stopped" }
  | { type: "transcript_in"; text: string }
  | { type: "transcript_out"; text: string }
  | { type: "phase"; phase: string }
  | { type: "illustration"; image: string; mime: string; title: string }
  | { type: "interrupted" };

interface UseWebSocketOpts {
  onAudio: (data: ArrayBuffer) => void;
  onMessage: (msg: JsonMessage) => void;
  onOpen: () => void;
  onClose: () => void;
}

export function useWebSocket({ onAudio, onMessage, onOpen, onClose }: UseWebSocketOpts) {
  const wsRef = useRef<WebSocket | null>(null);

  const connect = useCallback(() => {
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${proto}//${location.host}/ws/story`;
    const ws = new WebSocket(url);
    ws.binaryType = "arraybuffer";

    ws.onopen = () => onOpen();
    ws.onclose = () => onClose();

    ws.onmessage = (e) => {
      if (e.data instanceof ArrayBuffer) {
        onAudio(e.data);
      } else {
        try {
          onMessage(JSON.parse(e.data));
        } catch {
          // ignore malformed JSON
        }
      }
    };

    wsRef.current = ws;
  }, [onAudio, onMessage, onOpen, onClose]);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
  }, []);

  const sendBinary = useCallback((data: ArrayBuffer) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(data);
    }
  }, []);

  const sendJson = useCallback((msg: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      wsRef.current?.close();
    };
  }, []);

  return { connect, disconnect, sendBinary, sendJson };
}
