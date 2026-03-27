import { useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { BackendMessage } from "@/types";

type MessageHandler = (msg: BackendMessage) => void;

let messageIdCounter = 0;

export function useBackend(onMessage: MessageHandler) {
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    // Start Python backend
    invoke("start_backend").catch((e) => {
      console.error("Failed to start backend:", e);
    });

    // Listen for backend messages
    const unlisten = listen<string>("backend-message", (event) => {
      try {
        const msg: BackendMessage = JSON.parse(event.payload);
        onMessageRef.current(msg);
      } catch (e) {
        console.error("Failed to parse backend message:", e);
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const send = useCallback(
    async (method: string, params: Record<string, unknown> = {}) => {
      const id = ++messageIdCounter;
      const message = JSON.stringify({ id, method, params });
      await invoke("send_to_backend", { message });
      return id;
    },
    []
  );

  return { send };
}
