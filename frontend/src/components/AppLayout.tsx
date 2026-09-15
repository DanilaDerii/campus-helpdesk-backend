import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === "ADMIN";

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return <div className="app-shell">
    <header className="topbar">
      <Link className="brand" to="/">Campus <strong>Helpdesk</strong></Link>
      <nav>
        <NavLink to="/">Tickets</NavLink>
        {isAdmin && <NavLink to="/users">Users</NavLink>}
      </nav>
      <div className="account"><span>{user?.displayName}<small>{user?.role}</small></span><button className="button button-quiet" onClick={() => void handleLogout()}>Sign out</button></div>
    </header>
    <main className="content"><Outlet /></main>
  </div>;
}
