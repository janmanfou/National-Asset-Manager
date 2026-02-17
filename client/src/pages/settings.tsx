import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Save } from "lucide-react";

export default function Settings() {
  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500 max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">System Settings</h1>
        <p className="text-muted-foreground mt-1">Configure OCR engine, export formats, and system preferences.</p>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-8">
          <TabsTrigger value="general">General Configuration</TabsTrigger>
          <TabsTrigger value="ocr">OCR Engine</TabsTrigger>
          <TabsTrigger value="security">Security & Access</TabsTrigger>
        </TabsList>
        
        <TabsContent value="general" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>File Retention Policy</CardTitle>
              <CardDescription>Manage how long processed files are stored in the system.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Auto-delete raw PDFs</Label>
                  <p className="text-sm text-muted-foreground">Automatically remove uploaded PDFs after successful processing.</p>
                </div>
                <Switch defaultChecked />
              </div>
              <Separator />
              <div className="grid gap-2">
                <Label>Retention Period (Days)</Label>
                <Input type="number" defaultValue="30" className="max-w-[200px]" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Export Settings</CardTitle>
              <CardDescription>Configure default formats for data exports.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label>Default Excel Template</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                  <option>Standard Voter Roll Format (v2.1)</option>
                  <option>Election Commission Standard (XML)</option>
                  <option>Compact CSV (Data Only)</option>
                </select>
              </div>
              <div className="flex items-center space-x-2">
                <Switch id="include-meta" defaultChecked />
                <Label htmlFor="include-meta">Include metadata sheet in Excel export</Label>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ocr" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>OCR Processing Parameters</CardTitle>
              <CardDescription>Fine-tune the optical character recognition engine.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Confidence Threshold</Label>
                    <span className="text-sm text-muted-foreground">85%</span>
                  </div>
                  <input type="range" className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer" min="0" max="100" defaultValue="85" />
                  <p className="text-xs text-muted-foreground">Results below this confidence level will be flagged for manual review.</p>
                </div>
                
                <div className="space-y-2">
                  <Label>Language Priority</Label>
                  <div className="flex gap-4">
                    <div className="flex items-center space-x-2">
                      <input type="radio" id="eng-hin" name="lang" defaultChecked className="aspect-square h-4 w-4 rounded-full border border-primary text-primary shadow focus:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50" />
                      <Label htmlFor="eng-hin">English + Hindi (Mixed)</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input type="radio" id="eng" name="lang" className="aspect-square h-4 w-4 rounded-full border border-primary text-primary shadow focus:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50" />
                      <Label htmlFor="eng">English Only</Label>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4">
                   <div className="space-y-0.5">
                    <Label>Enhanced Noise Reduction</Label>
                    <p className="text-sm text-muted-foreground">Apply aggressive preprocessing for old/scanned documents.</p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button>
                <Save className="mr-2 h-4 w-4" /> Save Configuration
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>API Access</CardTitle>
              <CardDescription>Manage API keys for external system integration.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid gap-2">
                  <Label>Current API Key</Label>
                  <div className="flex gap-2">
                    <Input value="pk_live_51MzQ8I..." readOnly className="font-mono bg-muted" />
                    <Button variant="outline">Regenerate</Button>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch id="api-enabled" defaultChecked />
                  <Label htmlFor="api-enabled">Enable Public API Access</Label>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
