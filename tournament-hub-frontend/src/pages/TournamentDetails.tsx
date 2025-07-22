import React from 'react';
import { useParams } from 'react-router-dom';
import { useJoinTournamentTransaction } from '../hooks/transactions/useJoinTournamentTransaction';
import { useState } from 'react';
import { useGetIsLoggedIn, useGetAccountInfo } from 'lib';

const mockTournament = {
    id: 1,
    name: 'Summer Showdown',
    status: 'Active',
    players: ['Alice', 'Bob', 'Charlie', 'Dave'],
    description: 'A summer tournament for all skill levels.',
};

export const TournamentDetails = () => {
    const { id } = useParams();
    // In a real app, fetch tournament by id
    const tournament = mockTournament;
    const { joinTournament } = useJoinTournamentTransaction();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const isLoggedIn = useGetIsLoggedIn();
    const { address } = useGetAccountInfo();
    const alreadyJoined = isLoggedIn && address && tournament.players.includes(address);

    const handleJoin = async () => {
        setLoading(true);
        setError(null);
        setSuccess(null);
        try {
            await joinTournament(tournament.id);
            setSuccess('Successfully joined the tournament!');
        } catch (err) {
            setError('Failed to join tournament.');
        } finally {
            setLoading(false);
        }
    };

    const joinButtonDisabled = loading || !isLoggedIn || alreadyJoined;
    let joinButtonText = 'Join Tournament';
    if (!isLoggedIn) joinButtonText = 'Connect wallet to join';
    else if (alreadyJoined) joinButtonText = 'Already joined';
    else if (loading) joinButtonText = 'Joining...';

    return (
        <div className="container mx-auto py-8">
            <h2 className="text-2xl font-bold mb-4">{tournament.name}</h2>
            <div className="mb-2 text-gray-500">Status: {tournament.status}</div>
            <div className="mb-2">{tournament.description}</div>
            <div className="mb-4">Players: {tournament.players.length}</div>
            <ul className="list-disc ml-6 mb-6">
                {tournament.players.map((player) => (
                    <li key={player}>{player}</li>
                ))}
            </ul>
            <button
                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
                onClick={handleJoin}
                disabled={joinButtonDisabled}
                title={!isLoggedIn ? 'Please connect your wallet to join.' : alreadyJoined ? 'You have already joined this tournament.' : ''}
            >
                {joinButtonText}
            </button>
            {error && <div className="text-red-500 mt-2">{error}</div>}
            {success && <div className="text-green-600 mt-2">{success}</div>}
        </div>
    );
};

export default TournamentDetails; 