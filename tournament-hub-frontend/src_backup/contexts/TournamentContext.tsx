import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { api } from '../services/api'
import { getBlockchainService } from '../services/blockchainService';
import { useWallet } from './WalletContext';

export interface Tournament {
    id: number
    game_id: number
    entry_fee: string
    prize_pool: string
    status: 'created' | 'active' | 'finished'
    join_deadline: number
    start_time: number
    end_time: number
    players: string[]
    final_podium?: string[]
}

interface TournamentContextType {
    tournaments: Tournament[]
    loading: boolean
    error: string | null
    fetchTournaments: () => Promise<void>
    createTournament: (data: any) => Promise<void>
    joinTournament: (tournamentId: number, playerAddress: string) => Promise<void>
    startTournament: (tournamentId: number) => Promise<void>
    submitResults: (tournamentId: number, podium: string[]) => Promise<void>
}

const TournamentContext = createContext<TournamentContextType | undefined>(undefined)

export const useTournaments = () => {
    const context = useContext(TournamentContext)
    if (context === undefined) {
        throw new Error('useTournaments must be used within a TournamentProvider')
    }
    return context
}

interface TournamentProviderProps {
    children: ReactNode
}

export const TournamentProvider: React.FC<TournamentProviderProps> = ({ children }) => {
    const [tournaments, setTournaments] = useState<Tournament[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const { address, isConnected } = useWallet();

    const fetchTournaments = async () => {
        setLoading(true)
        setError(null)
        try {
            const response = await api.get('/tournaments')
            setTournaments(response.data)
        } catch (err) {
            setError('Failed to fetch tournaments')
            console.error('Error fetching tournaments:', err)
        } finally {
            setLoading(false)
        }
    }

    const createTournament = async (data: any) => {
        setLoading(true)
        setError(null)
        try {
            if (!isConnected || !address) {
                alert('Please connect your wallet before creating a tournament.');
                setLoading(false);
                return;
            }
            const blockchainService = getBlockchainService('devnet');
            await blockchainService.createTournament(data, address);
            await fetchTournaments(); // Refresh the list
        } catch (err) {
            setError('Failed to create tournament');
            console.error('Error creating tournament:', err);
        } finally {
            setLoading(false);
        }
    }

    const joinTournament = async (tournamentId: number, playerAddress: string) => {
        setLoading(true)
        setError(null)
        try {
            await api.post(`/join_tournament/${tournamentId}`, {
                player_address: playerAddress
            })
            await fetchTournaments() // Refresh the list
        } catch (err) {
            setError('Failed to join tournament')
            console.error('Error joining tournament:', err)
        } finally {
            setLoading(false)
        }
    }

    const startTournament = async (tournamentId: number) => {
        setLoading(true)
        setError(null)
        try {
            await api.post(`/start_tournament/${tournamentId}`)
            await fetchTournaments() // Refresh the list
        } catch (err) {
            setError('Failed to start tournament')
            console.error('Error starting tournament:', err)
        } finally {
            setLoading(false)
        }
    }

    const submitResults = async (tournamentId: number, podium: string[]) => {
        setLoading(true)
        setError(null)
        try {
            await api.post('/submit_results', {
                tournament_id: tournamentId,
                podium
            })
            await fetchTournaments() // Refresh the list
        } catch (err) {
            setError('Failed to submit results')
            console.error('Error submitting results:', err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchTournaments()
    }, [])

    const value: TournamentContextType = {
        tournaments,
        loading,
        error,
        fetchTournaments,
        createTournament,
        joinTournament,
        startTournament,
        submitResults
    }

    return (
        <TournamentContext.Provider value={value}>
            {children}
        </TournamentContext.Provider>
    )
} 