import { Routes, Route } from 'react-router-dom'
import { WalletProvider } from './contexts/WalletContext'
import { NetworkProvider } from './contexts/NetworkContext'
import { TournamentProvider } from './contexts/TournamentContext'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import Tournaments from './pages/Tournaments'
import TournamentDetails from './pages/TournamentDetails'
import Admin from './pages/Admin'

function App() {
    return (
        <WalletProvider>
            <NetworkProvider>
                <TournamentProvider>
                    <div className="min-h-screen bg-gray-50">
                        <Navbar />
                        <main className="container mx-auto px-4 py-8">
                            <Routes>
                                <Route path="/" element={<Home />} />
                                <Route path="/tournaments" element={<Tournaments />} />
                                <Route path="/tournaments/:id" element={<TournamentDetails />} />
                                <Route path="/admin" element={<Admin />} />
                            </Routes>
                        </main>
                    </div>
                </TournamentProvider>
            </NetworkProvider>
        </WalletProvider>
    )
}

export default App 