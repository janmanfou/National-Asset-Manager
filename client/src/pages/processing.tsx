import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Loader2, Download, MoreVertical, RotateCcw, Clock, Zap, Timer } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function timeAgo(dateStr: string) {
  const now = new Date();
  const date = new Date(dateStr);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min < 60) return `${min}m ${sec}s`;
  const hr = Math.floor(min / 60);
  const remainMin = min % 60;
  return `${hr}h ${remainMin}m`;
}

function formatElapsed(startStr: string | null): string {
  if (!startStr) return "";
  const start = new Date(startStr).getTime();
  const now = Date.now();
  return formatDuration(now - start);
}

function calcEta(file: any): { etaStr: string; speed: string; perPage: string; votersPerMin: string } {
  const result = { etaStr: "Calculating...", speed: "", perPage: "", votersPerMin: "" };
  if (!file.processingStartedAt || !file.pagesProcessed || file.pagesProcessed === 0) return result;

  const startMs = new Date(file.processingStartedAt).getTime();
  const elapsed = Date.now() - startMs;
  const totalItems = (file.totalPages || 0) - (file.skippedPages || 0);
  const processed = file.pagesProcessed || 0;

  if (processed > 0 && totalItems > 0) {
    const avgMs = file.avgPageTimeMs || Math.floor(elapsed / processed);
    const remaining = totalItems - processed;
    const etaMs = remaining * avgMs;
    result.etaStr = remaining <= 0 ? "Almost done..." : formatDuration(etaMs);
    result.perPage = `${(avgMs / 1000).toFixed(1)}s/PDF`;
    const pdfPerHr = processed / (elapsed / 3600000);
    result.speed = `${pdfPerHr.toFixed(0)} PDFs/hr`;
    if (file.extractedCount > 0) {
      const votersPerMinute = (file.extractedCount / (elapsed / 60000));
      result.votersPerMin = `${votersPerMinute.toFixed(0)} voters/min`;
    }
  }

  return result;
}

export default function Processing() {
  const queryClient = useQueryClient();
  const { data: files, isLoading } = useQuery<any[]>({
    queryKey: ["/api/files"],
    refetchInterval: 2000,
  });

  const reprocessMutation = useMutation({
    mutationFn: async (fileId: string) => {
      const res = await fetch(`/api/files/${fileId}/reprocess`, { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error("Reprocess failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/files"] });
    },
  });

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Processing Queue</h1>
          <p className="text-muted-foreground mt-1">Real-time status of OCR and data extraction tasks.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">Pause Queue</Button>
          <Button variant="default">Retry Failed</Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : !files || files.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No files in the processing queue</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {files.map((file: any) => (
            <Card key={file.id} className="overflow-hidden" data-testid={`file-card-${file.id}`}>
              <div className="flex flex-col md:flex-row">
                <div className="p-6 flex-1 space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-muted rounded-lg">
                        <FileText className="h-6 w-6 text-foreground" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">{file.originalName}</h3>
                        <p className="text-sm text-muted-foreground">Size: {formatBytes(file.size)} • Uploaded: {timeAgo(file.createdAt)}</p>
                      </div>
                    </div>
                    <Badge variant={
                      file.status === "completed" ? "default" :
                      file.status === "processing" ? "secondary" :
                      file.status === "failed" ? "destructive" : "outline"
                    } className="capitalize">
                      {file.status === "processing" && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                      {file.status}
                    </Badge>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-medium">{file.progress}%</span>
                    </div>
                    <Progress value={file.progress} className="h-2" />
                    <div className="flex justify-between text-xs text-muted-foreground pt-1">
                      <span>PDF {file.pagesProcessed || 0} of {(file.totalPages || 0) - (file.skippedPages || 0)} valid{file.skippedPages > 0 ? ` (${file.skippedPages} empty skipped)` : ""}</span>
                      <span>{file.extractedCount || 0} voters extracted</span>
                    </div>
                  </div>
                </div>

                <div className="bg-muted/30 p-6 md:w-80 border-t md:border-t-0 md:border-l flex flex-col justify-between">
                  <div className="space-y-3">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status Info</h4>
                    <div className="space-y-2 font-mono text-xs text-muted-foreground">
                      {file.status === "processing" ? (
                        (() => {
                          const eta = calcEta(file);
                          const elapsed = formatElapsed(file.processingStartedAt);
                          return (
                            <>
                              <p>Processing PDF {file.pagesProcessed || 0} of {(file.totalPages || 0) - (file.skippedPages || 0)}...</p>
                              <p>{file.extractedCount || 0} voters extracted so far</p>
                              {elapsed && (
                                <div className="flex items-center gap-1 text-muted-foreground">
                                  <Timer className="h-3 w-3" />
                                  <span>Elapsed: {elapsed}</span>
                                </div>
                              )}
                              <div className="mt-2 p-2 rounded-md bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 space-y-1">
                                <div className="flex items-center gap-1 text-blue-700 dark:text-blue-300 font-semibold">
                                  <Clock className="h-3 w-3" />
                                  <span data-testid="text-eta">ETA: {eta.etaStr}</span>
                                </div>
                                {eta.perPage && (
                                  <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                                    <Zap className="h-3 w-3" />
                                    <span data-testid="text-speed">{eta.perPage} | {eta.speed}</span>
                                  </div>
                                )}
                                {eta.votersPerMin && (
                                  <div className="text-blue-600 dark:text-blue-400" data-testid="text-voters-rate">
                                    {eta.votersPerMin}
                                  </div>
                                )}
                              </div>
                              <p className="text-blue-600">OCR engine active</p>
                            </>
                          );
                        })()
                      ) : file.status === "completed" ? (
                        <>
                          <p>{file.pagesProcessed || 0} PDFs processed</p>
                          {file.skippedPages > 0 && <p>{file.skippedPages} empty files skipped</p>}
                          <p>{file.extractedCount || 0} voters extracted</p>
                          {file.processingStartedAt && (
                            <p className="text-muted-foreground">
                              Total time: {formatElapsed(file.processingStartedAt)}
                            </p>
                          )}
                          <p className="text-green-600">Task completed</p>
                        </>
                      ) : file.status === "failed" ? (
                        <>
                          <p>Stopped at PDF {file.pagesProcessed || 0}</p>
                          <p className="text-red-500">{file.errorMessage || "Processing failed"}</p>
                        </>
                      ) : (
                        <p>Waiting in queue...</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="pt-6 flex flex-col gap-2">
                     {file.status === "completed" && (
                       <Button size="sm" className="w-full" data-testid={`button-download-${file.id}`} onClick={() => {
                         window.open(`/api/files/${file.id}/download`, '_blank');
                       }}>
                         <Download className="mr-2 h-4 w-4" /> Download Excel
                       </Button>
                     )}
                     {(file.status === "completed" || file.status === "failed") && (
                       <Button
                         variant="outline"
                         size="sm"
                         className="w-full"
                         data-testid={`button-reprocess-${file.id}`}
                         disabled={reprocessMutation.isPending}
                         onClick={() => reprocessMutation.mutate(file.id)}
                       >
                         <RotateCcw className="mr-2 h-4 w-4" /> Reprocess
                       </Button>
                     )}
                     {file.status === "processing" && (
                       <p className="text-xs text-center text-muted-foreground">Processing in progress...</p>
                     )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
