import { Navigate } from "react-router-dom";
import { apiUrl } from "../api";
import { useAuth } from "../auth";

export function LoginPage() {
  const { status } = useAuth();
  if (status === "authenticated") return <Navigate to="/" replace />;

  return <main className="login-page">
    <section className="login-card">
      <div className="brand-mark">CH</div>
      <p className="eyebrow">University services</p>
      <h1>Campus Helpdesk</h1>
      <p className="muted">Report campus issues, follow their progress, and keep your support requests in one place.</p>
      <button className="button button-primary microsoft-button" onClick={() => window.location.assign(apiUrl("/api/v1/auth/login"))}>Sign in with Microsoft</button>
    </section>
  </main>;
}
