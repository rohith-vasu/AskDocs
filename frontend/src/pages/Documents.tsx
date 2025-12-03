import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Upload,
  Trash2,
  Pencil,
  Search,
  PlusCircle,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import api from '@/lib/api';
import { toast } from 'sonner';
import { Document } from '@/types';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// ----------------------------------------------------
// Types
// ----------------------------------------------------
interface Session {
  id: string;
  name: string;
}

// ----------------------------------------------------
// Main Component
// ----------------------------------------------------
export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<string>('');
  const [createNewSession, setCreateNewSession] = useState(false);
  const [newSessionName, setNewSessionName] = useState('');

  const observer = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');

  const hasFetched = useRef(false);

  const [sessionNameError, setSessionNameError] = useState("");
  const [hasRecentUpload, setHasRecentUpload] = useState(false);

  // ----------------------------------------------------
  // Fetch Documents
  // ----------------------------------------------------
  const fetchDocuments = async (reset = false) => {
    if (loading) return;
    setLoading(true);

    try {
      const skip = reset ? 0 : page * 50;
      const response = await api.get(`/documents?skip=${skip}&limit=50`);
      const fetchedDocs: Document[] = response.data?.data || [];

      setDocuments((prev) => {
        const combined = reset ? fetchedDocs : [...prev, ...fetchedDocs];
        const unique: Document[] = Array.from(
          new Map(combined.map((d) => [d.id, d])).values()
        );
        return unique;
      });

      // ✅ Preserve selections for still-existing documents
      setSelectedDocs((prevSelected) => {
        const fetchedIds = new Set(fetchedDocs.map((d) => d.id));
        return prevSelected.filter((id) => fetchedIds.has(id));
      });

      setHasMore(fetchedDocs.length === 50);
      if (reset) setPage(1);
      else setPage((prev) => prev + 1);
    } catch {
      toast.error('Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  // ----------------------------------------------------
  // Initial Fetch (Run Once)
  // ----------------------------------------------------
  useEffect(() => {
    if (!hasFetched.current) {
      fetchDocuments(true);
      hasFetched.current = true;
    }
  }, []);

  // ----------------------------------------------------
  // Auto Refresh (for "processing" docs)
  // ----------------------------------------------------
  useEffect(() => {
    const hasProcessing = documents.some(
      (doc) => doc.status?.toLowerCase() === 'processing'
    );

    // Use aggressive polling if we have recent upload or processing docs
    const shouldPoll = hasProcessing || hasRecentUpload;
    // Aggressive polling (2s) after upload, slower (7s) for background checks
    const pollInterval = hasRecentUpload ? 2000 : 7000;

    if (!shouldPoll) {
      setHasRecentUpload(false);
      return;
    }

    const interval = setInterval(() => {
      if (!loading) {
        fetchDocuments(true); // Reset to refresh status updates
      }
    }, pollInterval);

    // Stop aggressive polling if no processing docs found
    if (!hasProcessing && hasRecentUpload) {
      setHasRecentUpload(false);
    }

    return () => clearInterval(interval);
  }, [documents, loading, hasRecentUpload]);

  // ----------------------------------------------------
  // Infinite Scroll
  // ----------------------------------------------------
  useEffect(() => {
    if (!hasMore || loading) return;

    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) fetchDocuments();
    });
    if (loadMoreRef.current) observer.current.observe(loadMoreRef.current);
  }, [hasMore, loading]);

  // ----------------------------------------------------
  // Upload Documents
  // ----------------------------------------------------
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const formData = new FormData();
    for (const file of Array.from(files)) {
      formData.append('files', file);
    }

    try {
      toast.info('Uploading documents...');
      await api.post('/documents/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('Document(s) uploaded successfully');

      // Trigger aggressive polling after upload
      setHasRecentUpload(true);

      // Immediately fetch to show new documents
      fetchDocuments(true);
    } catch (error) {
      toast.error('Failed to upload document(s)');
    } finally {
      event.target.value = '';
    }
  };

  // ----------------------------------------------------
  // Delete Document
  // ----------------------------------------------------
  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/documents/${id}`);
      toast.success('Document deleted');
      setDocuments((prev) => prev.filter((doc) => doc.id !== id));
    } catch {
      toast.error('Failed to delete document');
    }
  };

  // ----------------------------------------------------
  // Rename Document
  // ----------------------------------------------------
  const handleRename = async (id: string, newName: string) => {
    if (!newName.trim()) return;
    try {
      await api.patch(`/documents/${id}`, { filename: newName });
      setDocuments((prev) =>
        prev.map((doc) => (doc.id === id ? { ...doc, filename: newName } : doc))
      );
      toast.success('Document renamed');
    } catch {
      toast.error('Rename failed');
    }
  };

  // ----------------------------------------------------
  // Add to Chat Session
  // ----------------------------------------------------
  const handleAddToSession = async () => {
    try {
      let sessionId = selectedSession;

      if (createNewSession) {
        if (!newSessionName.trim()) {
          toast.error("Please enter a session name");
          return;
        }

        const res = await api.post("/sessions/", null, {
          params: { session_name: newSessionName },
        });
        sessionId = res.data?.data?.data?.id;
      }

      console.log(sessionId);

      await api.post("/sessions/add_documents", {
        session_id: sessionId,
        document_id: selectedDocs,
      });

      window.dispatchEvent(new Event("sessionsUpdated"));

      toast.success("Documents added to session successfully");
      setShowAddModal(false);
    } catch (error) {
      toast.error("Failed to add documents to session");
    }
  };

  const fetchSessions = async () => {
    try {
      const res = await api.get('/sessions');
      setSessions(res.data?.data || []);
    } catch {
      toast.error('Failed to load sessions');
    }
  };

  // ----------------------------------------------------
  // Session Name Validation
  // ----------------------------------------------------
  useEffect(() => {
    if (!newSessionName.trim()) {
      setSessionNameError("");
      return;
    }

    const exists = sessions.some(
      (s) => s.name.toLowerCase() === newSessionName.toLowerCase()
    );
    if (exists) {
      setSessionNameError("A session with this name already exists");
    } else {
      setSessionNameError("");
    }
  }, [newSessionName, sessions]);




  const filteredDocs = useMemo(
    () =>
      documents.filter((doc) =>
        doc.filename.toLowerCase().includes(searchTerm.toLowerCase())
      ),
    [documents, searchTerm]
  );

  const toggleSelect = useCallback((id: string) => {
    setSelectedDocs((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }, []);


  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  // ----------------------------------------------------
  // Render
  // ----------------------------------------------------
  return (
    <div className="p-6 pt-16 md:pt-6 space-y-4">
      {/* Top Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 md:gap-2">
        <div className="flex items-center gap-2 w-full md:w-1/2">
          <Search className="w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search documents..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <Input
            id="file-upload"
            type="file"
            multiple
            className="hidden"
            onChange={handleFileUpload}
          />
          <Button
            onClick={() => document.getElementById('file-upload')?.click()}
            className="flex items-center gap-2"
          >
            <Upload className="w-4 h-4" /> Upload Files
          </Button>

          <Button
            disabled={selectedDocs.length === 0}
            variant="secondary"
            className="flex items-center gap-2"
            onClick={() => {
              fetchSessions();
              setShowAddModal(true);
            }}
          >
            <PlusCircle className="w-4 h-4" /> Add to Chat Session
          </Button>
        </div>
      </div>

      {/* Document Table */}
      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]"></TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {filteredDocs.map((doc) => {
                const status = doc.status?.toLowerCase();
                const statusColor =
                  status === 'completed'
                    ? 'text-green-600'
                    : status === 'processing'
                      ? 'text-yellow-600'
                      : 'text-red-600';

                return (
                  <TableRow
                    key={doc.id}
                    onClick={(e) => {
                      const isCheckbox = (e.target as HTMLElement).closest('input[type="checkbox"]');
                      if (!isCheckbox) toggleSelect(doc.id);
                    }}
                    className={`cursor-pointer transition-all duration-150 ${selectedDocs.includes(doc.id) ? "bg-muted/60" : "hover:bg-muted/20"
                      }`}
                  >
                    <TableCell className="text-center">
                      <input
                        type="checkbox"
                        checked={selectedDocs.includes(doc.id)}
                        onChange={() => toggleSelect(doc.id)}
                        className="form-checkbox h-4 w-4 accent-primary cursor-pointer"
                      />
                    </TableCell>

                    <TableCell>
                      {editingId === doc.id ? (
                        <Input
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => {
                            handleRename(doc.id, editValue);
                            setEditingId(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleRename(doc.id, editValue);
                              setEditingId(null);
                            } else if (e.key === 'Escape') {
                              setEditingId(null);
                            }
                          }}
                          autoFocus
                          className="w-full max-w-xs"
                        />
                      ) : (
                        <span className="cursor-pointer">{doc.filename}</span>
                      )}
                    </TableCell>

                    <TableCell className={statusColor}>
                      {status?.charAt(0).toUpperCase() + status?.slice(1)}
                    </TableCell>

                    <TableCell>
                      {new Date(doc.created_at).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </TableCell>

                    <TableCell className="space-x-2">
                      {/* Edit Button */}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingId(doc.id);
                          setEditValue(doc.filename);
                        }}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>

                      {/* Delete Confirmation Modal */}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="destructive">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Document</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete{" "}
                              <strong>{doc.filename}</strong>? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(doc.id)}
                              className="bg-red-600 hover:bg-red-700 text-white"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          <div ref={loadMoreRef} className="h-10"></div>
          {loading && (
            <p className="text-center text-sm text-muted-foreground py-2">
              Loading...
            </p>
          )}
        </CardContent>
      </Card>

      {/* Add to Chat Session Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add to Chat Session</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Switch
                checked={createNewSession}
                onCheckedChange={setCreateNewSession}
              />
              <Label>
                {createNewSession ? 'Create New Session' : 'Add to Existing Session'}
              </Label>
            </div>
            {createNewSession ? (
              <div>
                <Input
                  placeholder="Enter new session name"
                  value={newSessionName}
                  onChange={(e) => setNewSessionName(e.target.value)}
                />
                {sessionNameError && (
                  <p className="text-sm text-red-500 mt-1">{sessionNameError}</p>
                )}
              </div>
            ) : (
              <Select onValueChange={setSelectedSession}>
                <SelectTrigger>
                  <SelectValue placeholder="Select existing session" />
                </SelectTrigger>
                <SelectContent>
                  {sessions.map((session) => (
                    <SelectItem key={session.id} value={session.id}>
                      {session.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <DialogFooter>
            <Button
              onClick={handleAddToSession}
              disabled={!!sessionNameError || (!createNewSession && !selectedSession)}
            >
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
