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
    Card,
    CardBody,
    CardHeader,
    Divider,
    useToast,
} from '@chakra-ui/react';
import { Users, Award, Calendar, Play, Trophy } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { tournamentService } from '../services/tournamentService';

// TODO: Replace with real fetch logic
const mockTournamentDetails = {
    id: 1,
    name: 'Summer Showdown',
    status: 'active',
    players: ['Alice', 'Bob', 'Charlie', 'Dave', 'Eve', 'Frank'],
    description: 'A summer tournament for all skill levels. Join the competition and prove your skills!',
    prize_pool: '5 EGLD',
    entry_fee: '0.1 EGLD',
    join_deadline: 1731801600,
    play_deadline: 1732406400,
    creator: 'erd1...abc123',
    max_players: 8,
    current_players: 6,
};

const statusColors: Record<string, string> = {
    created: 'yellow',
    active: 'green',
    finished: 'gray',
};

export const TournamentDetails = () => {
    const { id } = useParams();
    const [tournament, setTournament] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [joining, setJoining] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const toast = useToast();

    useEffect(() => {
        setLoading(true);
        setError(null);
        // Simulate API call
        setTimeout(() => {
            setTournament(mockTournamentDetails);
            setLoading(false);
        }, 800);
    }, [id]);

    const handleJoinTournament = async () => {
        setJoining(true);
        try {
            console.log('Joining tournament:', id);

            // Call the blockchain service to join tournament
            const result = await tournamentService.joinTournament(
                parseInt(id || '0'),
                tournament?.entry_fee || '0'
            );

            if (result.success) {
                toast({
                    title: 'Success!',
                    description: `You have joined the tournament successfully! Transaction: ${result.transactionHash}`,
                    status: 'success',
                    duration: 5000,
                    isClosable: true,
                });

                // TODO: Refetch tournament details to show updated participant list
                // This would update the tournament state with the new participant
            } else {
                throw new Error('Failed to join tournament');
            }

        } catch (err) {
            console.error('Error joining tournament:', err);
            toast({
                title: 'Error',
                description: 'Failed to join tournament. Please try again.',
                status: 'error',
                duration: 5000,
                isClosable: true,
            });
        } finally {
            setJoining(false);
        }
    };

    const columns = useBreakpointValue({ base: 1, md: 2 });

    if (loading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" h="96">
                <VStack spacing={4}>
                    <Spinner size="xl" color="blue.500" />
                    <Text>Loading tournament details...</Text>
                </VStack>
            </Box>
        );
    }

    if (error) {
        return (
            <VStack justify="center" align="center" h="96" spacing={4}>
                <Heading size="md">Error</Heading>
                <Text color="gray.400">{error}</Text>
                <Button variant="outline" onClick={() => window.location.reload()}>
                    Retry
                </Button>
            </VStack>
        );
    }

    if (!tournament) {
        return (
            <VStack justify="center" align="center" h="96" spacing={4}>
                <Heading size="md">Tournament not found</Heading>
                <Text color="gray.400">The tournament you're looking for doesn't exist.</Text>
            </VStack>
        );
    }

    return (
        <Box maxW="7xl" mx="auto" py={10} px={4}>
            <VStack spacing={8} align="stretch">
                {/* Header */}
                <Box>
                    <HStack justify="space-between" align="start" mb={4}>
                        <VStack align="start" spacing={2}>
                            <Heading size="xl">{tournament.name}</Heading>
                            <Badge colorScheme={statusColors[tournament.status] || 'gray'} fontSize="md" px={3} py={1} borderRadius="md">
                                {tournament.status}
                            </Badge>
                        </VStack>
                        <Button
                            leftIcon={<Play size={20} />}
                            colorScheme="blue"
                            size="lg"
                            onClick={handleJoinTournament}
                            isLoading={joining}
                            loadingText="Joining..."
                            isDisabled={tournament.status !== 'created' || tournament.current_players >= tournament.max_players}
                        >
                            Join Tournament
                        </Button>
                    </HStack>
                    <Text color="gray.300" fontSize="lg" lineHeight="tall">
                        {tournament.description}
                    </Text>
                </Box>

                <SimpleGrid columns={columns} spacing={8}>
                    {/* Tournament Info */}
                    <Card bg="gray.800" border="1px solid" borderColor="gray.700">
                        <CardHeader>
                            <Heading size="md">Tournament Information</Heading>
                        </CardHeader>
                        <CardBody>
                            <VStack spacing={4} align="stretch">
                                <HStack justify="space-between">
                                    <Text color="gray.400">Prize Pool:</Text>
                                    <Text fontWeight="bold" color="yellow.400">{tournament.prize_pool}</Text>
                                </HStack>
                                <HStack justify="space-between">
                                    <Text color="gray.400">Entry Fee:</Text>
                                    <Text fontWeight="bold">{tournament.entry_fee}</Text>
                                </HStack>
                                <HStack justify="space-between">
                                    <Text color="gray.400">Players:</Text>
                                    <Text fontWeight="bold">{tournament.current_players}/{tournament.max_players}</Text>
                                </HStack>
                                <HStack justify="space-between">
                                    <Text color="gray.400">Creator:</Text>
                                    <Text fontWeight="bold" fontSize="sm" color="blue.400">{tournament.creator}</Text>
                                </HStack>
                            </VStack>
                        </CardBody>
                    </Card>

                    {/* Deadlines */}
                    <Card bg="gray.800" border="1px solid" borderColor="gray.700">
                        <CardHeader>
                            <Heading size="md">Important Dates</Heading>
                        </CardHeader>
                        <CardBody>
                            <VStack spacing={4} align="stretch">
                                <HStack justify="space-between">
                                    <Text color="gray.400">Join Deadline:</Text>
                                    <Text fontWeight="bold">{new Date(tournament.join_deadline * 1000).toLocaleDateString()}</Text>
                                </HStack>
                                <HStack justify="space-between">
                                    <Text color="gray.400">Play Deadline:</Text>
                                    <Text fontWeight="bold">{new Date(tournament.play_deadline * 1000).toLocaleDateString()}</Text>
                                </HStack>
                            </VStack>
                        </CardBody>
                    </Card>
                </SimpleGrid>

                {/* Players List */}
                <Card bg="gray.800" border="1px solid" borderColor="gray.700">
                    <CardHeader>
                        <HStack>
                            <Users size={20} />
                            <Heading size="md">Participants ({tournament.players.length})</Heading>
                        </HStack>
                    </CardHeader>
                    <CardBody>
                        <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={4}>
                            {tournament.players.map((player: string, index: number) => (
                                <HStack key={index} p={3} bg="gray.700" borderRadius="md">
                                    <Trophy size={16} color="#FFD700" />
                                    <Text fontWeight="medium">{player}</Text>
                                </HStack>
                            ))}
                        </SimpleGrid>
                    </CardBody>
                </Card>
            </VStack>
        </Box>
    );
};

export default TournamentDetails; 