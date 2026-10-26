import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  area: string;
  onHome: () => void;
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/** Keeps one app's crash from blanking the whole suite. Saved work is untouched. */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`${this.props.area} crashed`, error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="pl-crash" role="alert">
        <h1 className="pl-crash-title">{this.props.area} stopped working</h1>
        <p className="pl-crash-text">
          Everything already saved is safe on this computer. Reopening usually fixes it.
        </p>
        <p className="pl-crash-detail">{this.state.error.message}</p>
        <div className="pl-crash-actions">
          <button type="button" className="pl-btn pl-btn--primary" onClick={() => this.setState({ error: null })}>
            Reopen {this.props.area}
          </button>
          <button
            type="button"
            className="pl-btn pl-btn--outline"
            onClick={() => {
              this.setState({ error: null });
              this.props.onHome();
            }}
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }
}
