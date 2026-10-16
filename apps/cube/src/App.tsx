import { Route, BrowserRouter as Router, Navigate, Routes } from "react-router";
import RequireAuthentication from "./components/auth/RequireAuthentication";
import { ScrollToTop } from "./components/common/ScrollToTop";
import AppLayout from "./layout/AppLayout";
import AppDirectory from "./pages/Apps/AppDirectory";
import NotFound from "./pages/OtherPage/NotFound";
import UserProfiles from "./pages/UserProfiles";
import SignIn from "./pages/AuthPages/SignIn";

export default function App() {
  return (
    <Router>
      <ScrollToTop />
      <Routes>
        <Route
          element={
            <RequireAuthentication>
              <AppLayout />
            </RequireAuthentication>
          }
        >
          <Route index path="/" element={<Navigate to="/apps" replace />} />
          <Route path="/apps" element={<AppDirectory />} />
          <Route path="/profile" element={<UserProfiles />} />
        </Route>

        <Route path="/signin" element={<SignIn />} />
        <Route path="/signup" element={<Navigate to="/signin" replace />} />
        <Route
          path="/reset-password"
          element={<Navigate to="/signin" replace />}
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  );
}
