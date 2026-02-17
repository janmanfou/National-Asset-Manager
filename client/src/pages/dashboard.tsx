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
  LineChart,
  Line
} from "recharts";
import { FileText, Users, AlertCircle, CheckCircle2, ArrowUpRight, Clock } from "lucide-react";

const stats = [
  { title: "Total Files Processed", value: "1,284", change: "+12% from last month", icon: FileText, color: "text-blue-500" },
  { title: "Voters Extracted", value: "45,231", change: "+8.5% from last month", icon: Users, color: "text-green-500" },
  { title: "Pending Queue", value: "12", change: "4 files currently processing", icon: Clock, color: "text-orange-500" },
  { title: "Flagged Records", value: "342", change: "Requires manual review", icon: AlertCircle, color: "text-red-500" },
];

const data = [
  { name: "Mon", processed: 45, failed: 2 },
  { name: "Tue", processed: 52, failed: 1 },
  { name: "Wed", processed: 38, failed: 0 },
  { name: "Thu", processed: 65, failed: 3 },
  { name: "Fri", processed: 48, failed: 1 },
  { name: "Sat", processed: 25, failed: 0 },
  { name: "Sun", processed: 15, failed: 0 },
];

export default function Dashboard() {
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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, i) => (
          <Card key={i} className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{stat.change}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Weekly Processing Volume</CardTitle>
            <CardDescription>Number of PDFs processed over the last 7 days.</CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={data}>
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
            <div className="space-y-8">
              {[
                { time: "2 mins ago", msg: "Batch #452 completed successfully", type: "success" },
                { time: "15 mins ago", msg: "Upload of 12 files initiated", type: "info" },
                { time: "1 hour ago", msg: "OCR Engine updated to v2.4.1", type: "system" },
                { time: "3 hours ago", msg: "Connection timeout on API endpoint", type: "error" },
                { time: "5 hours ago", msg: "Daily backup created", type: "success" },
              ].map((item, i) => (
                <div key={i} className="flex items-start">
                  <span className={`relative flex h-2 w-2 mr-4 mt-2 rounded-full 
                    ${item.type === 'success' ? 'bg-green-500' : 
                      item.type === 'error' ? 'bg-red-500' : 
                      item.type === 'system' ? 'bg-blue-500' : 'bg-slate-400'}`} 
                  />
                  <div className="space-y-1">
                    <p className="text-sm font-medium leading-none">{item.msg}</p>
                    <p className="text-xs text-muted-foreground">{item.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
