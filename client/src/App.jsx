// client/src/App.jsx
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

// Public pages
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";

// Student pages
import StudyHome from "./pages/student/StudyHome.jsx";
import MockTestRunner from "./pages/student/MockTestRunner.jsx";
import MockReviewPage from "./pages/student/MockReviewPage.jsx";

// Admin pages
import AdminDashboard from "./pages/admin/AdminDashboard.jsx";
import ManageDocuments from "./pages/admin/ManageDocuments.jsx";
import ManageUsers from "./pages/admin/ManageUsers.jsx";
import ManageTests from "./pages/admin/ManageTests.jsx";
import MockBuilder from "./pages/admin/MockBuilder.jsx";
import QuickCreate from "./pages/admin/QuickCreate.jsx";

// >>> NEW admin result pages
import AdminResults from "./pages/admin/AdminResults.jsx";
import AdminResultDetail from "./pages/admin/AdminResultDetail.jsx";

// Shared
import PrivateRoute from "./components/PrivateRoute.jsx";
import NotFound from "./pages/NotFound.jsx";

function App() {
  return (
    <Router>
      <Routes>
        {/* -------- PUBLIC -------- */}
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* -------- STUDENT -------- */}

        {/* main dashboard */}
        <Route
          path="/study/home"
          element={
            <PrivateRoute>
              <StudyHome />
            </PrivateRoute>
          }
        />

        {/* legacy /study -> redirect to /study/home */}
        <Route
          path="/study"
          element={
            <PrivateRoute>
              <Navigate to="/study/home" replace />
            </PrivateRoute>
          }
        />

        {/* take a test */}
        <Route
          path="/mock/:id/run"
          element={
            <PrivateRoute>
              <MockTestRunner />
            </PrivateRoute>
          }
        />

        {/* review after finishing */}
        <Route
          path="/mock/:id/review"
          element={
            <PrivateRoute>
              <MockReviewPage />
            </PrivateRoute>
          }
        />

        {/* -------- ADMIN -------- */}
        <Route
          path="/admin"
          element={
            <PrivateRoute adminOnly>
              <AdminDashboard />
            </PrivateRoute>
          }
        >
          {/* default page inside admin */}
          <Route index element={<Navigate to="documents" replace />} />

          {/* /admin/documents */}
          <Route path="documents" element={<ManageDocuments />} />

          {/* /admin/tests */}
          <Route path="tests" element={<ManageTests />} />

          {/* /admin/users */}
          <Route path="users" element={<ManageUsers />} />

          {/* /admin/mock/builder */}
          <Route path="mock/builder" element={<MockBuilder />} />

          {/* /admin/mock/quick */}
          <Route path="mock/quick" element={<QuickCreate />} />

          {/* /admin/results  (scoreboard of all submissions) */}
          <Route path="results" element={<AdminResults />} />

          {/* /admin/results/:submissionId  (drill-down of one submission) */}
          <Route
            path="results/:submissionId"
            element={<AdminResultDetail />}
          />
        </Route>

        {/* -------- 404 -------- */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  );
}

export default App;
