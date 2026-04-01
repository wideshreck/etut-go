"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Bot,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MessageSquare,
  Plus,
  Search,
  Send,
  Trash2,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function groupConversations(convos: Conversation[]) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const thisWeek = new Date(today.getTime() - 7 * 86400000);

  const todayItems: Conversation[] = [];
  const yesterdayItems: Conversation[] = [];
  const weekItems: Conversation[] = [];
  const olderItems: Conversation[] = [];

  for (const c of convos) {
    const d = new Date(c.updated_at);
    if (d >= today) todayItems.push(c);
    else if (d >= yesterday) yesterdayItems.push(c);
    else if (d >= thisWeek) weekItems.push(c);
    else olderItems.push(c);
  }

  const groups: { label: string; items: Conversation[] }[] = [];
  if (todayItems.length > 0) groups.push({ label: "Bugün", items: todayItems });
  if (yesterdayItems.length > 0)
    groups.push({ label: "Dün", items: yesterdayItems });
  if (weekItems.length > 0)
    groups.push({ label: "Bu Hafta", items: weekItems });
  if (olderItems.length > 0)
    groups.push({ label: "Daha Eski", items: olderItems });

  return groups;
}

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const d = new Date(dateStr).getTime();
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60) return "Az önce";
  if (diff < 3600) return `${Math.floor(diff / 60)} dk önce`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} saat önce`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} gün önce`;
  return new Date(dateStr).toLocaleDateString("tr-TR");
}

/* ------------------------------------------------------------------ */
/*  Prompt Suggestions                                                 */
/* ------------------------------------------------------------------ */

const SUGGESTIONS = [
  {
    title: "Finansal Analiz",
    prompt: "Bu ayki tahsilat oranımız nedir? Geçen ayla karşılaştır.",
  },
  {
    title: "Devamsızlık",
    prompt: "Hangi sınıfların katılım oranı düşük? Detaylı analiz yap.",
  },
  {
    title: "Gider Analizi",
    prompt:
      "Toplam giderlerimizin dağılımı nasıl? En büyük kalemler hangileri?",
  },
  {
    title: "Genel Durum",
    prompt: "Kurumumuzun genel durumunu özetle ve iyileştirme önerileri sun.",
  },
];

/* ------------------------------------------------------------------ */
/*  Page Component                                                     */
/* ------------------------------------------------------------------ */

