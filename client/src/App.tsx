import { Switch, Route, useLocation } from "wouter";
import { Sidebar } from "@/components/layout/sidebar";
import Dashboard from "@/pages/dashboard";
import Upload from "@/pages/upload";
import Processing from "@/pages/processing";
import Records from "@/pages/records";
import Audit from "@/pages/audit";
import Settings from "@/pages/settings";
import Analytics from "@/pages/analytics";
import Auth from "@/pages/auth";
import NotFound from "@/pages/not-found";
import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { queryClient, getQueryFn } from "@/lib/queryClient";
import { Loader2 } from "lucide-react";

function AppContent() {
  const [location, setLocation] = useLocation();

  const { data: user, isLoading, error } = useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
    staleTime: 0,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <Switch>
        <Route path="/auth" component={Auth} />
        <Route component={() => {
            useEffect(() => setLocation("/auth"), [setLocation]);
            return null;
        }} />
      </Switch>
    );
  }

  return (
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-muted/10">
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/upload" component={Upload} />
          <Route path="/processing" component={Processing} />
          <Route path="/records" component={Records} />
          <Route path="/analytics" component={Analytics} />
          <Route path="/audit" component={Audit} />
          <Route path="/settings" component={Settings} />
          <Route path="/auth" component={() => {
              useEffect(() => setLocation("/"), [setLocation]);
              return null;
          }} />
          <Route component={NotFound} />
        </Switch>
      </main>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
