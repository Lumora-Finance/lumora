"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { Send, ArrowLeft } from "lucide-react";
import { useAuthUser } from "@/components/auth/use-auth-user";
import { cn } from "@/lib/utils";

type Message = { id: string; from: "me" | "them"; text: string; time: string };
type Conversation = {
  id: string;
  name: string;
  commodity: string;
  lastMsg: string;
  time: string;
  unread: number;
  photo?: string;
  messages: Message[];
};

export default function MessagesPage() {
  const { user } = useAuthUser();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [convs, setConvs] = useState<Conversation[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const active = convs.find((c) => c.id === activeId);
  const photoURL = user?.photoURL ?? null;
  const initials = (user?.displayName ?? "Me")
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  function send() {
    if (!input.trim() || !activeId) return;
    setConvs((prev) =>
      prev.map((c) =>
        c.id === activeId
          ? {
              ...c,
              messages: [
                ...c.messages,
                { id: String(Date.now()), from: "me", text: input.trim(), time: "now" },
              ],
              lastMsg: input.trim(),
            }
          : c,
      ),
    );
    setInput("");
    inputRef.current?.focus();
    // Scroll to bottom after state update
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }

  return (
    /*
      The dashboard layout gives us a flex column with a fixed header + scrollable main.
      The messages page needs to fill that main area exactly without scrolling the outer page.
      We use flex + overflow-hidden so the inner lists handle their own scroll.
    */
    <div className="flex h-full overflow-hidden">

      {/* ── Conversation list ───────────────────────────────── */}
      <div
        className={cn(
          "flex w-full shrink-0 flex-col border-r border-line bg-white lg:w-80",
          activeId ? "hidden lg:flex" : "flex",
        )}
      >
        {/* Header */}
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-line px-5">
          <h1 className="text-heading font-medium text-ink">Messages</h1>
          {convs.reduce((acc, c) => acc + c.unread, 0) > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-green px-1.5 font-num text-label font-medium text-paper">
              {convs.reduce((acc, c) => acc + c.unread, 0)}
            </span>
          )}
        </div>

        {/* Scrollable list */}
        <div className="flex-1 overflow-y-auto">
          {convs.map((conv) => (
            <button
              key={conv.id}
              onClick={() => {
                setActiveId(conv.id);
                setConvs((prev) =>
                  prev.map((c) => (c.id === conv.id ? { ...c, unread: 0 } : c)),
                );
              }}
              className={cn(
                "flex w-full items-start gap-3 border-b border-line px-5 py-4 text-left transition-colors hover:bg-sage-soft/30",
                activeId === conv.id && "bg-sage-soft/50",
              )}
            >
              {/* Avatar */}
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-field-soft font-num text-label font-medium text-sage">
                {conv.name[0]}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p
                    className={cn(
                      "truncate text-body font-medium",
                      conv.unread > 0 ? "text-ink" : "text-ink-muted",
                    )}
                  >
                    {conv.name}
                  </p>
                  <span className="shrink-0 font-num text-label text-ink-muted">{conv.time}</span>
                </div>
                <p className="mt-0.5 text-body-sm text-ink-muted">{conv.commodity}</p>
                <p
                  className={cn(
                    "truncate text-body-sm",
                    conv.unread > 0 ? "font-medium text-ink" : "text-ink-muted",
                  )}
                >
                  {conv.lastMsg}
                </p>
              </div>
              {conv.unread > 0 && (
                <span className="mt-1 flex size-5 shrink-0 items-center justify-center rounded-full bg-green font-num text-label font-medium text-paper">
                  {conv.unread}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Thread ─────────────────────────────────────────── */}
      {active ? (
        <div
          className={cn(
            "flex min-w-0 flex-1 flex-col overflow-hidden",
            activeId ? "flex" : "hidden lg:flex",
          )}
        >
          {/* Thread header */}
          <div className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-white px-4">
            <button
              onClick={() => setActiveId(null)}
              aria-label="Back to conversations"
              className="flex size-8 items-center justify-center rounded-full text-ink-muted hover:bg-sage-soft hover:text-ink lg:hidden"
            >
              <ArrowLeft strokeWidth={1.5} className="size-5" />
            </button>
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-field-soft font-num text-label font-medium text-sage">
              {active.name[0]}
            </div>
            <div className="min-w-0">
              <p className="truncate font-medium text-ink">{active.name}</p>
              <p className="text-label text-ink-muted">{active.commodity}</p>
            </div>
          </div>

          {/* Scrollable messages */}
          <div className="flex-1 overflow-y-auto bg-paper px-4 py-5">
            <div className="flex flex-col gap-3">
              {active.messages.map((msg) => {
                const isMe = msg.from === "me";
                return (
                  <div
                    key={msg.id}
                    className={cn("flex gap-2.5", isMe ? "flex-row-reverse" : "flex-row")}
                  >
                    {/* Avatar */}
                    <div className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-field-soft">
                      {isMe ? (
                        photoURL ? (
                          <Image
                            src={photoURL}
                            alt="me"
                            width={28}
                            height={28}
                            className="size-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <span className="font-num text-label text-sage">{initials}</span>
                        )
                      ) : (
                        <span className="font-num text-label font-medium text-sage">
                          {active.name[0]}
                        </span>
                      )}
                    </div>

                    <div
                      className={cn(
                        "flex max-w-[70%] flex-col gap-1",
                        isMe ? "items-end" : "items-start",
                      )}
                    >
                      <div
                        className={cn(
                          "rounded-2xl px-4 py-2.5 text-body-sm leading-relaxed",
                          isMe
                            ? "rounded-tr-sm bg-green text-paper"
                            : "rounded-tl-sm border border-line bg-white text-ink shadow-sm",
                        )}
                      >
                        {msg.text}
                      </div>
                      <span className="font-num text-label text-ink-muted">{msg.time}</span>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input bar */}
          <div className="shrink-0 border-t border-line bg-white px-4 py-3">
            <div className="flex items-center gap-2 rounded-xl border border-line bg-paper px-3 py-2 focus-within:border-green focus-within:ring-2 focus-within:ring-green/20">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send())
                }
                placeholder="Type a message…"
                className="flex-1 bg-transparent text-body text-ink placeholder-ink-muted outline-none"
              />
              <button
                onClick={send}
                disabled={!input.trim()}
                aria-label="Send message"
                className="flex size-8 items-center justify-center rounded-lg bg-green text-paper transition-all hover:bg-green-hover disabled:opacity-40"
              >
                <Send strokeWidth={1.5} className="size-4" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Empty state — desktop only */
        <div className="hidden flex-1 flex-col items-center justify-center gap-3 bg-paper text-center lg:flex">
          <div aria-hidden className="mb-2 flex flex-col items-center gap-3 opacity-15">
            <span className="h-px w-32 bg-ink" />
            <span className="h-px w-20 bg-ink" />
            <span className="h-px w-12 bg-ink" />
          </div>
          <p className="font-display text-title font-medium text-ink">Select a conversation</p>
          <p className="text-body-sm text-ink-muted">
            Choose one from the list to start messaging.
          </p>
        </div>
      )}
    </div>
  );
}
