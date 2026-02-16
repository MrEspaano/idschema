import { BrowserRouter, Route, Routes } from "react-router-dom";
import HomePage from "@/features/site/pages/HomePage";
import WeeklySchedulePage from "@/features/schedule/pages/WeeklySchedulePage";
import TermPlanningPage from "@/features/term-plan/pages/TermPlanningPage";
import AdminLoginPage from "@/features/admin/pages/AdminLoginPage";
import AdminDashboardPage from "@/features/admin/pages/AdminDashboardPage";
import AdminSchedulePage from "@/features/admin/pages/AdminSchedulePage";
import AdminTermPlanPage from "@/features/admin/pages/AdminTermPlanPage";
import AdminCodesPage from "@/features/admin/pages/AdminCodesPage";
import AdminClassStructurePage from "@/features/admin/pages/AdminClassStructurePage";
import NotFoundPage from "./NotFoundPage";

export const AppRouter = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/veckoschema" element={<WeeklySchedulePage />} />
        <Route path="/terminsplanering" element={<TermPlanningPage />} />
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="/admin" element={<AdminDashboardPage />} />
        <Route path="/admin/veckoschema" element={<AdminSchedulePage />} />
        <Route path="/admin/terminsplanering" element={<AdminTermPlanPage />} />
        <Route path="/admin/koder" element={<AdminCodesPage />} />
        <Route path="/admin/klassstruktur" element={<AdminClassStructurePage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
};
