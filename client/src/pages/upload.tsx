import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UploadCloud, FileArchive, Zap, ShieldCheck } from "lucide-react";
import { useState, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { UploadItem, StorageWidget } from "@/components/upload/upload-components";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { queryClient } from "@/lib/queryClient";

const CHUNK_SIZE = 5 * 1024 * 1024;

interface UploadingFile {
  file: File;
  progress: number;
  speed: string;
  eta: string;
  status: "uploading" | "paused" | "merging" | "extracting" | "completed" | "error";
  id: string;
  abortController?: AbortController;
}

async function chunkedUpload(
  file: File,
  id: string,
  setUploads: React.Dispatch<React.SetStateAction<UploadingFile[]>>,
  abortSignal: AbortSignal
) {
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  const startTime = Date.now();

  try {
    const initRes = await fetch("/api/files/upload/init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        fileName: file.name,
        fileSize: file.size,
        totalChunks,
        mimeType: file.type || "application/octet-stream",
      }),
      signal: abortSignal,
    });

    if (!initRes.ok) throw new Error("Failed to initialize upload");
    const { uploadId } = await initRes.json();

    for (let i = 0; i < totalChunks; i++) {
      if (abortSignal.aborted) return;

      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);

      const formData = new FormData();
      formData.append("chunk", chunk, `chunk_${i}`);
      formData.append("uploadId", uploadId);
      formData.append("chunkIndex", String(i));

      let retries = 0;
      const maxRetries = 3;

      while (retries <= maxRetries) {
        try {
          const chunkRes = await fetch("/api/files/upload/chunk", {
            method: "POST",
            credentials: "include",
            body: formData,
            signal: abortSignal,
          });

          if (!chunkRes.ok) {
            throw new Error(`Chunk ${i} failed`);
          }
          break;
        } catch (e: any) {
          if (abortSignal.aborted) return;
          retries++;
          if (retries > maxRetries) throw e;
          await new Promise(r => setTimeout(r, 1000 * retries));
        }
      }

      const uploaded = end;
      const progress = (uploaded / file.size) * 100;
      const elapsed = (Date.now() - startTime) / 1000;
      const speedBytes = uploaded / elapsed;
      const speedMb = (speedBytes / 1024 / 1024).toFixed(1);
      const remaining = file.size - uploaded;
      const etaSec = Math.max(0, Math.ceil(remaining / speedBytes));

      setUploads(prev => prev.map(u => u.id === id ? {
        ...u,
        progress: Math.min(progress, 99),
        speed: `${speedMb} MB/s`,
        eta: etaSec > 60 ? `${Math.ceil(etaSec / 60)}m` : `${etaSec}s`,
      } : u));
    }

    setUploads(prev => prev.map(u => u.id === id ? {
      ...u,
      progress: 99,
      status: "merging" as const,
      speed: "Assembling...",
      eta: "",
    } : u));

    const completeRes = await fetch("/api/files/upload/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ uploadId }),
      signal: abortSignal,
    });

    if (!completeRes.ok) throw new Error("Failed to complete upload");

    setUploads(prev => prev.map(u => u.id === id ? {
      ...u,
      progress: 100,
      status: "completed" as const,
      speed: "Done",
      eta: "",
    } : u));

    queryClient.invalidateQueries({ queryKey: ["/api/files"] });
    queryClient.invalidateQueries({ queryKey: ["/api/audit"] });
    queryClient.invalidateQueries({ queryKey: ["/api/analytics/dashboard"] });
  } catch (error: any) {
    if (abortSignal.aborted) return;
    setUploads(prev => prev.map(u => u.id === id ? {
      ...u,
      status: "error" as const,
      speed: error.message || "Failed",
      eta: "",
    } : u));
  }
}

async function smallFileUpload(
  file: File,
  id: string,
  setUploads: React.Dispatch<React.SetStateAction<UploadingFile[]>>,
  abortSignal: AbortSignal
) {
  try {
    const formData = new FormData();
    formData.append("file", file);

    const xhr = new XMLHttpRequest();
    const startTime = Date.now();

    const xhrPromise = new Promise<void>((resolve, reject) => {
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          const percent = (e.loaded / e.total) * 100;
          const elapsed = (Date.now() - startTime) / 1000;
          const speedBytes = e.loaded / elapsed;
          const speedMb = (speedBytes / 1024 / 1024).toFixed(1);
          const remaining = e.total - e.loaded;
          const etaSec = Math.max(0, Math.ceil(remaining / speedBytes));
          setUploads(prev => prev.map(u => u.id === id ? {
            ...u,
            progress: Math.min(percent, 99),
            speed: `${speedMb} MB/s`,
            eta: `${etaSec}s`,
          } : u));
        }
      });

      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          setUploads(prev => prev.map(u => u.id === id ? {
            ...u, progress: 100, status: "completed" as const, speed: "Done", eta: "",
          } : u));
          queryClient.invalidateQueries({ queryKey: ["/api/files"] });
          queryClient.invalidateQueries({ queryKey: ["/api/audit"] });
          queryClient.invalidateQueries({ queryKey: ["/api/analytics/dashboard"] });
          resolve();
        } else {
          reject(new Error("Upload failed"));
        }
      });

      xhr.addEventListener("error", () => reject(new Error("Network error")));

      abortSignal.addEventListener("abort", () => {
        xhr.abort();
        reject(new Error("Aborted"));
      });
    });

    xhr.open("POST", "/api/files/upload");
    xhr.withCredentials = true;
    xhr.send(formData);

    await xhrPromise;
  } catch (error: any) {
    if (abortSignal.aborted) return;
    setUploads(prev => prev.map(u => u.id === id ? {
      ...u, status: "error" as const, speed: error.message || "Failed", eta: "",
    } : u));
  }
}