export default function AdminAIPage() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvo, setActiveConvo] = useState<ConversationDetail | null>(
    null,
  );
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  /* ── Scroll to bottom ──────────────────────────────────────────── */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeConvo?.messages]);

  /* ── Fetch conversations ───────────────────────────────────────── */
  const fetchConversations = useCallback(() => {
    api
      .get<Conversation[]>("/api/v1/chat/conversations")
      .then((data) => setConversations(data ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  /* ── Actions ───────────────────────────────────────────────────── */

  async function loadConversation(id: string) {
    try {
      const data = await api.get<ConversationDetail>(
        `/api/v1/chat/conversations/${id}`,
      );
      setActiveConvo(data);
    } catch {
      /* ignore */
    }
  }

  function startNewChat() {
    setActiveConvo(null);
    setInput("");
    inputRef.current?.focus();
  }

  async function deleteConversation(id: string) {
    setDeletingId(id);
    try {
      await api.delete(`/api/v1/chat/conversations/${id}`);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeConvo?.id === id) setActiveConvo(null);
    } catch {
      /* ignore */
    } finally {
      setDeletingId(null);
    }
  }

  async function handleSend(overrideMessage?: string) {
    const userMessage = (overrideMessage ?? input).trim();
    if (!userMessage || sending) return;
    setInput("");
    setSending(true);

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

      fetchConversations();
    } catch {
      setActiveConvo((prev) => ({
        ...prev!,
        messages: [
          ...(prev?.messages || []),
          {
            id: `err-${Date.now()}`,
            role: "assistant" as const,
            content:
              "Üzgünüm, şu anda yanıt veremiyorum. Lütfen tekrar deneyin.",
            created_at: new Date().toISOString(),
          },
        ],
      }));
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  /* ── Filtered & grouped conversations ──────────────────────────── */

  const filteredConvos = search
    ? conversations.filter((c) =>
        c.title.toLowerCase().includes(search.toLowerCase()),
      )
    : conversations;
  const grouped = groupConversations(filteredConvos);

  const hasMessages =
    activeConvo && activeConvo.messages && activeConvo.messages.length > 0;

  /* ── Render ────────────────────────────────────────────────────── */

  return (
    <div className="-m-6 flex h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* ═══ Sidebar ═══ */}
      <aside
        className={cn(
          "border-border bg-background flex shrink-0 flex-col border-r transition-all duration-200",
          sidebarCollapsed ? "w-12" : "w-72",
        )}
      >
        {/* Sidebar Header */}
        <div className="border-border flex h-12 items-center justify-between border-b px-2">
          {!sidebarCollapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-2 px-1"
            >
              <MessageSquare className="text-muted-foreground h-4 w-4" />
              <span className="text-foreground text-xs font-semibold">
                Konuşmalar
              </span>
            </motion.div>
          )}
          <div className="flex items-center gap-0.5">
            {!sidebarCollapsed && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={startNewChat}
                title="Yeni Sohbet"
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            >
              {sidebarCollapsed ? (
                <ChevronRight className="h-3.5 w-3.5" />
              ) : (
                <ChevronLeft className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        </div>

        {/* Sidebar Content */}
        {!sidebarCollapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.05 }}
            className="flex flex-1 flex-col overflow-hidden"
          >
            {/* Search */}
            <div className="p-2">
              <div className="relative">
                <Search className="text-muted-foreground absolute top-2 left-2.5 h-3.5 w-3.5" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Konuşma ara..."
                  className="h-8 pl-8 text-xs"
                />
              </div>
            </div>

            {/* Conversation List */}
            <div className="flex-1 overflow-y-auto px-2 pb-2">
              {grouped.length === 0 ? (
                <p className="text-muted-foreground py-8 text-center text-xs">
                  {search ? "Sonuç bulunamadı" : "Henüz konuşma yok"}
                </p>
              ) : (
                grouped.map((group) => (
                  <div key={group.label} className="mb-3">
                    <p className="text-muted-foreground mb-1 px-2 text-[10px] font-semibold tracking-wider uppercase">
                      {group.label}
                    </p>
                    <div className="space-y-0.5">
                      {group.items.map((c) => (
                        <div
                          key={c.id}
                          onClick={() => loadConversation(c.id)}
                          className={cn(
                            "group flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-2 text-xs transition-all",
                            activeConvo?.id === c.id
                              ? "bg-accent text-accent-foreground"
                              : "text-muted-foreground hover:bg-muted hover:text-foreground",
                          )}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">{c.title}</p>
                            <p className="mt-0.5 text-[10px] opacity-60">
                              {relativeTime(c.updated_at)}
                            </p>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteConversation(c.id);
                            }}
                            className="text-muted-foreground hover:text-destructive ml-1 hidden shrink-0 rounded p-0.5 transition-colors group-hover:block"
                          >
                            {deletingId === c.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Trash2 className="h-3 w-3" />
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}

        {/* Collapsed: New Chat button */}
        {sidebarCollapsed && (
          <div className="flex flex-col items-center gap-1 pt-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={startNewChat}
              title="Yeni Sohbet"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        )}
      </aside>

      {/* ═══ Main Chat Area ═══ */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          {!hasMessages ? (
            /* ── Initial Screen ── */
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex h-full flex-col items-center justify-center px-4"
            >
              <div className="bg-primary/10 mb-6 flex h-20 w-20 items-center justify-center rounded-2xl">
                <Bot className="text-primary h-10 w-10" />
              </div>
              <h2 className="text-foreground text-xl font-semibold">
                Merhaba
                {user?.full_name ? `, ${user.full_name.split(" ")[0]}` : ""}!
              </h2>
              <p className="text-muted-foreground mt-2 max-w-md text-center text-sm">
                Kurumunuz hakkında her şeyi sorabilirsiniz. Finansal durumdan
                devamsızlığa, öğretmen maaşlarından ön kayıt dönüşümüne kadar
                tüm verilerinizi analiz edebilirim.
              </p>
              <div className="mt-8 grid w-full max-w-2xl grid-cols-1 gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map((s) => (
                  <motion.button
                    key={s.title}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleSend(s.prompt)}
                    className="border-border bg-background hover:border-primary/30 hover:bg-muted/50 rounded-xl border p-4 text-left transition-colors"
                  >
                    <p className="text-foreground text-xs font-semibold">
                      {s.title}
                    </p>
                    <p className="text-muted-foreground mt-1 text-[11px] leading-relaxed">
                      {s.prompt}
                    </p>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          ) : (
            /* ── Message List ── */
            <div className="mx-auto max-w-3xl space-y-5 px-4 py-6">
              <AnimatePresence>
                {(activeConvo?.messages ?? []).map((msg, i) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.02, duration: 0.2 }}
                    className={cn(
                      "flex gap-3",
                      msg.role === "user" ? "justify-end" : "justify-start",
                    )}
                  >
                    {msg.role === "assistant" && (
                      <div className="bg-primary/10 mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
                        <Bot className="text-primary h-4 w-4" />
                      </div>
                    )}
                    <div
                      className={cn(
                        "max-w-[85%] rounded-2xl px-4 py-3 text-sm",
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground rounded-br-md"
                          : "border-border bg-background text-foreground rounded-bl-md border shadow-sm",
                      )}
                    >
                      {msg.role === "assistant" ? (
                        <div className="prose prose-sm dark:prose-invert prose-p:leading-relaxed prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-headings:my-2 prose-table:text-xs prose-th:px-2 prose-th:py-1 prose-td:px-2 prose-td:py-1 prose-pre:bg-muted prose-pre:p-3 prose-pre:rounded-lg prose-code:text-xs prose-strong:text-foreground max-w-none">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {msg.content}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <div className="leading-relaxed whitespace-pre-wrap">
                          {msg.content}
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {sending && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex gap-3"
                >
                  <div className="bg-primary/10 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
                    <Bot className="text-primary h-4 w-4" />
                  </div>
                  <div className="border-border bg-background flex items-center gap-2 rounded-2xl rounded-bl-md border px-4 py-3 shadow-sm">
                    <div className="flex gap-1">
                      <span className="bg-primary/40 inline-block h-2 w-2 animate-bounce rounded-full [animation-delay:0ms]" />
                      <span className="bg-primary/40 inline-block h-2 w-2 animate-bounce rounded-full [animation-delay:150ms]" />
                      <span className="bg-primary/40 inline-block h-2 w-2 animate-bounce rounded-full [animation-delay:300ms]" />
                    </div>
                    <span className="text-muted-foreground text-xs">
                      Analiz ediliyor...
                    </span>
                  </div>
                </motion.div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* ── Input Area ── */}
        <div className="border-border bg-background border-t p-4">
          <div className="mx-auto max-w-3xl">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-end gap-3"
            >
              <div className="relative flex-1">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Kurumunuz hakkında bir soru sorun..."
                  disabled={sending}
                  rows={1}
                  className="border-input bg-muted/50 placeholder:text-muted-foreground focus:ring-ring w-full resize-none rounded-xl border px-4 py-3 text-sm focus:ring-2 focus:outline-none disabled:opacity-50"
                  style={{ minHeight: "48px", maxHeight: "120px" }}
                  onInput={(e) => {
                    const t = e.target as HTMLTextAreaElement;
                    t.style.height = "auto";
                    t.style.height = Math.min(t.scrollHeight, 120) + "px";
                  }}
                />
              </div>
              <Button
                type="submit"
                size="icon"
                disabled={!input.trim() || sending}
                className="h-12 w-12 shrink-0 rounded-xl"
              >
                <Send className="h-5 w-5" />
              </Button>
            </form>
            <p className="text-muted-foreground mt-2 text-center text-[10px]">
              AI yanıtları bilgilendirme amaçlıdır, kesin doğruluk garantisi
              vermez.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
