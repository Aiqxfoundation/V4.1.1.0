import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield } from "lucide-react";

export default function AdminDashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  // Redirect to the admin users page
  useEffect(() => {
    if (user?.isAdmin) {
      setLocation('/admin/users');
    }
  }, [user, setLocation]);

  // Check admin access and show access denied if not admin
  if (!user?.isAdmin) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <Card className="w-full max-w-sm bg-zinc-900 border-red-500/50">
          <CardContent className="pt-6 text-center">
            <Shield className="w-12 h-12 text-red-500 mx-auto mb-3" />
            <h2 className="text-lg font-semibold text-white mb-2">Access Denied</h2>
            <p className="text-sm text-gray-400 mb-4">Admin privileges required</p>
            <Button 
              onClick={() => setLocation('/home')}
              className="w-full bg-[#f7931a] hover:bg-[#f7931a]/90"
            >
              Return to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show loading state while redirecting
  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center">
        <Shield className="w-12 h-12 text-[#f7931a] mx-auto mb-3 animate-pulse" />
        <p className="text-gray-400">Redirecting to admin dashboard...</p>
      </div>
    </div>
  );
}