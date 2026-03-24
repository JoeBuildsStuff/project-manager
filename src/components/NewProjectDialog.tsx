import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { PlusCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

const CATEGORIES = [
  { value: "project", label: "Project (default)" },
  { value: "reference", label: "Reference" },
  { value: "tooling", label: "Tooling" },
];

const STATUSES = ["inbox", "active", "archived"];

const SLUG_RE = /[^a-z0-9-]/g;

export default function NewProjectDialog({ open, onOpenChange, onCreated }: Props) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("project");
  const [status, setStatus] = useState("inbox");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const slug = name.toLowerCase().replace(/ /g, "-").replace(SLUG_RE, "");
  const folderKey = slug || "";

  const reset = () => {
    setName("");
    setCategory("project");
    setStatus("inbox");
    setDescription("");
    setError("");
  };

  const handleClose = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleCreate = async () => {
    if (!slug) {
      setError("Project name is required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await invoke("create_project", {
        folderKey,
        folderName: slug,
        status,
        category,
        description: description.trim() || null,
      });
      onCreated();
      handleClose(false);
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PlusCircle className="h-4 w-4" />
            New project
          </DialogTitle>
          <DialogDescription className="text-xs">
            Creates the folder and adds an entry to the database.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="proj-name" className="text-xs">Project name</Label>
            <Input
              id="proj-name"
              className="h-8 text-xs"
              placeholder="my-new-project"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
            {folderKey && (
              <p className="font-mono text-[10px] text-muted-foreground">
                → {folderKey}
              </p>
            )}
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <Label className="text-xs">Category</Label>
            <Select value={category} onValueChange={(v) => v && setCategory(v)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value} className="text-xs">
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <Label className="text-xs">Status</Label>
            <Select value={status} onValueChange={(v) => v && setStatus(v)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="proj-desc" className="text-xs">
              Description <span className="text-muted-foreground/50">(optional)</span>
            </Label>
            <Input
              id="proj-desc"
              className="h-8 text-xs"
              placeholder="What is this project?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter>
          <DialogClose className="h-8 rounded-md border border-border px-3 text-xs text-muted-foreground hover:bg-accent">
            Cancel
          </DialogClose>
          <Button
            size="sm"
            className="h-8 text-xs"
            onClick={handleCreate}
            disabled={saving || !slug}
          >
            {saving ? "Creating…" : "Create project"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
