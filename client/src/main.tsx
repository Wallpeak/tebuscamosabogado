import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import { Route, Switch, useLocation } from "wouter";
import CookieBanner from "./components/CookieBanner";
import ErrorBoundary from "./components/ErrorBoundary";
import { Toaster } from "./components/ui/sonner";
import WhatsAppButton from "./components/WhatsAppButton";
import "./index.css";
import { trpc } from "./lib/trpc";
import Dashboard from "./pages/Dashboard";
import Home from "./pages/Home";
import LegalPage from "./pages/LegalPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();
const trpcClient = trpc.createClient({
  links: [httpBatchLink({ url: "/api/trpc", transformer: superjson })],
});

function App() {
  const [location] = useLocation();
  const isPanel = location.startsWith("/dashboard");

  return (
    <ErrorBoundary>
      <Toaster />
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/aviso-legal">{() => <LegalPage type="aviso_legal" />}</Route>
        <Route path="/privacidad">{() => <LegalPage type="privacidad" />}</Route>
        <Route path="/cookies">{() => <LegalPage type="cookies" />}</Route>
        <Route component={NotFound} />
      </Switch>
      {/* El banner de cookies y WhatsApp son para visitantes, no para el panel privado. */}
      {!isPanel && (
        <>
          <CookieBanner />
          <WhatsAppButton />
        </>
      )}
    </ErrorBoundary>
  );
}

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);
