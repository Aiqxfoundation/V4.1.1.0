import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { Redirect, Route } from "wouter";
import AdminLayout from "@/components/AdminLayout";

export function AdminProtectedRoute({
  path,
  component: Component,
}: {
  path: string;
  component: () => React.JSX.Element;
}) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <Route path={path}>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-border" />
        </div>
      </Route>
    );
  }

  if (!user) {
    return (
      <Route path={path}>
        <Redirect to="/auth" />
      </Route>
    );
  }

  if (!user.isAdmin) {
    return (
      <Route path={path}>
        <Redirect to="/home" />
      </Route>
    );
  }

  return (
    <Route path={path}>
      <AdminLayout>
        <Component />
      </AdminLayout>
    </Route>
  );
}