export default function Upload() {
  const [dragActive, setDragActive] = useState(false);
  const [uploads, setUploads] = useState<UploadingFile[]>([]);
  const [, setLocation] = useLocation();
  const [autoProcess, setAutoProcess] = useState(true);
  const abortControllers = useRef<Map<string, AbortController>>(new Map());

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files.length > 0) {
      addFiles(Array.from(e.target.files));
    }
  };

  const addFiles = (files: File[]) => {
    const newUploads = files
      .filter(file =>
        file.type === "application/pdf" ||
        file.type === "application/zip" ||
        file.type === "application/x-zip-compressed" ||
        file.name.endsWith(".zip") ||
        file.name.endsWith(".pdf")
      )
      .map(file => {
        const id = Math.random().toString(36).substr(2, 9);
        const controller = new AbortController();
        abortControllers.current.set(id, controller);

        const useChunked = file.size > 20 * 1024 * 1024;
        if (useChunked) {
          chunkedUpload(file, id, setUploads, controller.signal);
        } else {
          smallFileUpload(file, id, setUploads, controller.signal);
        }

        return {
          file,
          progress: 0,
          speed: "Starting...",
          eta: "Calculating...",
          status: "uploading" as const,
          id,
        };
      });

    setUploads(prev => [...prev, ...newUploads]);
  };

  const cancelUpload = (id: string) => {
    const controller = abortControllers.current.get(id);
    if (controller) {
      controller.abort();
      abortControllers.current.delete(id);
    }
    setUploads(prev => prev.filter(u => u.id !== id));
  };

  const allCompleted = uploads.length > 0 && uploads.every(u => u.status === "completed");

  return (
    <div className="p-8 max-w-6xl mx-auto animate-in fade-in duration-500 space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Enterprise Upload Center</h1>
          <p className="text-muted-foreground mt-1">High-speed chunked upload for large ZIP archives (up to 5GB).</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center space-x-2 bg-card border rounded-full px-4 py-2 shadow-sm">
            <Switch
              id="auto-process"
              checked={autoProcess}
              onCheckedChange={setAutoProcess}
              data-testid="switch-auto-process"
            />
            <Label htmlFor="auto-process" className="cursor-pointer text-sm font-medium">Auto-start Processing</Label>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card className={`border-2 border-dashed transition-all duration-300 ${dragActive ? "border-primary bg-primary/5 scale-[1.01]" : "border-border hover:border-primary/50"}`}>
            <CardContent
              className="flex flex-col items-center justify-center py-16 text-center cursor-pointer relative overflow-hidden"
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => document.getElementById('file-upload')?.click()}
              data-testid="dropzone"
            >
              <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 to-transparent opacity-0 hover:opacity-100 transition-opacity" />

              <div className="p-5 rounded-full bg-primary/10 mb-6 relative z-10 group-hover:scale-110 transition-transform duration-300">
                <UploadCloud className="h-12 w-12 text-primary" />
              </div>

              <h3 className="text-xl font-semibold mb-2 relative z-10">
                Drop Large ZIP Archives Here
              </h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto relative z-10 leading-relaxed">
                Enterprise-grade chunked upload enabled. <br/>
                Supports <span className="font-semibold text-foreground">ZIP, PDF</span> up to <span className="font-semibold text-foreground">5GB</span>.
                <br/>Resume capability with auto-retry on failures.
              </p>

              <div className="flex gap-4 relative z-10">
                 <Button className="min-w-[140px] shadow-lg shadow-primary/20" onClick={(e) => {
                  e.stopPropagation();
                  document.getElementById('file-upload')?.click();
                }} data-testid="button-browse">
                  Browse System
                </Button>
              </div>

              <input
                id="file-upload"
                type="file"
                className="hidden"
                multiple
                accept=".pdf,.zip,application/pdf,application/zip,application/x-zip-compressed"
                onChange={handleChange}
                data-testid="input-file"
              />
            </CardContent>
          </Card>

          {uploads.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  Active Queue
                  <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    {uploads.length} files
                  </span>
                </h3>
                {allCompleted && (
                  <Button onClick={() => setLocation("/processing")} className="animate-in fade-in zoom-in" data-testid="button-go-processing">
                    Go to Processing Dashboard
                  </Button>
                )}
              </div>

              <div className="grid gap-4">
                {uploads.map((upload) => (
                  <UploadItem
                    key={upload.id}
                    {...upload}
                    onPause={() => {}}
                    onResume={() => {}}
                    onCancel={() => cancelUpload(upload.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <StorageWidget />

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-500 fill-amber-500" />
                Performance Metrics
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-sm text-muted-foreground">Upload Mode</span>
                <span className="font-mono font-medium text-green-600">Chunked</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-sm text-muted-foreground">Chunk Size</span>
                <span className="font-mono font-medium">5 MB</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-sm text-muted-foreground">Auto-Retry</span>
                <span className="font-mono font-medium">3 attempts</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-sm text-muted-foreground">Max File Size</span>
                <span className="font-mono font-medium">5 GB</span>
              </div>
            </CardContent>
          </Card>

          <div className="bg-blue-50 dark:bg-blue-950/30 p-4 rounded-lg border border-blue-100 dark:border-blue-900 text-sm text-blue-800 dark:text-blue-300">
            <h4 className="font-semibold mb-1 flex items-center gap-2">
              <FileArchive className="h-4 w-4" /> Pro Tip
            </h4>
            <p>
              Large files are automatically split into 5MB chunks and uploaded with retry capability. If upload fails, it will retry up to 3 times per chunk.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
