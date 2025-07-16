import { Link } from 'react-router-dom'
import { useTournaments } from '../contexts/TournamentContext'
import { useWallet } from '../contexts/WalletContext'
import { Trophy, Users, Play, Award } from 'lucide-react'

const Home = () => {
    const { tournaments, loading } = useTournaments()
    const { isConnected } = useWallet()

    const activeTournaments = tournaments.filter(t => t.status === 'active')
    const upcomingTournaments = tournaments.filter(t => t.status === 'created')

    return (
        <div className="space-y-8">
            {/* Hero Section */}
            <div className="text-center space-y-4">
                <h1 className="text-4xl font-bold text-gray-900">
                    Welcome to Tournament Hub
                </h1>
                <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                    Join competitive tournaments, compete with players worldwide, and win prizes on the MultiversX blockchain.
                </p>
                {!isConnected && (
                    <div className="mt-6">
                        <p className="text-sm text-gray-500 mb-2">
                            Connect your wallet to get started
                        </p>
                    </div>
                )}
            </div>



            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="card text-center">
                    <div className="flex items-center justify-center w-12 h-12 bg-primary-100 rounded-lg mx-auto mb-4">
                        <Trophy className="h-6 w-6 text-primary-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900">
                        {loading ? '...' : tournaments.length}
                    </h3>
                    <p className="text-gray-600">Total Tournaments</p>
                </div>

                <div className="card text-center">
                    <div className="flex items-center justify-center w-12 h-12 bg-green-100 rounded-lg mx-auto mb-4">
                        <Play className="h-6 w-6 text-green-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900">
                        {loading ? '...' : activeTournaments.length}
                    </h3>
                    <p className="text-gray-600">Active Tournaments</p>
                </div>

                <div className="card text-center">
                    <div className="flex items-center justify-center w-12 h-12 bg-yellow-100 rounded-lg mx-auto mb-4">
                        <Users className="h-6 w-6 text-yellow-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900">
                        {loading ? '...' : upcomingTournaments.length}
                    </h3>
                    <p className="text-gray-600">Upcoming Tournaments</p>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="card">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">
                        Join a Tournament
                    </h2>
                    <p className="text-gray-600 mb-4">
                        Browse available tournaments and join the competition. Show your skills and win prizes!
                    </p>
                    <Link to="/tournaments" className="btn-primary inline-flex items-center space-x-2">
                        <Trophy className="h-4 w-4" />
                        <span>View Tournaments</span>
                    </Link>
                </div>

                <div className="card">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">
                        Create Tournament
                    </h2>
                    <p className="text-gray-600 mb-4">
                        Are you an organizer? Create your own tournament and set up the rules and prizes.
                    </p>
                    <Link to="/admin" className="btn-primary inline-flex items-center space-x-2">
                        <Award className="h-4 w-4" />
                        <span>Create Tournament</span>
                    </Link>
                </div>
            </div>

            {/* Recent Tournaments */}
            {!loading && tournaments.length > 0 && (
                <div className="card">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">
                        Recent Tournaments
                    </h2>
                    <div className="space-y-3">
                        {tournaments.slice(0, 3).map((tournament) => (
                            <div
                                key={tournament.id}
                                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                            >
                                <div>
                                    <h3 className="font-medium text-gray-900">
                                        Tournament #{tournament.id}
                                    </h3>
                                    <p className="text-sm text-gray-600">
                                        Status: {tournament.status} • Players: {tournament.players.length}
                                    </p>
                                </div>
                                <Link
                                    to={`/tournaments/${tournament.id}`}
                                    className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                                >
                                    View Details →
                                </Link>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

export default Home 