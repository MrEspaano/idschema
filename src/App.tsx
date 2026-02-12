import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";
import WeeklySchedule from "./pages/WeeklySchedule";
import TermPlanning from "./pages/TermPlanning";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";
import AdminSchedule from "./pages/AdminSchedule";
import AdminTermPlan from "./pages/AdminTermPlan";
import AdminCodes from "./pages/AdminCodes";
import AdminClassStructure from "./pages/AdminClassStructure";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/veckoschema" element={<WeeklySchedule />} />
            <Route path="/terminsplanering" element={<TermPlanning />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/veckoschema" element={<AdminSchedule />} />
            <Route path="/admin/terminsplanering" element={<AdminTermPlan />} />
            <Route path="/admin/koder" element={<AdminCodes />} />
            <Route path="/admin/klassstruktur" element={<AdminClassStructure />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
