import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, Filter, Download, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const auditLogs = [
  { id: 1, action: "File Upload", user: "John Doe", details: "Uploaded Delhi_South_Part12.pdf", time: "2 mins ago", status: "Success" },
  { id: 2, action: "Data Export", user: "Admin", details: "Exported 450 records to Excel", time: "15 mins ago", status: "Success" },
  { id: 3, action: "System Config", user: "System", details: "Updated OCR confidence threshold to 85%", time: "1 hour ago", status: "Warning" },
  { id: 4, action: "Login Attempt", user: "Unknown", details: "Failed login from IP 192.168.1.45", time: "3 hours ago", status: "Failed" },
  { id: 5, action: "File Delete", user: "John Doe", details: "Deleted corrupted file temp_882.pdf", time: "5 hours ago", status: "Success" },
  { id: 6, action: "Batch Process", user: "System", details: "Completed batch #451 processing", time: "Yesterday", status: "Success" },
];

export default function Audit() {
  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Audit Logs</h1>
          <p className="text-muted-foreground mt-1">System activity and security trail.</p>
        </div>
        <Button variant="outline">
          <Download className="mr-2 h-4 w-4" /> Export Log
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>System Activity</CardTitle>
              <CardDescription>Recent actions performed by users and system processes.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search logs..." className="pl-9 h-9" />
              </div>
              <Button variant="outline" size="icon" className="h-9 w-9">
                <Filter className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Details</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {auditLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-muted-foreground whitespace-nowrap">{log.time}</TableCell>
                  <TableCell className="font-medium">{log.user}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-3 w-3 text-muted-foreground" />
                      {log.action}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{log.details}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant={
                      log.status === "Success" ? "outline" :
                      log.status === "Failed" ? "destructive" : "secondary"
                    } className={log.status === "Success" ? "text-green-600 border-green-200 bg-green-50" : ""}>
                      {log.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
