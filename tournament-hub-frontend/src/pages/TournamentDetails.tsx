import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useTournaments } from '../contexts/TournamentContext'
import { useWallet } from '../contexts/WalletContext'
import { Trophy, Users, Calendar, Award, Play, Clock, ArrowLeft } from 'lucide-react'

const TournamentDetails = () => {
    const { id } = useParams<{ id: string }>()
    const { tournaments, loading, error, joinTournament, startTournament, submitResults } = useTournaments()
    const { isConnected, address } = useWallet()
    const [tournament, setTournament] = useState<any>(null)
    const [showResultForm, setShowResultForm] = useState(false)
    const [podium, setPodium] = useState(['', '', ''])

    useEffect(() => {
        if (id && tournaments.length > 0) {
            const found = tournaments.find(t => t.id === parseInt(id))
            setTournament(found || null)
        }
    }, [id, tournaments])

    const handleJoin = async () => {
        if (!isConnected || !tournament) return
        await joinTournament(tournament.id, address!)
    }

    const handleStart = async () => {
        if (!isConnected || !tournament) return
        await startTournament(tournament.id)
    }

    const handleSubmitResults = async () => {
        if (!tournament) return
        const validPodium = podium.filter(addr => addr.trim() !== '')
        if (validPodium.length === 0) return

        await submitResults(tournament.id, validPodium)
        setShowResultForm(false)
        setPodium(['', '', ''])
    }

    const canJoin = tournament && isConnected &&
        tournament.status === 'created' &&
        !tournament.players.includes(address)

    const canStart = tournament && isConnected && tournament.status === 'created'

    const canSubmitResults = tournament && tournament.status === 'active'

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading tournament...</p>
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="text-center">
                <p className="text-red-600">{error}</p>
                <Link to="/tournaments" className="btn-primary mt-4">
                    Back to Tournaments
                </Link>
            </div>
        )
    }

    if (!tournament) {
        return (
            <div className="text-center">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Tournament Not Found</h2>
                <p className="text-gray-600 mb-6">The tournament you're looking for doesn't exist.</p>
                <Link to="/tournaments" className="btn-primary">
                    Back to Tournaments
                </Link>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center space-x-4">
                <Link to="/tournaments" className="text-gray-600 hover:text-gray-900">
                    <ArrowLeft className="h-6 w-6" />
                </Link>
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">
                        Tournament #{tournament.id}
                    </h1>
                    <p className="text-gray-600">Game ID: {tournament.game_id}</p>
                </div>
            </div>

            {/* Status Badge */}
            <div className="flex items-center space-x-2">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${tournament.status === 'created' ? 'bg-yellow-100 text-yellow-800' :
                    tournament.status === 'active' ? 'bg-green-100 text-green-800' :
                        'bg-gray-100 text-gray-800'
                    }`}>
                    {tournament.status === 'created' ? <Clock className="h-4 w-4 mr-1" /> :
                        tournament.status === 'active' ? <Play className="h-4 w-4 mr-1" /> :
                            <Award className="h-4 w-4 mr-1" />}
                    {tournament.status.charAt(0).toUpperCase() + tournament.status.slice(1)}
                </span>
            </div>

            {/* Tournament Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="card">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">Tournament Details</h2>
                    <div className="space-y-3">
                        <div className="flex items-center text-sm">
                            <Award className="h-4 w-4 mr-2 text-gray-500" />
                            <span className="text-gray-600">Entry Fee:</span>
                            <span className="ml-auto font-medium">{tournament.entry_fee} EGLD</span>
                        </div>
                        <div className="flex items-center text-sm">
                            <Trophy className="h-4 w-4 mr-2 text-gray-500" />
                            <span className="text-gray-600">Prize Pool:</span>
                            <span className="ml-auto font-medium">{tournament.prize_pool} EGLD</span>
                        </div>
                        <div className="flex items-center text-sm">
                            <Calendar className="h-4 w-4 mr-2 text-gray-500" />
                            <span className="text-gray-600">Join Deadline:</span>
                            <span className="ml-auto font-medium">
                                {new Date(tournament.join_deadline * 1000).toLocaleDateString()}
                            </span>
                        </div>
                        {tournament.start_time && (
                            <div className="flex items-center text-sm">
                                <Play className="h-4 w-4 mr-2 text-gray-500" />
                                <span className="text-gray-600">Start Time:</span>
                                <span className="ml-auto font-medium">
                                    {new Date(tournament.start_time * 1000).toLocaleDateString()}
                                </span>
                            </div>
                        )}
                        {tournament.end_time && (
                            <div className="flex items-center text-sm">
                                <Award className="h-4 w-4 mr-2 text-gray-500" />
                                <span className="text-gray-600">End Time:</span>
                                <span className="ml-auto font-medium">
                                    {new Date(tournament.end_time * 1000).toLocaleDateString()}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="card">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">Players</h2>
                    <div className="space-y-2">
                        <div className="flex items-center text-sm">
                            <Users className="h-4 w-4 mr-2 text-gray-500" />
                            <span className="text-gray-600">Total Players:</span>
                            <span className="ml-auto font-medium">{tournament.players.length}</span>
                        </div>
                        {tournament.players.length > 0 && (
                            <div className="mt-4">
                                <h3 className="text-sm font-medium text-gray-900 mb-2">Registered Players:</h3>
                                <div className="space-y-1">
                                    {tournament.players.map((player: string, index: number) => (
                                        <div key={player} className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                                            {index + 1}. {player}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Final Podium */}
            {tournament.final_podium && tournament.final_podium.length > 0 && (
                <div className="card">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">Final Results</h2>
                    <div className="space-y-2">
                        {tournament.final_podium.map((player: string, index: number) => (
                            <div key={player} className="flex items-center text-sm">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold mr-3 ${index === 0 ? 'bg-yellow-500' :
                                    index === 1 ? 'bg-gray-400' :
                                        'bg-orange-600'
                                    }`}>
                                    {index + 1}
                                </div>
                                <span className="text-gray-900">{player}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Actions */}
            <div className="flex space-x-4">
                {canJoin && (
                    <button onClick={handleJoin} className="btn-primary">
                        Join Tournament
                    </button>
                )}

                {canStart && (
                    <button onClick={handleStart} className="btn-primary">
                        Start Tournament
                    </button>
                )}

                {canSubmitResults && (
                    <button
                        onClick={() => setShowResultForm(!showResultForm)}
                        className="btn-primary"
                    >
                        {showResultForm ? 'Cancel' : 'Submit Results'}
                    </button>
                )}
            </div>

            {/* Result Submission Form */}
            {showResultForm && (
                <div className="card">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Submit Tournament Results</h3>
                    <div className="space-y-4">
                        <p className="text-sm text-gray-600">
                            Enter the podium addresses (1st, 2nd, 3rd place):
                        </p>
                        {[0, 1, 2].map((index) => (
                            <div key={index}>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    {index + 1}{index === 0 ? 'st' : index === 1 ? 'nd' : 'rd'} Place:
                                </label>
                                <input
                                    type="text"
                                    value={podium[index]}
                                    onChange={(e) => {
                                        const newPodium = [...podium]
                                        newPodium[index] = e.target.value
                                        setPodium(newPodium)
                                    }}
                                    placeholder="Enter player address"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                                />
                            </div>
                        ))}
                        <button
                            onClick={handleSubmitResults}
                            className="btn-primary"
                            disabled={podium.every(addr => addr.trim() === '')}
                        >
                            Submit Results
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}

export default TournamentDetails 