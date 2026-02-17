import { useState, useEffect } from "react";
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
import { Search, Filter, Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

const PAGE_SIZE = 20;

export default function Records() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setOffset(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading } = useQuery<{ records: any[]; total: number }>({
    queryKey: ["/api/voters", `?limit=${PAGE_SIZE}&offset=${offset}${debouncedSearch ? `&search=${encodeURIComponent(debouncedSearch)}` : ""}`],
  });

  const records = data?.records || [];
  const total = data?.total || 0;
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Data Records</h1>
          <p className="text-muted-foreground mt-1">Manage and verify extracted voter information.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" data-testid="button-export-csv">
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
          <Button data-testid="button-download-excel">
            <FileSpreadsheet className="mr-2 h-4 w-4" /> Download Full Excel
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, EPIC, or address..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="input-search"
          />
        </div>
        <Button variant="outline" size="icon" data-testid="button-filter">
          <Filter className="h-4 w-4" />
        </Button>
      </div>

      <div className="rounded-md border bg-card">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
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
              {records.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No records found
                  </TableCell>
                </TableRow>
              ) : (
                records.map((record: any) => (
                  <TableRow key={record.id} data-testid={`row-voter-${record.id}`}>
                    <TableCell className="font-mono">{record.serialNumber}</TableCell>
                    <TableCell className="font-medium">{record.voterName}</TableCell>
                    <TableCell className="text-muted-foreground">{record.relationName}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-xs">{record.epicNumber}</Badge>
                    </TableCell>
                    <TableCell>{record.gender}</TableCell>
                    <TableCell>{record.age}</TableCell>
                    <TableCell>
                      <Badge variant={
                        record.status === "verified" ? "default" :
                        record.status === "flagged" ? "destructive" : "secondary"
                      }>
                        {record.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" data-testid={`button-edit-${record.id}`}>Edit</Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </div>
      
      <div className="flex items-center justify-between px-2">
        <div className="text-sm text-muted-foreground" data-testid="text-pagination-info">
          Showing {total === 0 ? 0 : offset + 1} to {Math.min(offset + PAGE_SIZE, total)} of {total.toLocaleString()} entries
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            data-testid="button-previous"
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={offset + PAGE_SIZE >= total}
            onClick={() => setOffset(offset + PAGE_SIZE)}
            data-testid="button-next"
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
