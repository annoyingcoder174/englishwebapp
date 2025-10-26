import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

// Public pages
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";

// Student pages
import Study from "./pages/student/Study.jsx";
import MockTestRunner from "./pages/student/MockTestRunner.jsx";
import MockReviewPage from "./pages/student/MockReviewPage.jsx";

// Admin pages
import AdminDashboard from "./pages/admin/AdminDashboard.jsx";
import ManageDocuments from "./pages/admin/ManageDocuments.jsx";
import ManageUsers from "./pages/admin/ManageUsers.jsx";
import QuickCreate from "./pages/admin/QuickCreate.jsx";
import MockBuilder from "./pages/admin/MockBuilder.jsx"; // ✅ ADD THIS

// Shared
import PrivateRoute from "./components/PrivateRoute.jsx";
import NotFound from "./pages/NotFound.jsx";

function App() {
  return (
    <Router>
      <Routes>
        {/* 🌐 Public */}
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* 🎓 Student */}
        <Route
          path="/study"
          element={
            <PrivateRoute>
              <Study />
            </PrivateRoute>
          }
        />
        <Route
          path="/mock/:id/run"
          element={
            <PrivateRoute>
              <MockTestRunner />
            </PrivateRoute>
          }
        />
        <Route
          path="/mock/:id/review"
          element={
            <PrivateRoute>
              <MockReviewPage />
            </PrivateRoute>
          }
        />

        {/* 🛠️ Admin */}
        <Route
          path="/admin"
          element={
            <PrivateRoute adminOnly>
              <AdminDashboard />
            </PrivateRoute>
          }
        >
          {/* Redirect /admin → /admin/documents */}
          <Route index element={<Navigate to="documents" replace />} />

          {/* Sub routes */}
          <Route path="documents" element={<ManageDocuments />} />
          <Route path="users" element={<ManageUsers />} />
          <Route path="mock/quick" element={<QuickCreate />} />
          <Route path="mock/builder" element={<MockBuilder />} /> {/* ✅ FIXED */}
        </Route>

        {/* 🚫 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  );
}

export default App;
