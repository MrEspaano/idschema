import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";

const NotFoundPage = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 route not found:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Sidan saknas</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight">404</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Vi kunde inte hitta sidan du forsokte besoka.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          Till startsidan
        </Link>
      </div>
    </div>
  );
};

export default NotFoundPage;
