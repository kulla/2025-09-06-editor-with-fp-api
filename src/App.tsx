import './App.css'
import { DebugPanel } from './components/debug-panel'

export default function App() {
  return (
    <main className="prose p-10">
      <h1>Rsbuild with React</h1>
      <p>Start building amazing things with Rsbuild.</p>
      <DebugPanel
        labels={{ example: 'Example' }}
        getCurrentValue={{ example: () => 'Hello, world!' }}
        showOnStartup={{ example: true }}
      />
    </main>
  )
}
