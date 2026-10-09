import { Component, lazy, Suspense, type ReactNode } from "react";
import { useGame } from "./state/store";
import { Landing } from "./ui/Landing";
import { Creator } from "./ui/Creator";

const Play = lazy(() => import("./ui/Play"));

function webglAvailable() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

export function App() {
  const phase = useGame((s) => s.phase);
  if (!webglAvailable())
    return (
      <div className="fatal">
        <Logo />
        <h1>Your browser can't run Ozu yet</h1>
        <p>Ozu needs WebGL. Try the latest Chrome, Edge, Firefox or Safari, and make sure hardware acceleration is turned on.</p>
      </div>
    );
  return (
    <ErrorBoundary>
      {phase === "landing" && <Landing />}
      {phase === "create" && <Creator />}
      {phase === "playing" && (
        <Suspense fallback={<Loading text="Loading the district…" />}>
          <Play />
        </Suspense>
      )}
    </ErrorBoundary>
  );
}

export function Logo({ small = false }: { small?: boolean }) {
  return (
    <div className={`logo ${small ? "small" : ""}`} aria-label="Ozu">
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <circle cx="32" cy="32" r="21" fill="none" stroke="#ff7a1a" strokeWidth="8" />
        <circle cx="32" cy="32" r="6" fill="#f6c700" />
      </svg>
      <span>OZU</span>
    </div>
  );
}

export function Loading({ text }: { text: string }) {
  return (
    <div className="loading" role="status" aria-live="polite">
      <Logo />
      <div className="spinner" />
      <p>{text}</p>
    </div>
  );
}

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error) {
    console.error("Ozu crashed", error);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="fatal">
        <Logo />
        <h1>Something went wrong</h1>
        <p>Your progress is saved on the server. Reload to jump back in.</p>
        <button className="btn primary" onClick={() => location.reload()}>Reload Ozu</button>
      </div>
    );
  }
}
