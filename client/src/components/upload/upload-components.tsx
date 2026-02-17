import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { FileArchive, X, Pause, Play, CheckCircle2, Loader2, HardDrive } from "lucide-react";
import { cn } from "@/lib/utils";

interface UploadItemProps {
  file: File;
  progress: number;
  speed: string;
  eta: string;
  status: "uploading" | "paused" | "merging" | "extracting" | "completed" | "error";
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
}

export function UploadItem({ file, progress, speed, eta, status, onPause, onResume, onCancel }: UploadItemProps) {
  return (
    <div className="border rounded-lg p-4 bg-card shadow-sm animate-in fade-in slide-in-from-bottom-2">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-500/10 rounded-lg">
            <FileArchive className="h-6 w-6 text-orange-600" />
          </div>
          <div>
            <h4 className="font-medium text-sm truncate max-w-[200px] md:max-w-md" title={file.name}>
              {file.name}
            </h4>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
              <span>{(file.size / (1024 * 1024)).toFixed(2)} MB</span>
              {status === "uploading" && (
                <>
                  <span className="w-1 h-1 rounded-full bg-muted-foreground/40" />
                  <span className="text-primary font-mono">{speed}</span>
                  <span className="w-1 h-1 rounded-full bg-muted-foreground/40" />
                  <span>ETA: {eta}</span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {status === "uploading" && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onPause}>
              <Pause className="h-4 w-4" />
            </Button>
          )}
          {status === "paused" && (
            <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={onResume}>
              <Play className="h-4 w-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={onCancel}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            {status === "merging" && <Loader2 className="h-3 w-3 animate-spin text-blue-500" />}
            {status === "extracting" && <Loader2 className="h-3 w-3 animate-spin text-purple-500" />}
            {status === "completed" && <CheckCircle2 className="h-3 w-3 text-green-500" />}
            <span className={cn(
              "font-medium capitalize",
              status === "merging" && "text-blue-600",
              status === "extracting" && "text-purple-600",
              status === "completed" && "text-green-600",
              status === "error" && "text-destructive"
            )}>
              {status === "uploading" ? `Uploading Chunk ${Math.ceil(progress)}%` : status}...
            </span>
          </div>
          <span className="text-muted-foreground">{Math.round(progress)}%</span>
        </div>
        <Progress 
          value={progress} 
          className={cn(
            "h-2 transition-all",
            status === "completed" ? "bg-green-100 [&>div]:bg-green-500" :
            status === "paused" ? "opacity-60" : ""
          )} 
        />
      </div>
    </div>
  );
}

export function StorageWidget() {
  return (
    <div className="bg-muted/30 rounded-lg p-4 border flex items-center gap-4">
      <div className="p-2 bg-primary/10 rounded-full">
        <HardDrive className="h-5 w-5 text-primary" />
      </div>
      <div className="flex-1 space-y-1">
        <div className="flex justify-between text-sm font-medium">
          <span>Temporary Storage</span>
          <span>45.2 GB / 100 GB</span>
        </div>
        <Progress value={45.2} className="h-1.5" />
        <p className="text-xs text-muted-foreground">Auto-cleans processed files every 24h</p>
      </div>
    </div>
  );
}
