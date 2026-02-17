import { mockVoterRecords } from "@/lib/mock-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Filter, Download, FileSpreadsheet } from "lucide-react";

export default function Records() {
  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Data Records</h1>
          <p className="text-muted-foreground mt-1">Manage and verify extracted voter information.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
          <Button>
            <FileSpreadsheet className="mr-2 h-4 w-4" /> Download Full Excel
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name, EPIC, or address..." className="pl-9" />
        </div>
        <Button variant="outline" size="icon">
          <Filter className="h-4 w-4" />
        </Button>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Serial No</TableHead>
              <TableHead>Voter Name</TableHead>
              <TableHead>Relation Name</TableHead>
              <TableHead>EPIC Number</TableHead>
              <TableHead>Gender</TableHead>
              <TableHead>Age</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mockVoterRecords.map((record) => (
              <TableRow key={record.id}>
                <TableCell className="font-mono">{record.serialNumber}</TableCell>
                <TableCell className="font-medium">{record.name}</TableCell>
                <TableCell className="text-muted-foreground">{record.relationName}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="font-mono text-xs">{record.epicNumber}</Badge>
                </TableCell>
                <TableCell>{record.gender}</TableCell>
                <TableCell>{record.age}</TableCell>
                <TableCell>
                  <Badge variant={
                    record.status === "Verified" ? "default" :
                    record.status === "Flagged" ? "destructive" : "secondary"
                  }>
                    {record.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm">Edit</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      
      <div className="flex items-center justify-between px-2">
        <div className="text-sm text-muted-foreground">
          Showing 1 to 10 of 45,231 entries
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled>Previous</Button>
          <Button variant="outline" size="sm">Next</Button>
        </div>
      </div>
    </div>
  );
}
