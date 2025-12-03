import React, { useEffect, useLayoutEffect, useRef, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, ArrowDownCircle, FileText, Plus, X, Trash2 } from "lucide-react";
import { useChatStore } from "@/stores/chatStore";
import api from "@/lib/api";
import { toast } from "sonner";
import type { Message, SessionDocument, Document } from "@/types";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";

// Components
import { ChatMessage } from "@/components/chat/ChatMessage";
import { ChatInput } from "@/components/chat/ChatInput";
import { ChatEmptyState } from "@/components/chat/ChatEmptyState";

const PAGE_SIZE = 20;
const TOP_LOAD_THRESHOLD = 120; // px from top to trigger older load
const NEAR_BOTTOM_THRESHOLD = 200; // px from bottom considered "near bottom"

export default function Chat(): JSX.Element {
  const { sessionId } = useParams<{ sessionId: string }>();
  const {
    messages,
    setMessages,
    addMessage,
    updateMessage,
    setCurrentSession,
    loadSessions,
  } = useChatStore();

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const bottomAnchorRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const [page, setPage] = useState<number>(1);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [loadingOlder, setLoadingOlder] = useState<boolean>(false);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [input, setInput] = useState<string>("");
  const [isUserNearBottom, setIsUserNearBottom] = useState<boolean>(true);
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const [sessionDocuments, setSessionDocuments] = useState<SessionDocument[]>([]);
  const [loadingDocuments, setLoadingDocuments] = useState<boolean>(false);
  const [availableDocuments, setAvailableDocuments] = useState<Document[]>([]);
  const [showAddDocuments, setShowAddDocuments] = useState<boolean>(false);
  const [addingDocument, setAddingDocument] = useState<boolean>(false);
  const [deletingDocumentId, setDeletingDocumentId] = useState<string | null>(null);

  // Used to avoid automatic scroll on initial render before messages present
  const initialOpenRef = useRef<boolean>(true);

  // -- LOAD SESSION METADATA --
  useEffect(() => {
    if (!sessionId) return;
    const loadSession = async () => {
      try {
        const r = await api.get(`/sessions/${sessionId}`);
        setCurrentSession(r.data);
      } catch (err) {
        toast.error("Failed to load session");
      }
    };
    loadSession();
  }, [sessionId, setCurrentSession]);

  // -- LOAD SESSION DOCUMENTS --
  useEffect(() => {
    if (!sessionId) return;
    const loadDocuments = async () => {
      setLoadingDocuments(true);
      try {
        const response = await api.get(`/sessions/${sessionId}/documents`);
        setSessionDocuments(response.data.data || []);
      } catch (err) {
        console.error("Failed to load session documents", err);
        setSessionDocuments([]);
      } finally {
        setLoadingDocuments(false);
      }
    };
    loadDocuments();
  }, [sessionId]);

  // -- LOAD AVAILABLE DOCUMENTS (when add mode is opened) --
  const loadAvailableDocuments = async () => {
    try {
      const response = await api.get('/documents/');
      const allDocs = response.data.data || [];
      // Filter out documents already in session
      const sessionDocIds = new Set(sessionDocuments.map(sd => sd.document_id));
      const available = allDocs.filter((doc: Document) => !sessionDocIds.has(doc.id));
      setAvailableDocuments(available);
    } catch (err) {
      console.error('Failed to load available documents', err);
      setAvailableDocuments([]);
    }
  };

  // Reload available documents when session documents change or add mode opens
  useEffect(() => {
    if (showAddDocuments) {
      loadAvailableDocuments();
    }
  }, [showAddDocuments, sessionDocuments]);

  // -- MESSAGES: initial load (page 1 = newest) --
  useEffect(() => {
    if (!sessionId) return;

    // Clear old messages first to avoid flicker from previous session
    setMessages([]);
    setPage(1);
    setHasMore(false);
    initialOpenRef.current = true;

    const loadLatest = async () => {
      try {
        const resp = await api.get(`/sessions/${sessionId}/messages`, {
          params: { page: 1, page_size: PAGE_SIZE },
        });
        const { data, meta } = resp.data;
        setMessages(data);
        setHasMore(Boolean(meta?.has_next_page));
        setPage(1);
        // soon after messages set, jump to bottom
        requestAnimationFrame(() => {
          scrollToBottomInstant();
          initialOpenRef.current = false;
        });
      } catch (err) {
        toast.error("Failed to load messages");
      }
    };

    loadLatest();
  }, [sessionId, setMessages]);

  // Ensure on first messages populate we jump to bottom (synchronous-ish)
  useLayoutEffect(() => {
    if (initialOpenRef.current && messages.length > 0) {
      // If scrollRef exists try set scroll to bottom immediately
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
      initialOpenRef.current = false;
    }
  }, [messages.length]);

  // -- Scroll helpers --
  const scrollToBottomSmooth = () => {
    bottomAnchorRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const scrollToBottomInstant = () => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    else bottomAnchorRef.current?.scrollIntoView({ behavior: "auto" });
  };

  // -- Load older messages (page 2,3...) when user scrolls near top --
  const loadOlder = useCallback(
    async (nextPage: number) => {
      if (!sessionId || loadingOlder || !hasMore) return;
      setLoadingOlder(true);
      const container = scrollRef.current;
      const prevScrollHeight = container?.scrollHeight ?? 0;

      try {
        const resp = await api.get(`/sessions/${sessionId}/messages`, {
          params: { page: nextPage, page_size: PAGE_SIZE },
        });
        const { data, meta } = resp.data;

        // Prepend older messages while preserving viewport
        setMessages((prev) => {
          const merged = [...data, ...prev];
          return merged;
        });

        // After DOM update, adjust scrollTop so content doesn't jump
        setTimeout(() => {
          const newScrollHeight = container?.scrollHeight ?? 0;
          if (container) {
            container.scrollTop = newScrollHeight - prevScrollHeight;
          }
        }, 50);

        setHasMore(Boolean(meta?.has_next_page));
        setPage(nextPage);
      } catch (err) {
        toast.error("Failed to load older messages");
      } finally {
        setLoadingOlder(false);
      }
    },
    [sessionId, hasMore, loadingOlder, setMessages]
  );

  // -- Scroll event handler --
  const onScroll = (e?: React.UIEvent) => {
    const container = scrollRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;

    // Detect near-top for older load
    if (scrollTop < TOP_LOAD_THRESHOLD && !loadingOlder && hasMore) {
      loadOlder(page + 1);
    }

    // Detect near-bottom for auto-scroll behavior & Jump-to-latest button visibility
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    const nearBottom = distanceFromBottom < NEAR_BOTTOM_THRESHOLD;
    setIsUserNearBottom(nearBottom);
  };

  const abortControllerRef = useRef<AbortController | null>(null);

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsSending(false);
      setIsTyping(false);
    }
  };

  // -- SEND MESSAGE (user query) --
  const handleSend = async () => {
    if (!sessionId || !input.trim() || isSending) return;
    const text = input.trim();
    setInput("");
    setIsSending(true);
    setIsTyping(true);

    // user message (optimistic)
    const userMsg: Message = {
      id: Date.now().toString(),
      session_id: sessionId,
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
    };
    addMessage(userMsg);

    // Immediately scroll to bottom so user sees their message
    setTimeout(() => scrollToBottomSmooth(), 30);

    // assistant message placeholder
    const assistantId = (Date.now() + 1).toString();
    const assistantMsg: Message = {
      id: assistantId,
      session_id: sessionId,
      role: "assistant",
      content: "",
      created_at: new Date().toISOString(),
    };
    addMessage(assistantMsg);

    abortControllerRef.current = new AbortController();

    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`${import.meta.env.VITE_BASE_API_URL}/chat/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          session_id: sessionId,
          query: text,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) throw new Error("Failed to send message");
      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        fullText += chunk;
        updateMessage(assistantId, fullText);

        if (isUserNearBottom) {
          bottomAnchorRef.current?.scrollIntoView({ behavior: "smooth" });
        }
      }

    } catch (err: any) {
      if (err.name === 'AbortError') {
        updateMessage(assistantId, "*Response stopped by user*");
      } else {
        const errorMessage = "I'm sorry, I encountered an error while processing your request. Please try again. If the problem persists, check your internet connection or contact support.";
        updateMessage(assistantId, errorMessage);
        toast.error("Unable to get response. Please try again.");
      }
    } finally {
      setIsSending(false);
      setIsTyping(false);
      abortControllerRef.current = null;
      loadSessions();
    }
  };

  // Jump-to-latest button click
  const handleJumpToLatest = () => {
    scrollToBottomSmooth();
    setIsUserNearBottom(true);
  };

  // -- ADD DOCUMENT TO SESSION --
  const handleAddDocument = async (documentId: string) => {
    if (!sessionId || addingDocument) return;
    setAddingDocument(true);
    try {
      await api.post('/sessions/add_documents', {
        session_id: sessionId,
        document_id: [documentId],
      });
      toast.success('Document added to session');
      // Reload session documents
      const response = await api.get(`/sessions/${sessionId}/documents`);
      setSessionDocuments(response.data.data || []);
      setShowAddDocuments(false);
    } catch (err) {
      console.error('Failed to add document', err);
      toast.error('Failed to add document to session');
    } finally {
      setAddingDocument(false);
    }
  };

  // -- REMOVE DOCUMENT FROM SESSION --
  const handleRemoveDocument = async (documentId: string) => {
    if (!sessionId || deletingDocumentId) return;
    setDeletingDocumentId(documentId);
    try {
      await api.delete(`/sessions/${sessionId}/documents/${documentId}`);
      toast.success('Document removed from session');
      // Reload session documents
      const response = await api.get(`/sessions/${sessionId}/documents`);
      setSessionDocuments(response.data.data || []);
    } catch (err) {
      console.error('Failed to remove document', err);
      toast.error('Failed to remove document from session');
    } finally {
      setDeletingDocumentId(null);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header with Documents Button - Fixed at top */}
      <div className="flex-shrink-0 border-b px-4 py-2 pl-14 md:pl-4 flex items-center justify-between bg-background">
        <h2 className="text-base font-semibold">Chat</h2>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <FileText className="h-4 w-4" />
              Documents ({sessionDocuments.length})
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-96" align="end">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">
                  {showAddDocuments ? 'Add Documents' : 'Session Documents'}
                </h3>
                {!showAddDocuments && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAddDocuments(true)}
                    className="h-7 gap-1 text-xs"
                  >
                    <Plus className="h-3 w-3" />
                    Add
                  </Button>
                )}
                {showAddDocuments && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAddDocuments(false)}
                    className="h-7"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>

              {!showAddDocuments ? (
                // View existing documents
                <>
                  {loadingDocuments ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : sessionDocuments.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No documents in this session
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {sessionDocuments.map((doc) => (
                        <TooltipProvider key={doc.id}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="group flex items-center gap-2 p-2 rounded-md bg-muted/50 hover:bg-muted transition-colors cursor-default">
                                <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                <p className="text-sm font-medium truncate flex-1">
                                  {doc.document?.filename || `Document ${doc.document_id}`}
                                </p>
                                {sessionDocuments.length > 1 && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRemoveDocument(doc.document_id);
                                    }}
                                    disabled={deletingDocumentId === doc.document_id}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-destructive/10 rounded"
                                    title="Remove document"
                                  >
                                    {deletingDocumentId === doc.document_id ? (
                                      <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                                    ) : (
                                      <Trash2 className="h-3 w-3 text-destructive" />
                                    )}
                                  </button>
                                )}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{doc.document?.filename || `Document ${doc.document_id}`}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                // Add new documents
                <div className="space-y-2">
                  {availableDocuments.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No more documents available to add
                    </p>
                  ) : (
                    <Command className="rounded-lg border">
                      <CommandInput placeholder="Search documents..." />
                      <CommandList className="max-h-60">
                        <CommandEmpty>No documents found.</CommandEmpty>
                        <CommandGroup>
                          {availableDocuments.map((doc) => (
                            <CommandItem
                              key={doc.id}
                              onSelect={() => handleAddDocument(doc.id)}
                              disabled={addingDocument}
                              className="cursor-pointer"
                            >
                              <FileText className="h-4 w-4 mr-2 text-muted-foreground" />
                              <span className="truncate">{doc.filename}</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  )}
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea
          className="h-full p-6"
          onScrollCapture={onScroll}
        >
          <div ref={scrollContainerRef}>
            <motion.div
              className="max-w-4xl mx-auto space-y-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.18 }}
              style={{ overflowAnchor: "none" }}
            >
              {/* Top loader when fetching older messages */}
              {loadingOlder && (
                <div className="flex justify-center py-2">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-muted/10 text-sm">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading older messages...
                  </div>
                </div>
              )}

              {/* Empty placeholder */}
              {messages.length === 0 && !isTyping && !isSending && (
                <ChatEmptyState />
              )}

              {/* Render messages */}
              {messages.map((m, index) => (
                <ChatMessage
                  key={m.id}
                  message={m}
                  isTyping={isTyping && index === messages.length - 1 && m.role === 'assistant'}
                />
              ))}

              {/* Typing indicator (if assistant being typed) */}
              {isSending && !isTyping && (
                <div className="flex gap-3 justify-start">
                  <div className="flex-shrink-0">
                    <div className="ai-gradient p-1.5 rounded-full h-fit">
                      <Loader2 className="h-4 w-4 animate-spin text-white" />
                    </div>
                  </div>
                  <div className="max-w-[75%] px-4 py-3 rounded-2xl bg-muted/50">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-pulse" />
                      <span className="text-sm text-muted-foreground">Thinking...</span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={bottomAnchorRef} />
            </motion.div>
          </div>
        </ScrollArea>
      </div>

      {/* Input area */}
      <ChatInput
        input={input}
        setInput={setInput}
        handleSend={handleSend}
        isLoading={isSending}
        handleStop={handleStop}
      />

      {/* Jump to latest floating button */}
      {!isUserNearBottom && (
        <div className="fixed right-6 bottom-24 z-50">
          <motion.div
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.18 }}
          >
            <Button onClick={handleJumpToLatest} className="rounded-full px-3 py-2 shadow-lg">
              <ArrowDownCircle className="h-5 w-5 mr-2" />
              Latest
            </Button>
          </motion.div>
        </div>
      )}
    </div>
  );
}
