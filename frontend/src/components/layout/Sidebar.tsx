import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "next-themes";

// Icons
import {
  Plus,
  Search,
  MessageSquare,
  FolderOpen,
  LogOut,
  Moon,
  Sun,
  User,
  Edit,
  Trash2,
  MoreHorizontal,
  Check,
  ChevronDown,
  Menu,
} from "lucide-react";

// UI Components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
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

import { Switch } from "@/components/ui/switch";

// Utils & Stores
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";
import { useChatStore } from "@/stores/chatStore";
import api from "@/lib/api";
import { toast } from "sonner";

export const Sidebar = () => {
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile Trigger */}
      <div className="md:hidden fixed top-3 left-4 z-50">
        <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="h-10 w-10">
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-72 bg-sidebar border-r-0">
            <SidebarContent onNavigate={() => setIsMobileOpen(false)} />
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden md:flex h-full w-64 border-r bg-sidebar flex-col">
        <SidebarContent />
      </div>
    </>
  );
};

const SidebarContent = ({ onNavigate }: { onNavigate?: () => void }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, fetchUser, logout } = useAuthStore();
  const { sessions, setSessions } = useChatStore();
  const { theme, setTheme } = useTheme();

  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [newChatName, setNewChatName] = useState("");
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [renameData, setRenameData] = useState({ id: "", name: "" });
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [documents, setDocuments] = useState<any[]>([]);
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    first_name: user?.first_name || "",
    last_name: user?.last_name || "",
    email: user?.email || "",
    current_password: "",
    new_password: "",
    confirm_password: "",
  });

  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // ✅ Reusable function to load sessions
  const loadSessions = async () => {
    try {
      const response = await api.get("/sessions/");
      setSessions(response.data.data || []);
    } catch {
      setSessions([]);
    }
  };

  // ✅ Load chat sessions initially
  useEffect(() => {
    loadSessions();
  }, []);

  // ✅ Re-fetch sessions whenever user navigates to a new chat
  useEffect(() => {
    if (location.pathname.includes("/dashboard/chat/")) {
      loadSessions();
    }
  }, [location.pathname]);

  useEffect(() => {
    const handleSessionsUpdated = () => loadSessions();

    window.addEventListener("sessionsUpdated", handleSessionsUpdated);
    return () => window.removeEventListener("sessionsUpdated", handleSessionsUpdated);
  }, []);

  // Load documents when sheet opens
  useEffect(() => {
    if (isSheetOpen) fetchDocuments();
  }, [isSheetOpen]);

  const fetchDocuments = async () => {
    try {
      const res = await api.get("/documents/");
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

      toast.success("Chat created successfully");
      setIsSheetOpen(false);
      setNewChatName("");
      setSelectedDocs([]);
      setErrorMessage("");

      // ✅ Refetch full session list to maintain correct order
      await loadSessions();
      navigate(`/dashboard/chat/${sessionId}`);
      onNavigate?.();
    } catch (err: any) {
      if (err.response?.data?.message?.includes("already exists")) {
        setErrorMessage("A chat session with this name already exists.");
      } else {
        toast.error("Failed to create session");
      }
    }
  };

  const handleRenameChat = async () => {
    if (!renameData.name.trim()) return toast.error("Name cannot be empty");
    try {
      await api.patch(`/sessions/${renameData.id}`, null, {
        params: { name: renameData.name },
      });

      toast.success("Chat renamed");

      // ✅ Refresh sessions after rename
      await loadSessions();
      setIsRenameOpen(false);
    } catch {
      toast.error("Failed to rename chat");
    }
  };

  const handleDeleteChat = async (id: string) => {
    try {
      await api.delete(`/sessions/${id}`);
      toast.success("Chat deleted");

      // ✅ Refresh sessions after delete
      await loadSessions();

      if (location.pathname.includes(id)) navigate("/dashboard");
    } catch {
      toast.error("Failed to delete chat");
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleProfileUpdate = async () => {
    setLoading(true);

    try {
      if (isChangingPassword) {
        // --- Password change mode ---
        if (!formData.current_password || !formData.new_password) {
          toast.error("Please fill all password fields");
          setLoading(false);
          return;
        }
        if (formData.new_password !== formData.confirm_password) {
          toast.error("New passwords do not match");
          setLoading(false);
          return;
        }

        await api.post("/users/change-password", null, {
          params: {
            current_password: formData.current_password,
            new_password: formData.new_password,
          },
        });

        toast.success("Password changed successfully");
        setIsEditOpen(false);
      } else {
        // --- Profile update mode ---
        await api.patch(`/users/${user?.id}`, {
          firstname: formData.first_name,
          lastname: formData.last_name,
          email: formData.email,
        });

        await fetchUser();

        toast.success("Profile updated successfully");
        setIsEditOpen(false);
      }
    } catch (error: any) {
      console.error(error);
      const msg =
        error.response?.status === 400
          ? "Current password is incorrect"
          : "Something went wrong";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const toggleTheme = () => {
    setTheme(theme === "light" ? "dark" : "light");
  };

  const filteredSessions = sessions.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  const getInitial = (name?: string) => {
    if (!name) return "?";
    return name.charAt(0).toUpperCase();
  };

  return (
    <div className="flex flex-col h-full w-full">
      {/* Header */}
      <div
        onClick={() => {
          navigate("/dashboard");
          onNavigate?.();
        }}
        className="p-4 border-b cursor-pointer hover:bg-sidebar-hover transition flex items-center gap-2"
      >
        <h1 className="text-lg font-bold text-primary">AskDocs</h1>
      </div>

      <ScrollArea className="flex-1">
        {/* Files Section */}
        <div className="p-3">
          <h2 className="text-xs uppercase text-muted-foreground mb-2 font-medium tracking-wide">
            Files
          </h2>
          <Button
            variant={
              location.pathname.includes("/dashboard/documents")
                ? "secondary"
                : "ghost"
            }
            className="w-full justify-start"
            onClick={() => {
              navigate("/dashboard/documents");
              onNavigate?.();
            }}
          >
            <FolderOpen className="mr-2 h-4 w-4" />
            Manage Documents
          </Button>
        </div>

        {/* Chats Section */}
        <div className="px-3 mt-2">
          <h2 className="text-xs uppercase text-muted-foreground mb-2 font-medium tracking-wide">
            Chats
          </h2>

          {/* New Chat with motion on Sheet */}
          <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
            <SheetTrigger asChild>
              <Button className="w-full justify-start mb-2" variant="ghost">
                <Plus className="mr-2 h-4 w-4" />
                New Chat
              </Button>
            </SheetTrigger>

            <SheetContent side="left" className="w-[90%] sm:w-[420px] overflow-y-auto">
              <motion.div
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 50 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
              >
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
                        setErrorMessage("");
                        if (!value.trim()) return;
                        try {
                          const res = await api.get("/sessions/");
                          const existing = res.data.data?.some(
                            (s: any) => s.name?.toLowerCase() === value.toLowerCase()
                          );
                          if (existing) {
                            setErrorMessage("A chat session with this name already exists.");
                          }
                        } catch {
                          console.warn("Failed to validate session name");
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
                              ? `${selectedDocs.length} document${selectedDocs.length > 1 ? "s" : ""} selected`
                              : "Select documents..."}
                            <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
                          </Button>
                        </PopoverTrigger>

                        <PopoverContent className="w-[300px] p-0">
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
                                      selectedDocs.includes(doc.id) &&
                                      "bg-primary/10 text-primary"
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
              </motion.div>
            </SheetContent>
          </Sheet>

          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search chats..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 text-sm"
            />
          </div>

          {/* Chat List */}
          <div className="space-y-1">
            {filteredSessions.map((session) => (
              <motion.div
                key={session.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.15 }}
                className={`group flex items-center justify-between rounded-md ${location.pathname.includes(session.id)
                  ? "bg-secondary"
                  : "hover:bg-muted"
                  } transition`}
              >
                <button
                  onClick={() => {
                    navigate(`/dashboard/chat/${session.id}`);
                    onNavigate?.();
                  }}
                  className="flex items-center flex-1 px-3 py-2 text-left text-sm"
                >
                  <MessageSquare className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span className="truncate">{session.name}</span>
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="opacity-0 group-hover:opacity-100 transition px-2">
                      <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuItem
                      onClick={() => {
                        setRenameData({ id: session.id, name: session.name });
                        setIsRenameOpen(true);
                      }}
                    >
                      <Edit className="h-4 w-4 mr-2" /> Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        setDeleteTarget(session.id);
                        setIsDeleteOpen(true);
                      }}
                      className="text-red-500"
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </motion.div>
            ))}
          </div>
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-3 border-t flex items-center justify-between">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-muted transition">
              <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold">
                {getInitial(user?.first_name || user?.last_name)}
              </div>
              <span className="font-medium truncate">
                {user ? `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim() : "User"}
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-56">
            <div className="px-3 py-2 text-sm border-b">
              <p className="font-medium">{user?.email}</p>
            </div>
            <DropdownMenuItem onClick={() => setIsEditOpen(true)}>
              <User className="mr-2 h-4 w-4" /> Edit Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={toggleTheme}>
              {theme === "light" ? (
                <>
                  <Moon className="mr-2 h-4 w-4" /> Dark Mode
                </>
              ) : (
                <>
                  <Sun className="mr-2 h-4 w-4" /> Light Mode
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" /> Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Edit Profile Modal */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[425px] backdrop-blur-lg">
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Toggle */}
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Change Password</label>
              <Switch
                checked={isChangingPassword}
                onCheckedChange={setIsChangingPassword}
              />
            </div>

            {/* Profile Info Fields */}
            {!isChangingPassword && (
              <>
                <div>
                  <label className="text-sm font-medium">First Name</label>
                  <Input
                    value={formData.first_name}
                    onChange={(e) =>
                      setFormData({ ...formData, first_name: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Last Name</label>
                  <Input
                    value={formData.last_name}
                    onChange={(e) =>
                      setFormData({ ...formData, last_name: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Email</label>
                  <Input
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                  />
                </div>
              </>
            )}

            {/* Password Fields */}
            {isChangingPassword && (
              <>
                <div>
                  <label className="text-sm font-medium">Current Password</label>
                  <Input
                    type="password"
                    value={formData.current_password}
                    onChange={(e) =>
                      setFormData({ ...formData, current_password: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">New Password</label>
                  <Input
                    type="password"
                    value={formData.new_password}
                    onChange={(e) =>
                      setFormData({ ...formData, new_password: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Confirm New Password</label>
                  <Input
                    type="password"
                    value={formData.confirm_password}
                    onChange={(e) =>
                      setFormData({ ...formData, confirm_password: e.target.value })
                    }
                  />
                </div>
              </>
            )}

            <Button
              onClick={handleProfileUpdate}
              disabled={loading}
              className="w-full mt-3"
            >
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rename Chat Modal */}
      <Dialog open={isRenameOpen} onOpenChange={setIsRenameOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Rename Chat</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-3">
            <Input
              value={renameData.name}
              onChange={(e) =>
                setRenameData({ ...renameData, name: e.target.value })
              }
              placeholder="Enter new chat name..."
            />
            <Button onClick={handleRenameChat} className="w-full">
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Chat Modal */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Chat</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete this chat? This action cannot be undone.
            </p>
          </DialogHeader>

          <div className="flex justify-end gap-3 mt-4">
            <Button
              variant="outline"
              onClick={() => {
                setIsDeleteOpen(false);
                setDeleteTarget(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteTarget) handleDeleteChat(deleteTarget);
                setIsDeleteOpen(false);
              }}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};