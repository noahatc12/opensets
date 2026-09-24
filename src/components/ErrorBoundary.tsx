import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from './Button';
import { downloadEnvelope } from '../db/exportImport';

interface Props {
  children: ReactNode;
}
interface State {
  failed: boolean;
}

/**
 * Route-level error boundary (audit 2026-09-24: there was none, so one bad row or a
 * corrupt import blanked the whole app). A crash in one screen now shows a recovery
 * screen with a way to save the data and a way out. AppShell keys it by route, so
 * navigating away resets it.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Local only: OpenSets sends no telemetry. The console is the whole report.
    console.error('OpenSets screen error', error, info.componentStack);
  }

  override render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div
        role="alert"
        className="flex flex-col items-center px-4 py-14 text-center"
      >
        <h2 className="text-lg font-semibold text-text">
          Something went wrong on this screen
        </h2>
        <p className="mt-2 max-w-[34ch] text-[14px] leading-relaxed text-muted">
          Your data is still on this device. Export a copy to be safe, then head
          back to Today.
        </p>
        <div className="mt-6 flex w-full max-w-xs flex-col gap-2.5">
          <Button
            block
            onClick={() => void downloadEnvelope(new Date().toISOString())}
          >
            Export my data
          </Button>
          <Button
            block
            variant="secondary"
            onClick={() => {
              window.location.hash = '#/today';
              this.setState({ failed: false });
            }}
          >
            Go to Today
          </Button>
        </div>
      </div>
    );
  }
}
