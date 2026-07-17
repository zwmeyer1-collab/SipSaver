import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { AdminPage } from "./pages/AdminPage";
import { BarCrawlPage } from "./pages/BarCrawlPage";
import { DiscoverPage } from "./pages/DiscoverPage";
import { HoppyHourPage } from "./pages/HoppyHourPage";
import { LoginPage } from "./pages/LoginPage";
import { RewardsPage } from "./pages/RewardsPage";
import { OperatorsPage } from "./pages/OperatorsPage";
import { SavedPage } from "./pages/SavedPage";
import { VenueDetailPage } from "./pages/VenueDetailPage";
import { VenuesPage } from "./pages/VenuesPage";
import { WelcomePage } from "./pages/WelcomePage";

function RootRedirect() {
  if (!localStorage.getItem("sipsaver_visited")) {
    return <Navigate to="/welcome" replace />;
  }
  return <DiscoverPage />;
}

function App() {
  return (
    <Routes>
      {/* Welcome / landing — no chrome, full-screen */}
      <Route path="/welcome" element={<WelcomePage />} />

      <Route element={<AppShell />}>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/venues" element={<VenuesPage />} />
        <Route path="/venues/:venueId" element={<VenueDetailPage />} />
        <Route path="/crawl" element={<BarCrawlPage />} />
        <Route path="/hoppy" element={<HoppyHourPage />} />
        <Route path="/rewards" element={<RewardsPage />} />
        <Route path="/saved" element={<SavedPage />} />
        <Route path="/operators" element={<OperatorsPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
