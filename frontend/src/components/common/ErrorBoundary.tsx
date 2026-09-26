import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught React Error:', error, errorInfo)
  }

  public handleReload = () => {
    window.location.reload()
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-app-void text-zinc-100 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-surface-card border border-border-default rounded-2xl p-6 shadow-2xl flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-full bg-danger/10 text-danger flex items-center justify-center mb-4 border border-danger/30">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold font-display uppercase tracking-wider text-white mb-2">
              Đã Xảy Ra Sự Cố
            </h2>
            <p className="text-xs text-zinc-400 font-sans mb-4">
              {this.state.error?.message || 'Một lỗi giao diện không mong muốn đã xảy ra khi tải trang.'}
            </p>
            <div className="flex gap-3 w-full">
              <Button
                variant="neon"
                size="md"
                onClick={this.handleReload}
                className="w-full flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" /> Tải Lại Trang
              </Button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
