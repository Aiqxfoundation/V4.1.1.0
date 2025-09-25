import { createContext, ReactNode, useContext } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { User as SelectUser } from "@shared/schema";
import { getQueryFn, apiRequest, queryClient } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

type AuthContextType = {
  user: SelectUser | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<SelectUser, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<SelectUser & { accessKey: string }, Error, RegisterData>;
};

type LoginData = {
  username: string;
  accessKey: string;
};

type RegisterData = {
  username: string;
  referredBy?: string;
  deviceData?: any;
  kycData?: { deviceFingerprint: string; verificationHash: string };
};

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  
  const {
    data: user,
    error,
    isLoading,
  } = useQuery<SelectUser | undefined, Error>({
    queryKey: ["/api/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    staleTime: 5000, // Reduced for more frequent updates
    refetchOnWindowFocus: true,
    refetchInterval: 10000, // Periodic updates every 10 seconds
    gcTime: 300000 // Cache user for better performance
  });

  const loginMutation = useMutation({
    mutationFn: async ({ username, accessKey }: LoginData) => {
      const res = await apiRequest("POST", "/api/login", {
        username,
        accessKey
      });
      
      if (!res.ok) {
        const error = await res.json();
        // Check for permanent ban status
        if (res.status === 403 && error.error === "PERMANENTLY_BANNED") {
          const banError = new Error(error.message || "Your account has been permanently banned");
          (banError as any).isPermanentlyBanned = true;
          throw banError;
        }
        throw new Error(error.message || 'Login failed');
      }
      
      return await res.json();
    },
    onSuccess: (user: SelectUser) => {
      queryClient.setQueryData(["/api/user"], user);
      // Redirect based on user role
      if (user.isAdmin) {
        setLocation("/admin/users");
      } else {
        setLocation("/mining");
      }
      toast({
        title: "Login successful",
        description: `Welcome back, ${user.username}!`,
      });
    },
    onError: (error: Error) => {
      // Don't show toast for permanent ban - the auth page will handle it with a dialog
      if ((error as any).isPermanentlyBanned) {
        return;
      }
      
      // Professional Bitcoin-themed error toast
      toast({
        title: "🔐 Authentication Failed",
        description: "Invalid username or access key. Please verify your credentials and ensure your access key follows the format: B2B-XXXXX-XXXXX-XXXXX-XXXXX",
        variant: "destructive",
        className: "border-[#f7931a] bg-gray-900 text-white",
        style: {
          border: "2px solid #f7931a",
          background: "linear-gradient(135deg, #1a1a1a 0%, #2d1810 100%)",
          boxShadow: "0 0 20px rgba(247, 147, 26, 0.3)",
        }
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (credentials: RegisterData) => {
      const res = await apiRequest("POST", "/api/register", credentials);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Registration failed');
      }
      return await res.json();
    },
    onSuccess: (userWithKey: SelectUser & { accessKey: string }) => {
      // Don't auto-login user - they need to see access key first, then manually login
      toast({
        title: "Account created successfully",
        description: `Your access key has been generated. Please copy it safely!`,
      });
    },
    onError: (error: Error) => {
      // Professional error handling with user-friendly messages
      let title = "Account Creation Failed";
      let professionalMessage = error.message || "We couldn't create your account. Please try again.";
      
      // Handle specific error cases based on the error message content
      if (error.message.includes("Invalid Referral Code:")) {
        title = "⚠️ Invalid Referral Code";
        // Extract just the message part after the colon for cleaner display
        professionalMessage = error.message.split("Invalid Referral Code:")[1]?.trim() || error.message;
      } else if (error.message.includes("Referral Code Already Used:")) {
        title = "🔒 Referral Code Already Used";
        // Extract just the message part after the colon for cleaner display
        professionalMessage = error.message.split("Referral Code Already Used:")[1]?.trim() || error.message;
      } else if (error.message.includes("Referral Code Required:")) {
        title = "📋 Referral Code Required";
        professionalMessage = error.message.split("Referral Code Required:")[1]?.trim() || error.message;
      } else if (error.message.includes("already taken") || error.message.includes("already exists")) {
        title = "🔒 Username Unavailable";
        professionalMessage = "This username is already taken. Please choose a different username.";
      } else if (error.message.includes("username") && error.message.includes("required")) {
        title = "📝 Username Required";
        professionalMessage = "Please enter a username to create your account.";
      } else if (error.message.includes("updating") || error.message.includes("reactivating")) {
        title = "🔄 System Maintenance";
        professionalMessage = "Our system is currently updating. Please try again in a few moments.";
      } else if (error.message.includes("technical error")) {
        title = "⚙️ Technical Issue";
        professionalMessage = "A technical issue occurred. Please try again with a different username.";
      } else if (error.message.includes("device") || error.message.includes("restricted")) {
        title = "🛡️ Security Notice";
        professionalMessage = error.message; // Pass through device-related messages
      }
        
      toast({
        title: title,
        description: professionalMessage,
        variant: "destructive",
        className: "border-[#f7931a] bg-gray-900 text-white",
        style: {
          border: "2px solid #f7931a",
          background: "linear-gradient(135deg, #1a1a1a 0%, #2d1810 100%)",
          boxShadow: "0 0 20px rgba(247, 147, 26, 0.3)",
        }
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/logout");
      if (!res.ok) {
        throw new Error('Logout failed');
      }
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/user"], null);
      setLocation("/");
      toast({
        title: "Logged out",
        description: "You have been successfully logged out.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Logout failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        error,
        loginMutation,
        logoutMutation,
        registerMutation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

// Utility function to validate access key format
export function isValidAccessKey(accessKey: string): boolean {
  try {
    // B2B-XXXXX-XXXXX-XXXXX-XXXXX format
    return /^B2B-[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}$/.test(accessKey);
  } catch {
    return false;
  }
}

// Utility function to format access key for display
export function formatAccessKey(accessKey: string): string {
  if (accessKey && accessKey.length === 27 && accessKey.startsWith('B2B-')) {
    return accessKey;
  }
  return accessKey;
}