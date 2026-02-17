import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { mockProcessingFiles } from "@/lib/mock-data";
import { FileText, Loader2, CheckCircle2, AlertCircle, Download, MoreVertical } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export default function Processing() {
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

      <div className="grid gap-6">
        {mockProcessingFiles.map((file) => (
          <Card key={file.id} className="overflow-hidden">
            <div className="flex flex-col md:flex-row">
              {/* File Info & Status */}
              <div className="p-6 flex-1 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-muted rounded-lg">
                      <FileText className="h-6 w-6 text-foreground" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">{file.name}</h3>
                      <p className="text-sm text-muted-foreground">Size: {file.size} • Uploaded: {file.uploadTime}</p>
                    </div>
                  </div>
                  <Badge variant={
                    file.status === "Completed" ? "default" :
                    file.status === "Processing" ? "secondary" :
                    file.status === "Failed" ? "destructive" : "outline"
                  } className="capitalize">
                    {file.status === "Processing" && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                    {file.status}
                  </Badge>
                </div>

                {/* Progress Section */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-medium">{file.progress}%</span>
                  </div>
                  <Progress value={file.progress} className="h-2" />
                  <div className="flex justify-between text-xs text-muted-foreground pt-1">
                    <span>Processing page {file.pagesProcessed} of {file.totalPages}</span>
                    <span>{file.extractedCount} voters extracted</span>
                  </div>
                </div>
              </div>

              {/* Logs & Actions (Desktop Sidebar) */}
              <div className="bg-muted/30 p-6 md:w-80 border-t md:border-t-0 md:border-l flex flex-col justify-between">
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Latest Logs</h4>
                  <div className="space-y-2 font-mono text-xs text-muted-foreground">
                    {file.status === "Processing" ? (
                      <>
                        <p>10:42:15 - Initializing OCR engine...</p>
                        <p>10:42:18 - Page 12 layout detected</p>
                        <p className="text-blue-600">10:42:21 - Extracting voter table...</p>
                      </>
                    ) : file.status === "Completed" ? (
                      <>
                         <p>10:30:15 - Data validation passed</p>
                         <p>10:30:18 - Excel generated successfully</p>
                         <p className="text-green-600">10:30:20 - Task completed</p>
                      </>
                    ) : (
                      <>
                        <p>10:15:00 - Processing started</p>
                        <p className="text-red-500">10:15:22 - Error: Image corrupted</p>
                      </>
                    )}
                  </div>
                </div>
                
                <div className="pt-6 flex justify-end gap-2">
                   {file.status === "Completed" ? (
                     <Button size="sm" className="w-full">
                       <Download className="mr-2 h-4 w-4" /> Download Excel
                     </Button>
                   ) : (
                     <DropdownMenu>
                       <DropdownMenuTrigger asChild>
                         <Button variant="outline" size="sm" className="w-full">
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
    </div>
  );
}
