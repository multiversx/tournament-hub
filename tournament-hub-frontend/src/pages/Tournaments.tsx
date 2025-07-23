import React, { useEffect, useState } from 'react';
import {
    Box,
    Heading,
    Text,
    Badge,
    Button,
    Spinner,
    VStack,
    HStack,
    SimpleGrid,
    Skeleton,
    useBreakpointValue,
    useToast,
} from '@chakra-ui/react';
import { Users, Award, Calendar, Plus } from 'lucide-react';
import { getActiveTournamentIds, getTournamentDetailsFromContract } from '../helpers';

const statusColors: Record<string, string> = {
    0: 'yellow', // Joining
    1: 'green',  // Playing
    2: 'blue',   // ProcessingResults
    3: 'gray',   // Completed
};

function formatEgld(biguint: bigint) {
    return (Number(biguint) / 1e18).toFixed(2);
}

function formatDate(timestamp: number) {
    if (!timestamp) return '-';
    const date = new Date(timestamp * 1000);
    return date.toLocaleString();
}

export const Tournaments = () => {
    const [tournaments, setTournaments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const toast = useToast();

    useEffect(() => {
        const fetchTournaments = async () => {
            setLoading(true);
            setError(null);
            try {
                // Get active tournament IDs from smart contract
                const tournamentIds = await getActiveTournamentIds();
                console.log('Fetched tournamentIds:', tournamentIds);
                if (tournamentIds.length === 0) {
                    setTournaments([]);
                    setLoading(false);
                    return;
                }

                // Fetch details for each tournament
                const tournamentPromises = tournamentIds.map(async (id) => {
                    try {
                        console.log('Fetching tournament details for ID:', id);
                        const details = await getTournamentDetailsFromContract(id);
                        console.log('Tournament ID:', id, 'Details:', details);
                        if (details) {
                            return {
                                id,
                                name: `Tournament #${id}`,
                                status: details.status,
                                players: details.participants || [],
                                description: `Game ID: ${details.game_id}`,
                                prize_pool: formatEgld(details.prize_pool) + ' EGLD',
                                join_deadline: details.join_deadline,
                                play_deadline: details.play_deadline,
                                entry_fee: formatEgld(details.entry_fee),
                                creator: details.creator,
                            };
                        }
                        return null;
                    } catch (err) {
                        console.error(`Error fetching tournament ${id}:`, err);
                        return null;
                    }
                });

                const tournamentResults = await Promise.all(tournamentPromises);
                const validTournaments = tournamentResults.filter(t => t !== null);

                setTournaments(validTournaments);
            } catch (err) {
                console.error('Error fetching tournaments:', err);
                setError('Failed to fetch tournaments from blockchain');
                toast({
                    title: 'Error',
                    description: 'Failed to fetch tournaments from blockchain',
                    status: 'error',
                    duration: 5000,
                    isClosable: true,
                });
            } finally {
                setLoading(false);
            }
        };

        fetchTournaments();
    }, [toast]);

    const columns = useBreakpointValue({ base: 1, md: 2, lg: 3 });

    if (loading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" h="96">
                <SimpleGrid columns={columns} spacing={8} w="full">
                    {[...Array(3)].map((_, i) => (
                        <Skeleton key={i} h="220px" borderRadius="xl" />
                    ))}
                </SimpleGrid>
                <Spinner size="xl" color="blue.500" position="absolute" />
            </Box>
        );
    }

    if (error) {
        return (
            <VStack justify="center" align="center" h="96" spacing={4}>
                <Heading size="md">Error</Heading>
                <Text color="gray.600">{error}</Text>
                <Button variant="outline" onClick={() => window.location.reload()}>
                    Retry
                </Button>
            </VStack>
        );
    }

    return (
        <Box maxW="7xl" mx="auto" py={10} px={4}>
            <HStack justify="space-between" align="center" mb={8}>
                <Heading size="xl">Tournaments</Heading>
                <Button
                    as="a"
                    href="/tournaments/create"
                    leftIcon={<Plus size={20} />}
                    colorScheme="green"
                    size="md"
                    borderRadius="xl"
                    _hover={{ transform: 'translateY(-2px)', boxShadow: 'lg' }}
                >
                    Create Tournament
                </Button>
            </HStack>
            {tournaments.length === 0 ? (
                <VStack justify="center" align="center" h="96" spacing={4}>
                    <Award size={48} color="#CBD5E1" />
                    <Heading size="md">No tournaments found</Heading>
                    <Text color="gray.400">
                        No tournaments have been created yet. Be the first to create one!
                    </Text>
                </VStack>
            ) : (
                <SimpleGrid columns={columns} spacing={8}>
                    {tournaments.map((tournament) => (
                        <Box
                            key={tournament.id}
                            bg="gray.800"
                            border="1px solid"
                            borderColor="gray.700"
                            boxShadow="lg"
                            borderRadius="2xl"
                            p={6}
                            transition="all 0.2s"
                            _hover={{ boxShadow: '2xl', transform: 'translateY(-2px)' }}
                            display="flex"
                            flexDirection="column"
                            justifyContent="space-between"
                        >
                            <HStack justify="space-between" mb={4}>
                                <Heading size="md">{tournament.name}</Heading>
                                <Badge colorScheme={statusColors[tournament.status] || 'gray'} fontSize="sm" px={3} py={1} borderRadius="md">
                                    {['Joining', 'Playing', 'Processing', 'Completed'][tournament.status] || 'Unknown'}
                                </Badge>
                            </HStack>
                            <Text color="gray.300" mb={2} noOfLines={2}>
                                {tournament.description}
                            </Text>
                            <VStack align="start" spacing={2} mb={4}>
                                <HStack color="gray.400" fontSize="sm">
                                    <Users size={16} />
                                    <Text>{tournament.players.length} players</Text>
                                </HStack>
                                <HStack color="gray.400" fontSize="sm">
                                    <Award size={16} />
                                    <Text>Prize Pool: {tournament.prize_pool}</Text>
                                </HStack>
                                <HStack color="gray.400" fontSize="sm">
                                    <Calendar size={16} />
                                    <Text>
                                        Join Deadline: {formatDate(tournament.join_deadline)}
                                    </Text>
                                </HStack>
                                <HStack color="gray.400" fontSize="sm">
                                    <Calendar size={16} />
                                    <Text>
                                        Play Deadline: {formatDate(tournament.play_deadline)}
                                    </Text>
                                </HStack>
                                <HStack color="gray.400" fontSize="sm">
                                    <Text>Entry Fee: {tournament.entry_fee} EGLD</Text>
                                </HStack>
                                <HStack color="gray.400" fontSize="sm">
                                    <Text>Creator: {tournament.creator}</Text>
                                </HStack>
                            </VStack>
                            <Button
                                as="a"
                                href={`/tournaments/${tournament.id}`}
                                colorScheme="blue"
                                w="full"
                                mt={2}
                                borderRadius="xl"
                                fontWeight="bold"
                                fontSize="md"
                                _hover={{ boxShadow: 'md' }}
                            >
                                View Details
                            </Button>
                        </Box>
                    ))}
                </SimpleGrid>
            )}
        </Box>
    );
};

export default Tournaments; 