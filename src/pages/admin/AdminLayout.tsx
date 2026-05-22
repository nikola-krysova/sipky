import { useEffect, useState } from "react";
import { NavLink, useNavigate, Outlet } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { Skeleton } from "../../components/ui/Skeleton";

export default function AdminLayout() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) navigate("/admin/login", { replace: true });
      setChecking(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) navigate("/admin/login", { replace: true });
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/admin/login");
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Skeleton className="h-8 w-32" />
      </div>
    );
  }

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `px-4 py-2 text-sm font-medium uppercase tracking-wider transition-colors ${
      isActive ? "text-black border-b-2 border-black" : "text-gray-500 hover:text-black"
    }`;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <span className="font-display font-semibold">Admin</span>
            <nav className="flex">
              <NavLink to="/admin" end className={linkClass}>Dashboard</NavLink>
              <NavLink to="/admin/rezervace" className={linkClass}>Rezervace</NavLink>
              <NavLink to="/admin/blokace" className={linkClass}>Blokace</NavLink>
              <NavLink to="/admin/nastaveni" className={linkClass}>Nastavení</NavLink>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <a href="/" className="text-xs text-gray-400 hover:text-black">
              ← Web
            </a>
            <button
              onClick={handleLogout}
              className="text-xs text-gray-500 hover:text-black uppercase tracking-wider"
            >
              Odhlásit
            </button>
          </div>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
