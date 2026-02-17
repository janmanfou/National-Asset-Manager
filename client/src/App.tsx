import { Switch, Route, useLocation } from "wouter";
import { Sidebar } from "@/components/layout/sidebar";
import Dashboard from "@/pages/dashboard";
import Upload from "@/pages/upload";
import Processing from "@/pages/processing";
import Records from "@/pages/records";
import Audit from "@/pages/audit";
import Settings from "@/pages/settings";
import Auth from "@/pages/auth";
import NotFound from "@/pages/not-found";
import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";

function App() {
  const [location, setLocation] = useLocation();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const auth = localStorage.getItem("voter_auth");
    setIsAuthenticated(!!auth);
    
    if (!auth && location !== "/auth") {
      setLocation("/auth");
    }
  }, [location, setLocation]);

  if (isAuthenticated === null) return null; // Loading state

  if (!isAuthenticated) {
    return (
      <>
        <Switch>
          <Route path="/auth" component={Auth} />
          <Route component={() => {
             // Redirect any other route to auth
             useEffect(() => setLocation("/auth"), []);
             return null;
          }} />
        </Switch>
        <Toaster />
      </>
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
          <Route path="/audit" component={Audit} />
          <Route path="/settings" component={Settings} />
          {/* Allow accessing auth page to re-login if needed, or redirect back */}
          <Route path="/auth" component={() => {
             useEffect(() => setLocation("/"), []);
             return null;
          }} />
          <Route component={NotFound} />
        </Switch>
      </main>
      <Toaster />
    </div>
  );
}

export default App;
