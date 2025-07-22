import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTournaments } from '../contexts/TournamentContext'
import { useWallet } from '../contexts/WalletContext'
import { Trophy, Users, Calendar, Award, Play, Clock } from 'lucide-react'

const Tournaments = () => {
    const { tournaments, loading, error, joinTournament, startTournament } = useTournaments()
    const { isConnected, address } = useWallet()
    const [filter, setFilter] = useState<'all' | 'created' | 'active' | 'finished'>('all')

    const filteredTournaments = tournaments.filter(tournament => {
        if (filter === 'all') return true
        return tournament.status === filter
    })

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'created': return 'bg-yellow-100 text-yellow-800'
            case 'active': return 'bg-green-100 text-green-800'
            case 'finished': return 'bg-gray-100 text-gray-800'
            default: return 'bg-gray-100 text-gray-800'
        }
    }

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'created': return <Clock className="h-4 w-4" />
            case 'active': return <Play className="h-4 w-4" />
            case 'finished': return <Award className="h-4 w-4" />
            default: return <Clock className="h-4 w-4" />
        }
    }

    const canJoin = (tournament: any) => {
        return isConnected &&
            tournament.status === 'created' &&
            !tournament.players.includes(address)
    }

    const canStart = (tournament: any) => {
        return isConnected && tournament.status === 'created'
    }

    const handleJoin = async (tournamentId: number) => {
        if (!isConnected || !address) return
        await joinTournament(tournamentId, address)
    }

    const handleStart = async (tournamentId: number) => {
        if (!isConnected) return
        await startTournament(tournamentId)
    }

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading tournaments...</p>
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="text-center">
                <p className="text-red-600">{error}</p>
                <button
                    onClick={() => window.location.reload()}
                    className="btn-primary mt-4"
                >
                    Retry
                </button>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-gray-900">Tournaments</h1>
                <Link to="/admin" className="btn-primary">
                    Create Tournament
                </Link>
            </div>

            {/* Filters */}
            <div className="flex space-x-2">
                {(['all', 'created', 'active', 'finished'] as const).map((status) => (
                    <button
                        key={status}
                        onClick={() => setFilter(status)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === status
                            ? 'bg-primary-600 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            }`}
                    >
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                    </button>
                ))}
            </div>

            {/* Tournaments Grid */}
            {filteredTournaments.length === 0 ? (
                <div className="text-center py-12">
                    <Trophy className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                        No tournaments found
                    </h3>
                    <p className="text-gray-600">
                        {filter === 'all'
                            ? 'No tournaments have been created yet.'
                            : `No ${filter} tournaments found.`
                        }
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredTournaments.map((tournament) => (
                        <div key={tournament.id} className="card">
                            {/* Header */}
                            <div className="flex justify-between items-start mb-4">
                                <h3 className="text-lg font-semibold text-gray-900">
                                    Tournament #{tournament.id}
                                </h3>
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(tournament.status)}`}>
                                    {getStatusIcon(tournament.status)}
                                    <span className="ml-1">{tournament.status}</span>
                                </span>
                            </div>

                            {/* Details */}
                            <div className="space-y-3 mb-4">
                                <div className="flex items-center text-sm text-gray-600">
                                    <Users className="h-4 w-4 mr-2" />
                                    <span>{tournament.players.length} players</span>
                                </div>

                                <div className="flex items-center text-sm text-gray-600">
                                    <Award className="h-4 w-4 mr-2" />
                                    <span>Prize Pool: {tournament.prize_pool} EGLD</span>
                                </div>

                                <div className="flex items-center text-sm text-gray-600">
                                    <Calendar className="h-4 w-4 mr-2" />
                                    <span>Join Deadline: {new Date(tournament.join_deadline * 1000).toLocaleDateString()}</span>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex space-x-2">
                                <Link
                                    to={`/tournaments/${tournament.id}`}
                                    className="btn-secondary flex-1 text-center"
                                >
                                    View Details
                                </Link>

                                {canJoin(tournament) && (
                                    <button
                                        onClick={() => handleJoin(tournament.id)}
                                        className="btn-primary flex-1"
                                    >
                                        Join
                                    </button>
                                )}

                                {canStart(tournament) && (
                                    <button
                                        onClick={() => handleStart(tournament.id)}
                                        className="btn-primary flex-1"
                                    >
                                        Start
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

export default Tournaments 