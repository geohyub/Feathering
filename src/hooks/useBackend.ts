import { useCallback, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { BackendMessage } from "@/types";

type MessageHandler = (msg: BackendMessage) => void;

let messageIdCounter = 0;
let backendStartPromise: Promise<void> | null = null;
let backendListenerPromise: Promise<UnlistenFn> | null = null;
const subscribers = new Set<MessageHandler>();

function dispatchMessage(msg: BackendMessage) {
  for (const subscriber of subscribers) {
    subscriber(msg);
  }
}

async function ensureBackendStarted() {
  if (!backendStartPromise) {
    backendStartPromise = invoke("start_backend")
      .then(() => undefined)
      .catch((error) => {
        backendStartPromise = null;
        throw error;
      });
  }

  if (!backendListenerPromise) {
    backendListenerPromise = listen<string>("backend-message", (event) => {
      try {
        const msg: BackendMessage = JSON.parse(event.payload);
        dispatchMessage(msg);
      } catch (error) {
        console.error("Failed to parse backend message:", error);
      }
    }).catch((error) => {
      backendListenerPromise = null;
      throw error;
    });
  }

  await Promise.all([backendStartPromise, backendListenerPromise]);
}

export function useBackend(onMessage: MessageHandler) {
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    const subscriber: MessageHandler = (message) => {
      onMessageRef.current(message);
    };

    subscribers.add(subscriber);
    ensureBackendStarted().catch((error) => {
      console.error("Failed to start backend:", error);
    });

    return () => {
      subscribers.delete(subscriber);
    };
  }, []);

  const send = useCallback(
    async (method: string, params: Record<string, unknown> = {}) => {
      await ensureBackendStarted();
      const id = ++messageIdCounter;
      const message = JSON.stringify({ id, method, params });
      await invoke("send_to_backend", { message });
      return id;
    },
    []
  );

  return { send };
}
