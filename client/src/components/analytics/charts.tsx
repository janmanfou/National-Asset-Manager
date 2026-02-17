import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowUp, ArrowDown, Users, TrendingUp, AlertTriangle, CheckCircle2 } from "lucide-react";

// Mock Data
export const ageData = [
  { name: '18-25', value: 2400, fill: '#8884d8' },
  { name: '26-40', value: 4567, fill: '#82ca9d' },
  { name: '41-60', value: 3890, fill: '#ffc658' },
  { name: '60+', value: 1200, fill: '#ff8042' },
];

export const genderData = [
  { name: 'Male', value: 52, fill: '#3b82f6' },
  { name: 'Female', value: 48, fill: '#ec4899' },
];

export const boothPerformance = [
  { name: 'Booth 101', turnout: 85, impact: 90, swing: 20 },
  { name: 'Booth 102', turnout: 65, impact: 45, swing: 60 },
  { name: 'Booth 103', turnout: 45, impact: 30, swing: 80 },
  { name: 'Booth 104', turnout: 92, impact: 95, swing: 10 },
  { name: 'Booth 105', turnout: 55, impact: 40, swing: 70 },
];

export const radarData = [
  { subject: 'Youth Support', A: 120, fullMark: 150 },
  { subject: 'Female Voters', A: 98, fullMark: 150 },
  { subject: 'Turnout Hist.', A: 86, fullMark: 150 },
  { subject: 'Loyalty Score', A: 99, fullMark: 150 },
  { subject: 'Campaign Reach', A: 85, fullMark: 150 },
  { subject: 'Swing Factor', A: 65, fullMark: 150 },
];

// Components
export function AgeDistributionChart() {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={ageData}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
        <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
        <Tooltip 
          cursor={{fill: 'hsl(var(--muted))', opacity: 0.2}}
          contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
        />
        <Bar dataKey="value" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function GenderPieChart() {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={genderData}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={80}
          paddingAngle={5}
          dataKey="value"
        >
          {genderData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.fill} />
          ))}
        </Pie>
        <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function PredictiveRadar() {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
        <PolarGrid stroke="hsl(var(--border))" />
        <PolarAngleAxis dataKey="subject" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
        <PolarRadiusAxis angle={30} domain={[0, 150]} tick={false} axisLine={false} />
        <Radar name="Candidate A" dataKey="A" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.4} />
        <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }} />
      </RadarChart>
    </ResponsiveContainer>
  );
}

export function StrategyCard({ title, value, type, description }: { title: string, value: string, type: 'positive' | 'negative' | 'neutral', description: string }) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between space-y-0 pb-2">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          {type === 'positive' && <ArrowUp className="h-4 w-4 text-green-500" />}
          {type === 'negative' && <ArrowDown className="h-4 w-4 text-red-500" />}
          {type === 'neutral' && <TrendingUp className="h-4 w-4 text-blue-500" />}
        </div>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </CardContent>
    </Card>
  );
}

export function PriorityBoothList() {
  return (
    <div className="space-y-4">
      {boothPerformance.sort((a,b) => b.swing - a.swing).slice(0, 3).map((booth, i) => (
        <div key={i} className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border">
          <div className="space-y-1">
            <p className="font-medium">{booth.name}</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline" className="text-orange-600 border-orange-200 bg-orange-50">Swing Zone</Badge>
              <span>{booth.swing}% volatile</span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold">{booth.turnout}%</p>
            <p className="text-xs text-muted-foreground">Turnout</p>
          </div>
        </div>
      ))}
    </div>
  );
}
