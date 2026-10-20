import { Component, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

/** Если один из экранов упал — показываем ошибку, а не пустую страницу. */
export class Boundary extends Component<{ children: ReactNode; resetKey?: string }, { error: Error | null; key?: string }> {
  state: { error: Error | null; key?: string } = { error: null, key: this.props.resetKey };
  static getDerivedStateFromError(error: Error) { return { error }; }
  static getDerivedStateFromProps(p: { resetKey?: string }, s: { error: Error | null; key?: string }) {
    return p.resetKey !== s.key ? { error: null, key: p.resetKey } : null;
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="m-5 rounded-xl border border-danger/40 bg-danger/10 p-5 text-sm">
        <div className="flex items-center gap-2 font-semibold text-danger"><AlertTriangle size={18} /> Ошибка отображения страницы</div>
        <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-xs text-muted">{this.state.error.message}</pre>
        <button className="btn btn-soft btn-sm mt-3" onClick={() => this.setState({ error: null })}>Повторить</button>
      </div>
    );
  }
}
