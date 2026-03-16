import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";

// Pages
import Home from "@/pages/Home";
import Login from "@/pages/admin/Login";
import Dashboard from "@/pages/admin/Dashboard";
import Pipeline from "@/pages/admin/Pipeline";
import Students from "@/pages/admin/Students";
import Groups from "@/pages/admin/Groups";
import Staff from "@/pages/admin/Staff";
import Activity from "@/pages/admin/Activity";
import Gallery from "@/pages/admin/Gallery";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Switch>
      {/* Public */}
      <Route path="/" component={Home} />
      
      {/* Admin Auth */}
      <Route path="/admin/login" component={Login} />
      
      {/* Admin Protected Routes wrapped in AuthProvider logic inside AdminLayout */}
      <Route path="/admin" component={Dashboard} />
      <Route path="/admin/pipeline" component={Pipeline} />
      <Route path="/admin/students" component={Students} />
      <Route path="/admin/groups" component={Groups} />
      <Route path="/admin/staff" component={Staff} />
      <Route path="/admin/activity" component={Activity} />
      <Route path="/admin/gallery" component={Gallery} />
      
      {/* 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <AuthProvider>
          <TooltipProvider>
            <Router />
            <Toaster />
          </TooltipProvider>
        </AuthProvider>
      </WouterRouter>
    </QueryClientProvider>
  );
}

export default App;
