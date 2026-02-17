import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
} from "recharts";
import { FileText, Users, AlertCircle, CheckCircle2, ArrowUpRight, Clock, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

const weeklyData = [
  { name: "Mon", processed: 45, failed: 2 },
  { name: "Tue", processed: 52, failed: 1 },
  { name: "Wed", processed: 38, failed: 0 },
  { name: "Thu", processed: 65, failed: 3 },
  { name: "Fri", processed: 48, failed: 1 },
  { name: "Sat", processed: 25, failed: 0 },
  { name: "Sun", processed: 15, failed: 0 },
];

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

export default function Dashboard() {
  const { data: dashboard, isLoading: dashLoading } = useQuery<{
    fileStats: { total: number; pending: number; completed: number; failed: number };
    voterStats: { total: number; verified: number; flagged: number; incomplete: number };
  }>({
    queryKey: ["/api/analytics/dashboard"],
  });

  const { data: auditLogs, isLoading: auditLoading } = useQuery<any[]>({
    queryKey: ["/api/audit"],
  });

  const stats = dashboard
    ? [
        { title: "Total Files Processed", value: dashboard.fileStats.total.toLocaleString(), change: `${dashboard.fileStats.completed} completed`, icon: FileText, color: "text-blue-500" },
        { title: "Voters Extracted", value: dashboard.voterStats.total.toLocaleString(), change: `${dashboard.voterStats.verified} verified`, icon: Users, color: "text-green-500" },
        { title: "Pending Queue", value: dashboard.fileStats.pending.toLocaleString(), change: `${dashboard.fileStats.failed} failed`, icon: Clock, color: "text-orange-500" },
        { title: "Flagged Records", value: dashboard.voterStats.flagged.toLocaleString(), change: `${dashboard.voterStats.incomplete} incomplete`, icon: AlertCircle, color: "text-red-500" },
      ]
    : [];

  const recentActivity = auditLogs?.slice(0, 5) || [];

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">System overview and processing metrics.</p>
        </div>
        <div className="flex gap-3">
           <Button variant="outline">Export Report</Button>
           <Button>
            <ArrowUpRight className="mr-2 h-4 w-4" />
            New Upload
          </Button>
        </div>
      </div>

      {dashLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat, i) => (
            <Card key={i} className="hover:shadow-md transition-shadow" data-testid={`stat-card-${i}`}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid={`stat-value-${i}`}>{stat.value}</div>
                <p className="text-xs text-muted-foreground mt-1">{stat.change}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Weekly Processing Volume</CardTitle>
            <CardDescription>Number of PDFs processed over the last 7 days.</CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="name" 
                  stroke="#888888" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false} 
                />
                <YAxis 
                  stroke="#888888" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false} 
                  tickFormatter={(value) => `${value}`} 
                />
                <Tooltip 
                  cursor={{fill: 'hsl(var(--muted))', opacity: 0.4}}
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                />
                <Bar dataKey="processed" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="failed" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest system events and alerts.</CardDescription>
          </CardHeader>
          <CardContent>
            {auditLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No recent activity</p>
            ) : (
              <div className="space-y-8">
                {recentActivity.map((item: any, i: number) => (
                  <div key={item.id || i} className="flex items-start" data-testid={`activity-item-${i}`}>
                    <span className={`relative flex h-2 w-2 mr-4 mt-2 rounded-full 
                      ${item.status === 'Success' ? 'bg-green-500' : 
                        item.status === 'Failed' ? 'bg-red-500' : 'bg-slate-400'}`} 
                    />
                    <div className="space-y-1">
                      <p className="text-sm font-medium leading-none">{item.action}: {item.details}</p>
                      <p className="text-xs text-muted-foreground">{timeAgo(item.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
