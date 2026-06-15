import React from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught error:", error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onRetry) {
      this.props.onRetry();
    } else {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-6">
          <div className="max-w-md w-full bg-card rounded-2xl border border-border p-6 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
              <AlertCircle className="w-8 h-8 text-destructive" />
            </div>
            <div>
              <h2 className="font-heading text-xl font-semibold mb-2">เกิดข้อผิดพลาด</h2>
              <p className="text-sm text-muted-foreground">
                ระบบไม่สามารถโหลดหน้าห้องเขียนได้ กรุณาลองใหม่อีกครั้ง
              </p>
              {this.state.error && (
                <details className="mt-4 text-left bg-muted/50 rounded-lg p-3 text-xs font-mono text-muted-foreground max-h-48 overflow-auto">
                  <summary className="cursor-pointer mb-2">รายละเอียดข้อผิดพลาด (คลิกเพื่อดู)</summary>
                  {this.state.error.toString()}
                </details>
              )}
            </div>
            <div className="flex gap-2 justify-center">
              <Button onClick={this.handleRetry} className="gap-2">
                <RefreshCw className="w-4 h-4" />
                ลองอีกครั้ง
              </Button>
              <Button
                variant="outline"
                onClick={() => window.history.back()}
              >
                กลับไปหน้าก่อนหน้า
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}