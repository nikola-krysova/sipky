import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { toast } from "sonner";
import { Button } from "../../components/ui/Button";

export default function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast.error("Nesprávné přihlašovací údaje");
    } else {
      navigate("/admin");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-8 w-full max-w-sm">
        <h1 className="font-display text-2xl font-semibold mb-1 text-center">
          Admin
        </h1>
        <p className="text-sm text-gray-500 text-center mb-6">Restaurace U Školy</p>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1 uppercase tracking-wider">
              E-mail
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-black"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1 uppercase tracking-wider">
              Heslo
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-black"
              required
            />
          </div>
          <Button type="submit" loading={loading} className="w-full mt-2">
            Přihlásit se
          </Button>
        </form>
      </div>
    </div>
  );
}
