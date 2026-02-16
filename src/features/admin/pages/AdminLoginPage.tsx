import { useEffect, useState } from "react";
import { AlertCircle, LogIn } from "lucide-react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/shared/layout/AppLayout";
import { useAuth } from "@/features/auth/useAuth";

const LOGIN_TIMEOUT_MS = 10000;

const AdminLoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { signIn, user, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (isAdmin) {
      navigate("/admin");
      return;
    }

    if (isSubmitting && user && !isAdmin) {
      setError("Kontot är inloggat men saknar adminbehörighet.");
      setIsSubmitting(false);
    }
  }, [authLoading, isAdmin, isSubmitting, navigate, user]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    const timeoutPromise = new Promise<{ error: Error }>((resolve) => {
      setTimeout(() => {
        resolve({ error: new Error("timeout") });
      }, LOGIN_TIMEOUT_MS);
    });

    try {
      const { error: signInError } = await Promise.race([signIn(email, password), timeoutPromise]);

      if (signInError) {
        if (signInError.message === "timeout") {
          setError("Inloggningen tog för lång tid. Kontrollera nätverket och försök igen.");
        } else {
          setError("Fel e-post eller lösenord.");
        }
        setIsSubmitting(false);
      }
    } catch {
      setError("Kunde inte logga in just nu. Försök igen.");
      setIsSubmitting(false);
    }
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-sm space-y-6 pt-8">
        <header className="space-y-2 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary">
            <LogIn className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Admin</h1>
          <p className="text-sm text-muted-foreground">Logga in för att redigera schema och planering.</p>
        </header>

        {error && (
          <div className="flex items-center gap-2 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block space-y-2 text-sm font-medium">
            <span>E-post</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-xl border bg-card px-4 py-3 text-card-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              required
            />
          </label>

          <label className="block space-y-2 text-sm font-medium">
            <span>Lösenord</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-xl border bg-card px-4 py-3 text-card-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              required
            />
          </label>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? "Loggar in..." : "Logga in"}
          </button>
        </form>
      </div>
    </AppLayout>
  );
};

export default AdminLoginPage;
