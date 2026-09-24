import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface Props {
  children?: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ClinicX Error Boundary Caught]", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <Card className="p-6 border-destructive/30 bg-destructive/5 my-4 space-y-4 max-w-lg mx-auto text-center">
          <div className="size-12 rounded-full bg-destructive/10 text-destructive grid place-items-center mx-auto">
            <AlertTriangle className="size-6" />
          </div>
          <div>
            <h3 className="font-bold text-base text-foreground">
              {this.props.fallbackTitle || "Something went wrong"}
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              {this.state.error?.message ||
                "An unexpected error occurred while rendering this section."}
            </p>
          </div>
          <Button onClick={this.handleReset} size="sm" variant="outline" className="gap-2">
            <RefreshCw className="size-3.5" /> Try Again
          </Button>
        </Card>
      );
    }

    return this.props.children;
  }
}
