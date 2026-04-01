"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Bot,
  Loader2,
  MessageSquare,
  Plus,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

type Conversation = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

type ConversationDetail = {
  id: string;
  title: string;
  messages: Message[];
};

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvo, setActiveConvo] = useState<ConversationDetail | null>(
    null,
  );
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeConvo?.messages]);

  // Fetch conversations when opened
  useEffect(() => {
    if (isOpen) {
      api
        .get<Conversation[]>("/api/v1/chat/conversations")
        .then((data) => setConversations(data ?? []))
        .catch(() => {});
    }
  }, [isOpen]);

  async function loadConversation(id: string) {
    try {
      const data = await api.get<ConversationDetail>(
        `/api/v1/chat/conversations/${id}`,
      );
      setActiveConvo(data);
      setShowHistory(false);
    } catch {
      // ignore
    }
  }

  async function startNewChat() {
    setActiveConvo(null);
    setShowHistory(false);
    setInput("");
  }

  async function deleteConversation(id: string) {
    try {
      await api.delete(`/api/v1/chat/conversations/${id}`);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeConvo?.id === id) setActiveConvo(null);
    } catch {
      // ignore
    }
  }

  async function handleSend() {
    if (!input.trim() || sending) return;
    const userMessage = input.trim();
    setInput("");
    setSending(true);

    // Optimistically add user message
    const tempUserMsg: Message = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: userMessage,
      created_at: new Date().toISOString(),
    };

    setActiveConvo((prev) => ({
      id: prev?.id || "new",
      title: prev?.title || userMessage.slice(0, 50),
      messages: [...(prev?.messages || []), tempUserMsg],
    }));

    try {
      const response = await api.post<{
        conversation_id: string;
        response: string;
      }>("/api/v1/chat/send", {
        message: userMessage,
        conversation_id:
          activeConvo?.id && activeConvo.id !== "new" ? activeConvo.id : null,
      });

      const assistantMsg: Message = {
        id: `resp-${Date.now()}`,
        role: "assistant",
        content: response.response,
        created_at: new Date().toISOString(),
      };

      setActiveConvo((prev) => ({
        id: response.conversation_id,
        title: prev?.title || userMessage.slice(0, 50),
        messages: [...(prev?.messages || []), assistantMsg],
      }));

      // Refresh conversation list
      api
        .get<Conversation[]>("/api/v1/chat/conversations")
        .then((data) => setConversations(data ?? []))
        .catch(() => {});
    } catch {
      const errorMsg: Message = {
        id: `err-${Date.now()}`,
        role: "assistant",
        content: "Üzgünüm, şu anda yanıt veremiyorum. Lütfen tekrar deneyin.",
        created_at: new Date().toISOString(),
      };
      setActiveConvo((prev) => ({
        ...prev!,
        messages: [...(prev?.messages || []), errorMsg],
      }));
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      {/* Floating Button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "fixed right-4 bottom-4 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-colors sm:right-6 sm:bottom-6",
          isOpen
            ? "bg-muted text-foreground"
            : "bg-primary text-primary-foreground",
        )}
      >
        {isOpen ? <X className="h-6 w-6" /> : <Bot className="h-6 w-6" />}
      </motion.button>

      {/* Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="border-border bg-background fixed right-6 bottom-24 z-50 flex h-[500px] w-[380px] flex-col overflow-hidden rounded-2xl border shadow-xl max-sm:inset-0 max-sm:right-0 max-sm:bottom-0 max-sm:h-full max-sm:w-full max-sm:rounded-none max-sm:border-none sm:h-[550px] sm:w-[400px]"
          >
            {/* Header */}
            <div className="border-border bg-primary flex items-center justify-between border-b px-4 py-3">
              <div className="text-primary-foreground flex items-center gap-2">
                <Bot className="h-5 w-5" />
                <span className="text-sm font-semibold">Etüt Pro Asistan</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className="text-primary-foreground/70 hover:bg-primary-foreground/10 hover:text-primary-foreground rounded-lg p-1.5 transition-colors"
                >
                  <MessageSquare className="h-4 w-4" />
                </button>
                <button
                  onClick={startNewChat}
                  className="text-primary-foreground/70 hover:bg-primary-foreground/10 hover:text-primary-foreground rounded-lg p-1.5 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            {showHistory ? (
              /* Conversation History */
              <div className="flex-1 overflow-y-auto p-3">
                <p className="text-muted-foreground mb-2 text-xs font-medium">
                  Geçmiş Konuşmalar
                </p>
                {conversations.length === 0 ? (
                  <p className="text-muted-foreground py-8 text-center text-sm">
                    Henüz konuşma yok
                  </p>
                ) : (
                  <div className="space-y-1">
                    {conversations.map((c) => (
                      <div
                        key={c.id}
                        className={cn(
                          "group flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors",
                          activeConvo?.id === c.id
                            ? "bg-accent text-accent-foreground"
                            : "hover:bg-muted",
                        )}
                        onClick={() => loadConversation(c.id)}
                      >
                        <span className="truncate">{c.title}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteConversation(c.id);
                          }}
                          className="text-muted-foreground hover:text-destructive hidden group-hover:block"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* Chat Messages */
              <div className="flex-1 overflow-y-auto p-4">
                {(!activeConvo || activeConvo.messages.length === 0) && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col items-center justify-center py-12 text-center"
                  >
                    <div className="bg-primary/10 mb-4 flex h-16 w-16 items-center justify-center rounded-2xl">
                      <Bot className="text-primary h-8 w-8" />
                    </div>
                    <h3 className="text-foreground text-sm font-semibold">
                      Merhaba!
                    </h3>
                    <p className="text-muted-foreground mt-1 text-xs">
                      Size nasıl yardımcı olabilirim?
                    </p>
                  </motion.div>
                )}

                <div className="space-y-3">
                  {(activeConvo?.messages ?? []).map((msg, i) => (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className={cn(
                        "flex",
                        msg.role === "user" ? "justify-end" : "justify-start",
                      )}
                    >
                      <div
                        className={cn(
                          "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                          msg.role === "user"
                            ? "bg-primary text-primary-foreground rounded-br-md"
                            : "bg-muted text-foreground rounded-bl-md",
                        )}
                      >
                        <div className="whitespace-pre-wrap">{msg.content}</div>
                      </div>
                    </motion.div>
                  ))}

                  {sending && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex justify-start"
                    >
                      <div className="bg-muted flex items-center gap-2 rounded-2xl rounded-bl-md px-4 py-3">
                        <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
                        <span className="text-muted-foreground text-xs">
                          Düşünüyor...
                        </span>
                      </div>
                    </motion.div>
                  )}
                </div>
                <div ref={messagesEndRef} />
              </div>
            )}

            {/* Input */}
            {!showHistory && (
              <div className="border-border border-t p-3">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSend();
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Mesajınızı yazın..."
                    disabled={sending}
                    className="border-input bg-background placeholder:text-muted-foreground focus:ring-ring flex-1 rounded-xl border px-4 py-2.5 text-sm focus:ring-2 focus:outline-none disabled:opacity-50"
                  />
                  <Button
                    type="submit"
                    size="icon"
                    disabled={!input.trim() || sending}
                    className="h-10 w-10 shrink-0 rounded-xl"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
