import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/* Last line of defense against white screens: if a page throws during
 * render (bad data, a broken lazy chunk, an unhandled component error),
 * show a recoverable fallback instead of a blank app. Keyed by nothing —
 * one boundary around <Routes> keeps the router alive so "Back to
 * Dashboard" is a plain client-side navigation. Reload covers the
 * "something is truly broken" case (e.g. a failed chunk fetch).
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled UI error:", error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas px-4">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto w-12 h-12 mb-4 flex items-center justify-center rounded-2xl bg-danger-soft">
            <span className="text-danger text-xl font-extrabold">!</span>
          </div>
          <h1 className="text-xl font-extrabold text-ink dark:text-white mb-2">
            Something went wrong
          </h1>
          <p className="text-sm text-muted mb-1">
            An unexpected error crashed this page.
          </p>
          <p className="text-xs text-faint font-mono break-all mb-6">{error.message}</p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => this.setState({ error: null })}
              className="h-11 px-5 rounded-xl text-sm font-bold text-white bg-accent hover:opacity-90 transition-opacity cursor-pointer"
            >
              Try again
            </button>
            <button
              onClick={() => {
                this.setState({ error: null });
                window.location.href = "/dashboard";
              }}
              className="h-11 px-5 rounded-xl text-sm font-bold text-ink dark:text-white bg-sunken dark:bg-surface border border-line hover:bg-line/50 transition-colors cursor-pointer"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }
}
