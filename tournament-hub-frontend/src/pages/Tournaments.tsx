import React, { useEffect, useState } from 'react';
import { TransactionsTable } from 'components/TransactionsTable/TransactionsTable';
import { getActiveTournamentIds, getTournamentDetailsFromContract } from 'helpers';

const statusLabels = [
    'Joining',
    'Playing',
    'ProcessingResults',
    'Completed'
];

function formatAmount(amount: bigint) {
    return (amount / 10n ** 18n).toString() + ' EGLD';
}

export const Tournaments = () => {
    const [tournaments, setTournaments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchTournaments = async () => {
            setLoading(true);
            setError(null);
            try {
                const ids = await getActiveTournamentIds();
                const details = await Promise.all(
                    ids.map(async (id: number) => {
                        try {
                            const parsed = await getTournamentDetailsFromContract(id);
                            if (!parsed) return null;
                            return {
                                id,
                                ...parsed
                            };
                        } catch (e) {
                            return null;
                        }
                    })
                );
                setTournaments(details.filter(Boolean));
            } catch (err) {
                setError('Failed to fetch tournaments');
                setTournaments([]);
            } finally {
                setLoading(false);
            }
        };
        fetchTournaments();
    }, []);

    return (
        <div className="container mx-auto py-8">
            <h2 className="text-2xl font-bold mb-6">Tournaments</h2>
            {loading && <div>Loading tournaments...</div>}
            {error && <div className="text-red-500">{error}</div>}
            {!loading && !error && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {tournaments.length === 0 && <div>No tournaments found.</div>}
                    {tournaments.map((tournament) => (
                        <div key={tournament.id} className="bg-white rounded shadow p-6 flex flex-col gap-2">
                            <h3 className="text-xl font-semibold">Tournament #{tournament.id}</h3>
                            <div className="text-gray-700">Game ID: {tournament.game_id}</div>
                            <div className="text-gray-700">Status: {statusLabels[tournament.status] ?? tournament.status}</div>
                            <div className="text-gray-700">Entry Fee: {formatAmount(tournament.entry_fee)}</div>
                            <div className="text-gray-700">Participants: {tournament.participants?.length ?? 0}</div>
                            <div className="text-gray-700">Creator: {tournament.creator}</div>
                        </div>
                    ))}
                </div>
            )}
            <div className="mt-12">
                <TransactionsTable />
            </div>
        </div>
    );
};

export default Tournaments; 