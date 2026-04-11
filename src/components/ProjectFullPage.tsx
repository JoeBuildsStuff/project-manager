import { useState } from "react";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ProjectDetailContent } from "./ProjectDetailContent";
import { CategoryBadge, HostBadge, StatusBadge, StageBadge, DeployBadge } from "./StatusBadge";
import TaskTable from "./TaskTable";
import type { Project, Task } from "../types";

interface Props {
  project: Project;
  allProjects: Project[];
  onBack: () => void;
  onFieldChange: (folder_key: string, field: string, value: string | null) => Promise<void>;
  onRename: (folder_key: string, nextName: string) => Promise<void>;
  onDelete: (folder_key: string) => Promise<void>;
  onOpenTask: (task: Task) => void;
}

type Tab = "details" | "tasks";

export default function ProjectFullPage({
  project: p,
  allProjects,
  onBack,
  onFieldChange,
  onRename,
  onDelete,
  onOpenTask,
}: Props) {
  const [tab, setTab] = useState<Tab>("details");

  const handleDelete = async (folderKey: string) => {
    await onDelete(folderKey);
    onBack();
  };

  return (
    <div className="flex h-full flex-col min-h-0">
      {/* Top bar */}
      <div className="flex items-center gap-2 p-1 shrink-0">
        <SidebarTrigger className="-ml-1 shrink-0" />
        <Button variant="ghost" size="sm" className="gap-1.5 h-7 text-xs" onClick={onBack}>
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </Button>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-2 min-w-0">
          <h1 className="text-base font-semibold truncate">{p.folder_name}</h1>
          <span className="font-mono text-[10px] text-muted-foreground shrink-0">{p.folder_key}</span>
        </div>
        <div className="flex items-center gap-1.5 ml-auto shrink-0">
          {p.status && <StatusBadge status={p.status} />}
          {p.category && <CategoryBadge category={p.category} />}
          {p.stage && <StageBadge stage={p.stage} />}
          {p.host && <HostBadge host={p.host} />}
          {p.deploy_platform && <DeployBadge platform={p.deploy_platform} />}
          {(p.production_url || p.vercel_project_name) && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1 h-6 text-xs px-2"
              onClick={() => {
                const url = p.production_url
                  ? p.production_url
                  : `https://vercel.com/${p.vercel_team_slug ?? ""}/${p.vercel_project_name}`;
                window.open(url, "_blank");
              }}
            >
              <ExternalLink className="h-3 w-3" />
              {p.production_url ? "Production" : "Vercel"}
            </Button>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 p-1 shrink-0">
        <TabButton active={tab === "details"} onClick={() => setTab("details")}>Details</TabButton>
        <TabButton active={tab === "tasks"} onClick={() => setTab("tasks")}>Tasks</TabButton>
      </div>

      {/* Content */}
      {tab === "details" ? (
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-3 max-w-4xl">
            <ProjectDetailContent
              project={p}
              isOpen={true}
              onFieldChange={onFieldChange}
              onRename={onRename}
              onDelete={handleDelete}
              layout="page"
            />
          </div>
        </ScrollArea>
      ) : (
        <div className="flex-1 min-h-0 m-2 mb-0">
          <TaskTable
            project={p}
            allProjects={allProjects}
            onBack={() => setTab("details")}
            onOpenTask={onOpenTask}
            embedded
          />
        </div>
      )}
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`p-2 text-sm font-medium border-b-2 transition-colors ${
        active
          ? "border-foreground text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
