import { Routes, Route, Navigate } from "react-router";
import { RequireAuth } from "./components/RequireAuth";
import { SignUp } from "./pages/SignUp";
import { LogIn } from "./pages/LogIn";
import { Trips } from "./pages/Trips";

export default function App() {
  return (
    <Routes>
      <Route path="/signup" element={<SignUp />} />
      <Route path="/login" element={<LogIn />} />
      <Route
        path="/trips"
        element={
          <RequireAuth>
            <Trips />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/trips" replace />} />
    </Routes>
  );
}