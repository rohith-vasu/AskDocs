// Dashboard.tsx

// ─── React & Core ──────────────────────────────────────────────
import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

// ─── Stores ────────────────────────────────────────────────────
import { useAuthStore } from "@/stores/authStore";
import { useChatStore } from "@/stores/chatStore";

// ─── API & Utils ───────────────────────────────────────────────
import api from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ─── UI Components ─────────────────────────────────────────────
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";

// ─── Icons ─────────────────────────────────────────────────────
import {
  MessageSquare,
  FolderOpen,
  Upload,
  Plus,
  Check,
  ChevronDown,
} from "lucide-react";


export default function Dashboard() {
  const { user } = useAuthStore();
  const { sessions, setSessions } = useChatStore();
  const [recentDocs, setRecentDocs] = useState([]);
  const [greeting, setGreeting] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [newChatName, setNewChatName] = useState("");
  const [documents, setDocuments] = useState([]);
  const [selectedDocs, setSelectedDocs] = useState([]);
  const [errorMessage, setErrorMessage] = useState('');


  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Good Morning");
    else if (hour < 18) setGreeting("Good Afternoon");
    else setGreeting("Good Evening");
  }, []);

  useEffect(() => {
    loadRecentData();
  }, []);

  const loadRecentData = async () => {
    try {
      const chatRes = await api.get("/sessions/");
      setSessions(chatRes.data.data || []);
      const docRes = await api.get("/documents/");
      setRecentDocs(docRes.data.data || []);
    } catch (error) {
      console.error("Error fetching recent activity:", error);
    }
  };

  useEffect(() => {
    if (isSheetOpen) fetchDocuments();
  }, [isSheetOpen]);

  const fetchDocuments = async () => {
    try {
      const res = await api.get('/documents/');
      setDocuments(res.data.data || []);
    } catch {
      setDocuments([]);
    }
  };

  const handleCreateSession = async () => {
    if (!newChatName.trim()) return setErrorMessage("Please enter a session name.");
    if (selectedDocs.length === 0) return setErrorMessage("Select at least one document.");

    try {
      const sessionRes = await api.post(`/sessions/`, null, {
        params: { session_name: newChatName },
      });

      const newSession = sessionRes.data?.data?.data || sessionRes.data?.data;
      const sessionId = newSession.id;

      await api.post(`/sessions/add_documents`, {
        session_id: sessionId,
        document_id: selectedDocs,
      });

      toast.success('Chat created successfully');
      setIsSheetOpen(false);
      setNewChatName('');
      setSelectedDocs([]);
      setErrorMessage('');

      setSessions([newSession, ...sessions]);
      navigate(`/dashboard/chat/${sessionId}`);
    } catch (err) {
      if (err.response?.data?.message?.includes("already exists")) {
        setErrorMessage("A chat session with this name already exists.");
      } else {
        toast.error('Failed to create session');
      }
    }
  };


  const handleFileUpload = async (files: FileList) => {
    if (!files.length) return;

    setIsUploading(true);
    const formData = new FormData();
    Array.from(files).forEach((file) => formData.append("files", file));

    try {
      await api.post("/documents/", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("Documents uploaded successfully!");
      navigate("/dashboard/documents");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      handleFileUpload(e.target.files);
    }
  };

  const hasActivity = sessions.length > 0 || recentDocs.length > 0;

  return (
    <div className="flex items-center justify-center h-full w-full px-4 pt-16 md:pt-0">
      <div className="flex flex-col items-center text-center space-y-10 max-w-5xl w-full">
        {/* Greeting */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="space-y-3"
        >
          <h1 className="text-3xl sm:text-4xl font-bold">
            {greeting}, {user?.first_name || user?.last_name || "there"} 👋
          </h1>
          <p className="text-muted-foreground text-base max-w-xl mx-auto">
            {hasActivity
              ? "Pick up where you left off or upload new documents to continue working."
              : "Upload your first document to start chatting with your files."}
          </p>
        </motion.div>

        {/* Upload & Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.6 }}
          className="flex flex-wrap justify-center gap-4"
        >
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            <Upload className="h-4 w-4" />
            {isUploading ? "Uploading..." : "Upload Document"}
          </Button>

          <Button
            variant="outline"
            className="gap-2"
            onClick={() => navigate("/dashboard/documents")}
          >
            <FolderOpen className="h-4 w-4" />
            Manage Documents
          </Button>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    variant="outline" // 👈 same style as Manage Documents
                    className="gap-2"
                    disabled={recentDocs.length === 0} // 👈 disable only when no docs
                    onClick={() => setIsSheetOpen(true)}
                  >
                    <MessageSquare className="h-4 w-4" />
                    Start Chat
                  </Button>
                </span>
              </TooltipTrigger>

              {recentDocs.length === 0 && (
                <TooltipContent side="top">
                  Upload a document to start chatting
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />
        </motion.div>

        {/* New Chat */}
        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
          <SheetContent side="right" className="w-[420px] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Start a New Chat</SheetTitle>
            </SheetHeader>

            <div className="space-y-5 mt-5">
              {/* Session Name Input */}
              <div>
                <label className="text-sm font-medium mb-2 block">Session Name</label>
                <Input
                  placeholder="Enter chat name..."
                  value={newChatName}
                  onChange={async (e) => {
                    const value = e.target.value;
                    setNewChatName(value);
                    setErrorMessage(""); // clear error when typing again

                    if (!value.trim()) return;
                    try {
                      const res = await api.get('/sessions/');
                      const existing = res.data.data?.some(
                        (s) => s.name?.toLowerCase() === value.toLowerCase()
                      );
                      if (existing) {
                        setErrorMessage("A chat session with this name already exists.");
                      }
                    } catch {
                      console.warn('Failed to validate session name');
                    }
                  }}
                />
                {errorMessage && (
                  <p className="text-sm text-red-500 mt-1">{errorMessage}</p>
                )}
              </div>

              {/* Document Dropdown */}
              <div className="space-y-2">
                <label className="text-sm font-medium mb-1 block">
                  Select Documents
                </label>

                {documents.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center mt-8 border rounded-md py-8">
                    No documents available. Upload some first.
                  </p>
                ) : (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className="w-full justify-between"
                      >
                        {selectedDocs.length > 0
                          ? `${selectedDocs.length} document${selectedDocs.length > 1 ? 's' : ''} selected`
                          : "Select documents..."}
                        <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
                      </Button>
                    </PopoverTrigger>

                    <PopoverContent className="w-full p-0">
                      <Command>
                        <CommandInput placeholder="Search documents..." />
                        <CommandList className="max-h-60 overflow-y-auto">
                          <CommandEmpty>No documents found.</CommandEmpty>
                          <CommandGroup>
                            {documents.map((doc) => (
                              <CommandItem
                                key={doc.id}
                                onSelect={() =>
                                  setSelectedDocs((prev) =>
                                    prev.includes(doc.id)
                                      ? prev.filter((id) => id !== doc.id)
                                      : [...prev, doc.id]
                                  )
                                }
                                className={cn(
                                  "cursor-pointer text-foreground hover:bg-muted transition-colors",
                                  selectedDocs.includes(doc.id) && "bg-primary/10 text-primary"
                                )}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4 transition-opacity",
                                    selectedDocs.includes(doc.id)
                                      ? "opacity-100 text-primary"
                                      : "opacity-0"
                                  )}
                                />
                                {doc.filename}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                )}
              </div>

              {/* Create Button */}
              <Button
                onClick={handleCreateSession}
                disabled={
                  !newChatName.trim() ||
                  selectedDocs.length === 0 ||
                  !!errorMessage
                }
                className="w-full"
              >
                Create Chat
              </Button>
            </div>
          </SheetContent>
        </Sheet>



      </div>
    </div>
  );
}
