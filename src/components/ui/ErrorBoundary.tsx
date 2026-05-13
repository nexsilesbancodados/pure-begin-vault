import { Component, ReactNode, ErrorInfo } from "react";
import { AlertTriangle, RotateCw, Home } from "lucide-react";
import { captureError } from "@/lib/monitoring";

interface State {
  hasError: boolean;
  error?: Error;
}
interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    captureError(error, { componentStack: info.componentStack });
  }

  reset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <div className="h-16 w-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <h1 className="text-xl font-black mb-1">Ops, algo deu errado</h1>
          <p className="text-sm text-muted-foreground mb-4">
            Tivemos um problema ao carregar esta tela. Já notificamos o time técnico.
          </p>
          {this.state.error && (
            <details className="text-left bg-muted/50 rounded-xl p-3 mb-4">
              <summary className="text-xs font-bold cursor-pointer">Detalhes técnicos</summary>
              <pre className="text-[10px] font-mono mt-2 overflow-auto max-h-32">
                {this.state.error.message}
                {"\n"}
                {this.state.error.stack}
              </pre>
            </details>
          )}
          <div className="flex gap-2 justify-center">
            <button
              onClick={this.reset}
              className="h-10 px-4 rounded-xl bg-primary text-primary-foreground font-bold flex items-center gap-2"
            >
              <RotateCw className="h-4 w-4" /> Tentar novamente
            </button>
            <a
              href="/painel"
              className="h-10 px-4 rounded-xl border border-border font-bold flex items-center gap-2"
            >
              <Home className="h-4 w-4" /> Início
            </a>
          </div>
        </div>
      </div>
    );
  }
}
