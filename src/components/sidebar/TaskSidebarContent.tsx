import {
  Zap,
  Inbox,
  Minus,
  ListTodo,
  Circle,
  Loader2,
  CheckCircle2,
  XCircle,
  Flag,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  CircleDot,
} from "lucide-react";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import type { Project } from "../../types";

export interface TaskSidebarContentProps {
  project: Project;
}

export function TaskSidebarContent({ project }: TaskSidebarContentProps) {
  return (
    <>
      <SidebarGroup>
        <SidebarGroupContent>
          <div className="px-2 py-1.5">
            <span className="text-xs font-semibold">{project.folder_name}</span>
          </div>
        </SidebarGroupContent>
      </SidebarGroup>

      <SidebarGroup>
        <SidebarGroupLabel>Task Status</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {[
              { icon: CircleDot, label: "All", color: "text-zinc-400" },
              { icon: Circle, label: "Open", color: "text-blue-400" },
              { icon: Loader2, label: "In Progress", color: "text-yellow-400" },
              { icon: CheckCircle2, label: "Done", color: "text-green-400" },
              { icon: XCircle, label: "Closed", color: "text-zinc-500" },
            ].map((opt) => {
              const Icon = opt.icon;
              return (
                <SidebarMenuItem key={opt.label}>
                  <SidebarMenuButton className="w-full" tooltip={opt.label}>
                    <Icon className={cn("h-3.5 w-3.5 shrink-0", opt.color)} />
                    <span>{opt.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      <SidebarGroup>
        <SidebarGroupLabel>Kind</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {[
              { icon: CircleDot, label: "All", color: "text-zinc-400" },
              { icon: ListTodo, label: "Task", color: "text-blue-400" },
              { icon: AlertTriangle, label: "Issue", color: "text-red-400" },
              { icon: Inbox, label: "Request", color: "text-purple-400" },
              { icon: Zap, label: "Next Step", color: "text-green-400" },
            ].map((opt) => {
              const Icon = opt.icon;
              return (
                <SidebarMenuItem key={opt.label}>
                  <SidebarMenuButton className="w-full" tooltip={opt.label}>
                    <Icon className={cn("h-3.5 w-3.5 shrink-0", opt.color)} />
                    <span>{opt.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      <SidebarGroup>
        <SidebarGroupLabel>Priority</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {[
              { icon: CircleDot, label: "All", color: "text-zinc-400" },
              { icon: Flag, label: "Urgent", color: "text-red-400" },
              { icon: ArrowUp, label: "High", color: "text-orange-400" },
              { icon: Minus, label: "Medium", color: "text-yellow-400" },
              { icon: ArrowDown, label: "Low", color: "text-zinc-500" },
            ].map((opt) => {
              const Icon = opt.icon;
              return (
                <SidebarMenuItem key={opt.label}>
                  <SidebarMenuButton className="w-full" tooltip={opt.label}>
                    <Icon className={cn("h-3.5 w-3.5 shrink-0", opt.color)} />
                    <span>{opt.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </>
  );
}
