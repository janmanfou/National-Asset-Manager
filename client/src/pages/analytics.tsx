import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  AgeDistributionChart, 
  GenderPieChart, 
  PredictiveRadar, 
  StrategyCard,
  PriorityBoothList
} from "@/components/analytics/charts";
import { Download, Share2, Printer, Map, Zap, Target, Users } from "lucide-react";

export default function Analytics() {
  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            Election Intelligence Engine
            <span className="text-xs font-normal text-white bg-gradient-to-r from-purple-500 to-blue-500 px-2 py-1 rounded-full">BETA</span>
          </h1>
          <p className="text-muted-foreground mt-1">Predictive insights and campaign strategy generation.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Share2 className="mr-2 h-4 w-4" /> Share
          </Button>
          <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 border-0">
            <Download className="mr-2 h-4 w-4" /> Generate Strategy Report
          </Button>
        </div>
      </div>

      {/* Top Strategy Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StrategyCard 
          title="Winning Probability" 
          value="68.4%" 
          type="positive" 
          description="+4.2% from last week"
        />
        <StrategyCard 
          title="Swing Voter Zone" 
          value="12 Booths" 
          type="neutral" 
          description="High volatility detected"
        />
        <StrategyCard 
          title="Turnout Deficit" 
          value="-15%" 
          type="negative" 
          description="In youth demographic (18-25)"
        />
        <StrategyCard 
          title="Campaign ROI" 
          value="High" 
          type="positive" 
          description="Optimized for rural wards"
        />
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="bg-muted/50 p-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="demographics">Demographics</TabsTrigger>
          <TabsTrigger value="predictive">Predictive AI</TabsTrigger>
          <TabsTrigger value="booths">Booth Management</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
            <Card className="col-span-4">
              <CardHeader>
                <CardTitle>Voter Segmentation</CardTitle>
                <CardDescription>Age-wise distribution across all constituencies.</CardDescription>
              </CardHeader>
              <CardContent>
                <AgeDistributionChart />
              </CardContent>
            </Card>
            
            <Card className="col-span-3">
              <CardHeader>
                <CardTitle>Campaign Health</CardTitle>
                <CardDescription>Multi-factor performance analysis.</CardDescription>
              </CardHeader>
              <CardContent>
                <PredictiveRadar />
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <Card className="col-span-1 bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950/20 dark:to-blue-950/20 border-blue-100 dark:border-blue-900">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
                  <Target className="h-5 w-5" />
                  Priority Focus Areas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <PriorityBoothList />
              </CardContent>
            </Card>

            <Card className="col-span-2">
              <CardHeader>
                <CardTitle>Gender Distribution</CardTitle>
                <CardDescription>Detailed gender split analysis.</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-around">
                <div className="w-1/2">
                   <GenderPieChart />
                </div>
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500" />
                    <div>
                      <p className="font-medium">Male Voters</p>
                      <p className="text-2xl font-bold">52%</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-pink-500" />
                    <div>
                      <p className="font-medium">Female Voters</p>
                      <p className="text-2xl font-bold">48%</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Placeholder for other tabs */}
        <TabsContent value="demographics" className="min-h-[400px] flex items-center justify-center border rounded-lg bg-muted/10">
          <div className="text-center">
            <Users className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">Demographic Deep Dive</h3>
            <p className="text-muted-foreground">Advanced filtering coming soon in v1.2</p>
          </div>
        </TabsContent>
        
        <TabsContent value="predictive" className="min-h-[400px] flex items-center justify-center border rounded-lg bg-muted/10">
          <div className="text-center">
            <Zap className="h-10 w-10 mx-auto text-yellow-500 mb-4" />
            <h3 className="text-lg font-medium">AI Prediction Model</h3>
            <p className="text-muted-foreground">Training on historical booth data...</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
