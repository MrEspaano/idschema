import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode, useState } from "react";
import { Toaster } from "sonner";
import { AuthProvider } from "@/features/auth/AuthProvider";

interface AppProvidersProps {
  children: ReactNode;
}

export const AppProviders = ({ children }: AppProvidersProps) => {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {children}
        <Toaster
          closeButton
          richColors
          position="top-right"
          toastOptions={{
            classNames: {
              toast: "border border-border bg-card text-card-foreground shadow-lg",
              description: "text-muted-foreground",
            },
          }}
        />
      </AuthProvider>
    </QueryClientProvider>
  );
};
