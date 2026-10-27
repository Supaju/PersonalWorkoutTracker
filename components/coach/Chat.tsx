"use client";

import { useEffect, useRef, useState } from "react";
import type { CoachMessage, CoachAction } from "./types";
import { parseAction, api } from "./types";
import ActionCard from "./ActionCard";

type Props = {
  prefill?: string;
  quickPrompts?: string[];
  externalSend?: { text: string; nonce: number } | null;
};

type MessageWithTemp = CoachMessage & { pending?: boolean; failed?: boolean };

export default function Chat({ prefill, quickPrompts, externalSend }: Props) {
  const [messages, setMessages] = useState<MessageWithTemp[]>([]);
  const [input, setInput] = useState(prefill || "");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const externalSendRef = useRef(externalSend?.nonce ?? -1);

  const defaultQuickPrompts = [
    "Plan today",
    "Feeling good, let's go",
    "I only have 40 minutes",
    "Can we change things up?",
  ];

  const prompts = quickPrompts ?? defaultQuickPrompts;

  // Load messages on mount
  useEffect(() => {
    const load = async () => {
      try {
        const data = await api<CoachMessage[]>("/api/coach/messages?limit=50");
        setMessages(data);
      } catch (e) {
        console.error("Failed to load messages:", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Handle external send
  useEffect(() => {
    if (
      externalSend &&
      externalSend.nonce !== externalSendRef.current &&
      externalSend.text
    ) {
      externalSendRef.current = externalSend.nonce;
      send(externalSend.text);
    }
  }, [externalSend]);

  // Auto-scroll to bottom
  useEffect(() => {
    sentinelRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  // Auto-grow textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      const scrollHeight = textareaRef.current.scrollHeight;
      const clampedHeight = Math.min(scrollHeight, 16 * 4); // 4 rows max at 16px
      textareaRef.current.style.height = `${clampedHeight}px`;
    }
  }, [input]);

  const send = async (text: string) => {
    if (!text.trim() || sending) return;

    const tempId = `temp-${Date.now()}`;
    const tempMessage: MessageWithTemp = {
      id: tempId,
      role: "user",
      content: text,
      action: null,
      sessionId: null,
      proposalId: null,
      createdAt: new Date().toISOString(),
      pending: true,
    };

    setMessages((prev) => [...prev, tempMessage]);
    setInput("");
    setSending(true);

    try {
      const result = await api<{
        messages: [CoachMessage, CoachMessage];
      }>("/api/coach/messages", { text });

      setMessages((prev) => {
        const withoutTemp = prev.filter((m) => m.id !== tempId);
        return [...withoutTemp, ...result.messages];
      });
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "Unknown error";
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId
            ? { ...m, pending: false, failed: true }
            : m
        )
      );
      console.error("Failed to send message:", errorMessage);
    } finally {
      setSending(false);
    }
  };

  const retry = (failedId: string, text: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== failedId));
    send(text);
  };

  const handleSend = () => {
    send(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleQuickPrompt = (prompt: string) => {
    send(prompt);
  };

  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="text-center text-[var(--color-text-faint)] text-sm">
            Loading messages...
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center text-[var(--color-text-faint)] text-sm py-12">
            Say hi, or tell me how you're feeling today.
          </div>
        ) : (
          <>
            {messages.map((msg) => {
              const isUser = msg.role === "user";
              const action = msg.action ? parseAction(msg.action) : null;
              const isFailed = msg.failed;

              return (
                <div key={msg.id}>
                  <div
                    className={`flex gap-2 ${
                      isUser ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[85%] p-3 rounded text-sm break-words whitespace-pre-wrap ${
                        isUser
                          ? "bg-[var(--color-accent)] text-white"
                          : "bg-[var(--color-surface)] border border-[var(--color-border)]"
                      } ${isFailed ? "text-[var(--color-accent)]" : ""}`}
                    >
                      {msg.content}
                      {isFailed && (
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-xs">Failed to send — </span>
                          <button
                            onClick={() => retry(msg.id, msg.content)}
                            className="text-xs underline hover:no-underline"
                          >
                            Retry
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div
                    className={`text-xs text-[var(--color-text-faint)] mt-1 ${
                      isUser ? "text-right" : "text-left"
                    }`}
                  >
                    {new Date(msg.createdAt).toLocaleTimeString(undefined, {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                  {!isUser && action && (
                    <div className="mt-2">
                      <ActionCard action={action} />
                    </div>
                  )}
                </div>
              );
            })}
            {sending && (
              <div className="flex gap-2 justify-start">
                <div className="bg-[var(--color-surface)] border border-[var(--color-border)] p-3 rounded text-sm text-[var(--color-text)]">
                  Coach is thinking…
                </div>
              </div>
            )}
            <div ref={sentinelRef} />
          </>
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-[var(--color-border)] bg-[var(--color-bg)] p-4 space-y-3">
        {/* Quick prompts */}
        {prompts.length > 0 && (
          <div className="flex overflow-x-auto gap-2 pb-2">
            {prompts.map((prompt) => (
              <button
                key={prompt}
                onClick={() => handleQuickPrompt(prompt)}
                disabled={sending}
                className="chip whitespace-nowrap shrink-0 disabled:opacity-50"
              >
                {prompt}
              </button>
            ))}
          </div>
        )}

        {/* Input and send */}
        <div className="flex gap-3">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            rows={1}
            className="input flex-1 resize-none"
            style={{
              minHeight: "44px",
              maxHeight: "64px",
              fontSize: "16px",
            }}
            disabled={sending}
          />
          <button
            onClick={handleSend}
            disabled={sending || !input.trim()}
            className="btn-accent min-h-[44px] whitespace-nowrap"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
