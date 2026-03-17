import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";
import { I18nProvider } from "@/contexts/i18n-context";

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
import OpenDay from "@/pages/admin/OpenDay";
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
      <Route path="/gab-c7x2p/login" component={Login} />
      
      {/* Admin Protected Routes wrapped in AuthProvider logic inside AdminLayout */}
      <Route path="/gab-c7x2p" component={Dashboard} />
      <Route path="/gab-c7x2p/pipeline" component={Pipeline} />
      <Route path="/gab-c7x2p/students" component={Students} />
      <Route path="/gab-c7x2p/groups" component={Groups} />
      <Route path="/gab-c7x2p/staff" component={Staff} />
      <Route path="/gab-c7x2p/activity" component={Activity} />
      <Route path="/gab-c7x2p/gallery" component={Gallery} />
      <Route path="/gab-c7x2p/open-day" component={OpenDay} />
      
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
          <I18nProvider>
            <TooltipProvider>
              <Router />
              <Toaster />
            </TooltipProvider>
          </I18nProvider>
        </AuthProvider>
      </WouterRouter>
    </QueryClientProvider>
  );
}

export default App;
