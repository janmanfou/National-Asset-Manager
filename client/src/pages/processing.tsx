import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Loader2, Download, MoreVertical } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useQuery } from "@tanstack/react-query";

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

export default function Processing() {
  const { data: files, isLoading } = useQuery<any[]>({
    queryKey: ["/api/files"],
    refetchInterval: 2000,
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
                      <span>Processing page {file.pagesProcessed || 0} of {file.totalPages || 0}</span>
                      <span>{file.extractedCount || 0} voters extracted</span>
                    </div>
                  </div>
                </div>

                <div className="bg-muted/30 p-6 md:w-80 border-t md:border-t-0 md:border-l flex flex-col justify-between">
                  <div className="space-y-3">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status Info</h4>
                    <div className="space-y-2 font-mono text-xs text-muted-foreground">
                      {file.status === "processing" ? (
                        <>
                          <p>Processing page {file.pagesProcessed || 0}...</p>
                          <p>{file.extractedCount || 0} voters extracted so far</p>
                          <p className="text-blue-600">OCR engine active</p>
                        </>
                      ) : file.status === "completed" ? (
                        <>
                          <p>All {file.totalPages || 0} pages processed</p>
                          <p>{file.extractedCount || 0} voters extracted</p>
                          <p className="text-green-600">Task completed</p>
                        </>
                      ) : file.status === "failed" ? (
                        <>
                          <p>Stopped at page {file.pagesProcessed || 0}</p>
                          <p className="text-red-500">{file.errorMessage || "Processing failed"}</p>
                        </>
                      ) : (
                        <p>Waiting in queue...</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="pt-6 flex justify-end gap-2">
                     {file.status === "completed" ? (
                       <Button size="sm" className="w-full" data-testid={`button-download-${file.id}`}>
                         <Download className="mr-2 h-4 w-4" /> Download Excel
                       </Button>
                     ) : (
                       <DropdownMenu>
                         <DropdownMenuTrigger asChild>
                           <Button variant="outline" size="sm" className="w-full" data-testid={`button-actions-${file.id}`}>
                             Actions <MoreVertical className="ml-2 h-4 w-4" />
                           </Button>
                         </DropdownMenuTrigger>
                         <DropdownMenuContent align="end">
                           <DropdownMenuItem>View Details</DropdownMenuItem>
                           <DropdownMenuItem>Cancel Processing</DropdownMenuItem>
                           <DropdownMenuItem className="text-destructive">Delete File</DropdownMenuItem>
                         </DropdownMenuContent>
                       </DropdownMenu>
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
