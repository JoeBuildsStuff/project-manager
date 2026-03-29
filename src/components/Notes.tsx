import { SidebarTrigger } from "@/components/ui/sidebar";
import Tiptap from "@/components/tiptap/tiptap";

export default function Notes() {
  return (
    <div className="m-2 flex min-h-0 flex-1 flex-col rounded-xl border bg-background">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <SidebarTrigger className="-ml-1" />
        <h1 className="text-sm font-medium">Notes</h1>
      </div>
      <div className="flex-1" />
    </div>
  );
}
