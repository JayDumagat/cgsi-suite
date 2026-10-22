import { Navigate, Route, BrowserRouter as Router, Routes } from "react-router";
import CubePortalLayout from "@/components/cube/CubePortalLayout";
import { PortalSessionProvider } from "@/context/PortalSessionContext";
import Applications from "@/pages/CubePortal/Applications";
import Profile from "@/pages/CubePortal/Profile";
import CubeSignIn from "@/pages/CubePortal/SignIn";

export default function App() {
  return (
    <Router>
      <PortalSessionProvider>
        <Routes>
          <Route path="/signin" element={<CubeSignIn />} />
          <Route path="/" element={<CubePortalLayout />}>
            <Route index element={<Navigate to="/apps" replace />} />
            <Route path="apps" element={<Applications />} />
            <Route path="profile" element={<Profile />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </PortalSessionProvider>
    </Router>
  );
}
