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
import AdminMasterDataPage from "@/features/admin/pages/AdminMasterDataPage";
import AdminUsersPage from "@/features/admin/pages/AdminUsersPage";
import AdminExceptionsPage from "@/features/admin/pages/AdminExceptionsPage";
import AdminHistoryPage from "@/features/admin/pages/AdminHistoryPage";
import AdminSystemStatusPage from "@/features/admin/pages/AdminSystemStatusPage";
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
        <Route path="/admin/masterdata" element={<AdminMasterDataPage />} />
        <Route path="/admin/anvandare" element={<AdminUsersPage />} />
        <Route path="/admin/avvikelser" element={<AdminExceptionsPage />} />
        <Route path="/admin/historik" element={<AdminHistoryPage />} />
        <Route path="/admin/systemstatus" element={<AdminSystemStatusPage />} />

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
};
