import { Navigate, useParams } from "react-router-dom";

export default function RedirectToRun() {
    const { id } = useParams();
    // Default to Reading when user hits /mock/:id without /run
    return <Navigate to={`/mock/${id}/run?section=Reading`} replace />;
}
