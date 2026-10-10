import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error in React component tree:", error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = "/";
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-zinc-950 border border-zinc-800 rounded-xl p-6 shadow-2xl text-center space-y-5">
            <div className="w-14 h-14 bg-red-500/10 border border-red-500/30 rounded-full flex items-center justify-center mx-auto text-red-500">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <div>
              <h2 className="text-xl font-bold text-white mb-1.5">Application Recovered</h2>
              <p className="text-xs text-zinc-400">
                A temporary interface error occurred. Your account and mining operations remain safe on the blockchain.
              </p>
            </div>

            {this.state.error && (
              <div className="p-3 bg-black/60 border border-zinc-800/80 rounded-lg text-left overflow-auto max-h-32">
                <p className="text-[11px] font-mono text-zinc-400 break-words">
                  {this.state.error.message || "Unknown error"}
                </p>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button
                onClick={this.handleReload}
                className="flex-1 bg-[#f7931a] hover:bg-[#e5851a] text-black font-semibold text-xs py-2.5 flex items-center justify-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Reload Page
              </Button>
              <Button
                onClick={this.handleReset}
                variant="outline"
                className="flex-1 border-zinc-700 hover:bg-zinc-800 text-zinc-200 text-xs py-2.5 flex items-center justify-center gap-1.5"
              >
                <Home className="w-3.5 h-3.5" />
                Return Home
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
export default ErrorBoundary;
