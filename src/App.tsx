import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AdminPage } from "./pages/AdminPage";
import { BarCrawlPage } from "./pages/BarCrawlPage";
import { DiscoverPage } from "./pages/DiscoverPage";
import { HoppyHourPage } from "./pages/HoppyHourPage";
import { LoginPage } from "./pages/LoginPage";
import { OperatorsPage } from "./pages/OperatorsPage";
import { ProfilePage } from "./pages/ProfilePage";
import { RewardsPage } from "./pages/RewardsPage";
import { SavedPage } from "./pages/SavedPage";
import { VenueDetailPage } from "./pages/VenueDetailPage";
import { VenuesPage } from "./pages/VenuesPage";
import { WelcomePage } from "./pages/WelcomePage";

function App() {
  return (
    <Routes>
      {/* Public standalone pages — no app chrome */}
      <Route path="/welcome" element={<WelcomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/operators" element={<OperatorsPage />} />

      {/* App shell — requires login */}
      <Route element={<AppShell />}>
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<DiscoverPage />} />
          <Route path="/venues" element={<VenuesPage />} />
          <Route path="/venues/:venueId" element={<VenueDetailPage />} />
          <Route path="/crawl" element={<BarCrawlPage />} />
          <Route path="/hoppy" element={<HoppyHourPage />} />
          <Route path="/rewards" element={<RewardsPage />} />
          <Route path="/saved" element={<SavedPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
