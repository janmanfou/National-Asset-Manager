import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UploadCloud, File, X, FileArchive } from "lucide-react";
import { useState, useCallback } from "react";
import { useLocation } from "wouter";

export default function Upload() {
  const [dragActive, setDragActive] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [, setLocation] = useLocation();

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
      const newFiles = Array.from(e.dataTransfer.files).filter(file => 
        file.type === "application/pdf" || 
        file.type === "application/zip" || 
        file.type === "application/x-zip-compressed" ||
        file.name.endsWith(".zip")
      );
      setFiles(prev => [...prev, ...newFiles]);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files).filter(file => 
        file.type === "application/pdf" || 
        file.type === "application/zip" || 
        file.type === "application/x-zip-compressed" ||
        file.name.endsWith(".zip")
      );
      setFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = () => {
    // Simulate upload and redirect
    setLocation("/processing");
  };

  return (
    <div className="p-8 max-w-5xl mx-auto animate-in fade-in duration-500 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Batch Upload</h1>
        <p className="text-muted-foreground mt-1">Upload scanned electoral roll PDFs or Bulk ZIP archives for processing.</p>
      </div>

      <Card className={`border-2 border-dashed transition-colors ${dragActive ? "border-primary bg-primary/5" : "border-border"}`}>
        <CardContent 
          className="flex flex-col items-center justify-center py-20 text-center cursor-pointer"
          onDragEnter={handleDrag} 
          onDragLeave={handleDrag} 
          onDragOver={handleDrag} 
          onDrop={handleDrop}
          onClick={() => document.getElementById('file-upload')?.click()}
        >
          <div className="p-4 rounded-full bg-primary/10 mb-4">
            <UploadCloud className="h-10 w-10 text-primary" />
          </div>
          <h3 className="text-lg font-semibold mb-1">Drag and drop PDF or ZIP files here</h3>
          <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
            Support for scanned Hindi/English electoral rolls. <br/>
            <span className="font-medium text-primary">Bulk Upload:</span> ZIP archives supported up to <span className="font-bold">5GB</span>.
          </p>
          <Button variant="outline" className="mt-2" onClick={(e) => {
            e.stopPropagation();
            document.getElementById('file-upload')?.click();
          }}>
            Select Files
          </Button>
          <input 
            id="file-upload" 
            type="file" 
            className="hidden" 
            multiple 
            accept=".pdf,.zip,application/pdf,application/zip,application/x-zip-compressed"
            onChange={handleChange}
          />
        </CardContent>
      </Card>

      {files.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Selected Files ({files.length})</CardTitle>
            <CardDescription>Ready for upload and processing queue.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {files.map((file, i) => (
                <div key={i} className="flex items-center justify-between p-3 border rounded-md bg-muted/30">
                  <div className="flex items-center gap-3">
                    {file.name.endsWith('.zip') ? (
                      <FileArchive className="h-5 w-5 text-orange-500" />
                    ) : (
                      <File className="h-5 w-5 text-blue-500" />
                    )}
                    <div>
                      <p className="text-sm font-medium">{file.name}</p>
                      <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => removeFile(i)}>
                    <X className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setFiles([])}>Clear All</Button>
              <Button onClick={handleUpload}>Start Processing</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
