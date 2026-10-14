import { Routes, Route, Navigate } from "react-router";
import { RequireAuth } from "./components/RequireAuth";
import { SignUp } from "./pages/SignUp";
import { LogIn } from "./pages/LogIn";
import { Trips } from "./pages/Trips";
import { NewTrip } from "./pages/NewTrip";
import { TripPage } from "./pages/TripPage";
import { JoinTrip } from "./pages/JoinTrip";
import { ExpenseForm } from "./pages/ExpenseForm";
import { NewPoll } from "./pages/NewPoll";

export default function App() {
  return (
    <Routes>
      <Route path="/signup" element={<SignUp />} />
      <Route path="/login" element={<LogIn />} />
      <Route path="/trips" element={<RequireAuth><Trips /></RequireAuth>} />
      <Route path="/trips/new" element={<RequireAuth><NewTrip /></RequireAuth>} />
      <Route path="/trips/:tripId" element={<RequireAuth><TripPage /></RequireAuth>} />
      <Route path="/trips/:tripId/expenses/new" element={<RequireAuth><ExpenseForm /></RequireAuth>} />
      <Route path="/trips/:tripId/expenses/:expenseId/edit" element={<RequireAuth><ExpenseForm /></RequireAuth>} />
            <Route path="/trips/:tripId/polls/new" element={<RequireAuth><NewPoll /></RequireAuth>} />
      <Route path="/join/:code" element={<RequireAuth><JoinTrip /></RequireAuth>} />
      <Route path="*" element={<Navigate to="/trips" replace />} />
    </Routes>
  );
}