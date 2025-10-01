import React, { useState, useEffect } from 'react';
import {
    Box,
    Heading,
    Text,
    VStack,
    HStack,
    Badge,
    Button,
    Spinner,
    Skeleton,
    useColorModeValue,
    SimpleGrid,
    Card,
    CardBody,
    CardHeader,
    Divider,
    Icon,
    Tooltip,
    Flex,
    Stat,
    StatLabel,
    StatNumber,
    StatHelpText,
} from '@chakra-ui/react';
import {
    Trophy,
    Users,
    Clock,
    Coins,
    Calendar,
    Gamepad2,
    ChevronRight,
    RefreshCw
} from 'lucide-react';
import { getActiveTournamentIds, getTournamentDetailsFromContract, getGameConfig } from '../helpers';

interface TournamentDetails {
    game_id: number;
    status: number;
    participants: string[];
    final_podium: string[];
    creator: string;
    max_players: number;
    min_players: number;
    entry_fee: string;
    name: string;
    created_at: number;
}

interface GameInfo {
    name: string;
    description: string;
    icon: string;
}

const GAME_TYPES: { [key: number]: GameInfo } = {
    1: { name: 'Tic Tac Toe', description: 'Classic 3x3 grid strategy game', icon: '🎯' },
    2: { name: 'Chess', description: 'Strategic board game', icon: '♟️' },
    3: { name: 'Dodge Dash', description: 'Fast-paced obstacle avoidance', icon: '🏃' },
    5: { name: 'CryptoBubbles', description: 'Real-time cell battle arena', icon: '🫧' },
    7: { name: 'Connect Four', description: 'Classic strategy game - connect 4 in a row to win', icon: '🔴' },
    8: { name: 'Battleship', description: 'Classic naval warfare strategy game', icon: '🚢' },
};

const getGameColor = (gameId: number): string => {
    const colors = {
        1: 'purple', // Tic Tac Toe
        2: 'blue',   // Chess
        3: 'red',    // Dodge Dash
        5: 'cyan',   // CryptoBubbles
        7: 'orange', // Connect Four
        8: 'teal',   // Battleship
    };
    return colors[gameId as keyof typeof colors] || 'gray';
};

const formatEGLD = (wei: string): string => {
    const value = BigInt(wei);
    const egld = Number(value) / 1e18;
    return egld.toFixed(2);
};


const formatTimeAgo = (timestamp: number): string => {
    const now = Date.now() / 1000;
    const diff = now - timestamp;

    if (diff < 3600) {
        const minutes = Math.floor(diff / 60);
        return `${minutes}m ago`;
    } else if (diff < 86400) {
        const hours = Math.floor(diff / 3600);
        return `${hours}h ago`;
    } else {
        const days = Math.floor(diff / 86400);
        return `${days}d ago`;
    }
};

const getStatusInfo = (status: number) => {
    switch (status) {
        case 0:
            return { label: 'Joining', color: 'yellow', description: 'Players can still join' };
        case 1:
            return { label: 'Ready to Start', color: 'blue', description: 'Minimum players reached' };
        case 2:
            return { label: 'Playing', color: 'green', description: 'Game in progress' };
        case 4:
            return { label: 'Completed', color: 'purple', description: 'Tournament finished' };
        default:
            return { label: 'Unknown', color: 'gray', description: 'Unknown status' };
    }
};

export const UpcomingTournaments: React.FC = () => {
    const [tournaments, setTournaments] = useState<TournamentDetails[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);

    const bgColor = useColorModeValue('gray.50', 'gray.800');
    const cardBg = useColorModeValue('white', 'gray.700');
    const borderColor = useColorModeValue('gray.200', 'gray.600');

    const fetchUpcomingTournaments = async () => {
        try {
            setLoading(true);
            setError(null);

            const tournamentIds = await getActiveTournamentIds();

            if (tournamentIds.length === 0) {
                setTournaments([]);
                return;
            }

            // Fetch details for all tournaments
            const tournamentPromises = tournamentIds.map(id =>
                getTournamentDetailsFromContract(id).catch(() => null)
            );

            const allTournaments = await Promise.all(tournamentPromises);
            const validTournaments = allTournaments.filter(t => t !== null) as unknown as TournamentDetails[];

            // Filter for tournaments to display (status 0, 1, 2, or 4) - exclude status 3 (ProcessingResults)
            const upcomingTournaments = validTournaments.filter(t =>
                t.status === 0 || t.status === 1 || t.status === 2 || t.status === 4
            );

            // Sort by creation time (newest first)
            upcomingTournaments.sort((a, b) => b.created_at - a.created_at);

            setTournaments(upcomingTournaments);
        } catch (err) {
            console.error('Error fetching upcoming tournaments:', err);
            setError(err instanceof Error ? err.message : 'Failed to fetch tournaments');
        } finally {
            setLoading(false);
        }
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        await fetchUpcomingTournaments();
        setRefreshing(false);
    };

    useEffect(() => {
        fetchUpcomingTournaments();
    }, []);

    if (loading) {
        return (
            <Box p={6}>
                <VStack spacing={4} align="stretch">
                    <HStack justify="space-between">
                        <Heading size="lg">Upcoming Tournaments</Heading>
                        <Skeleton height="40px" width="100px" />
                    </HStack>
                    <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={4}>
                        {[1, 2, 3].map(i => (
                            <Card key={i} bg={cardBg} border="1px solid" borderColor={borderColor}>
                                <CardHeader>
                                    <Skeleton height="20px" />
                                    <Skeleton height="16px" width="60%" />
                                </CardHeader>
                                <CardBody>
                                    <VStack spacing={3} align="stretch">
                                        <Skeleton height="16px" />
                                        <Skeleton height="16px" />
                                        <Skeleton height="16px" />
                                    </VStack>
                                </CardBody>
                            </Card>
                        ))}
                    </SimpleGrid>
                </VStack>
            </Box>
        );
    }

    if (error) {
        return (
            <Box p={6}>
                <VStack spacing={4} align="stretch">
                    <HStack justify="space-between">
                        <Heading size="lg">Upcoming Tournaments</Heading>
                        <Button
                            leftIcon={<RefreshCw size={16} />}
                            onClick={handleRefresh}
                            size="sm"
                            colorScheme="blue"
                            variant="outline"
                        >
                            Retry
                        </Button>
                    </HStack>
                    <Box textAlign="center" py={8}>
                        <Text color="red.400" mb={4}>
                            Failed to load tournaments: {error}
                        </Text>
                    </Box>
                </VStack>
            </Box>
        );
    }

    return (
        <Box p={6}>
            <VStack spacing={6} align="stretch">
                <HStack justify="space-between" align="center">
                    <Heading size="lg">Tournaments</Heading>
                    <HStack spacing={2}>
                        <Badge colorScheme="blue" fontSize="sm" px={3} py={1} borderRadius="md">
                            {tournaments.length} tournaments
                        </Badge>
                        <Button
                            leftIcon={<RefreshCw size={16} />}
                            onClick={handleRefresh}
                            size="sm"
                            colorScheme="blue"
                            variant="outline"
                            isLoading={refreshing}
                        >
                            Refresh
                        </Button>
                    </HStack>
                </HStack>

                {tournaments.length === 0 ? (
                    <Box textAlign="center" py={12}>
                        <Trophy size={48} color="#718096" />
                        <Heading size="md" mt={4} color="gray.500">
                            No Tournaments Available
                        </Heading>
                        <Text color="gray.400" mt={2}>
                            Check back later for new tournaments or create your own!
                        </Text>
                    </Box>
                ) : (
                    <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={6}>
                        {tournaments.map((tournament, index) => {
                            const gameInfo = GAME_TYPES[tournament.game_id] || {
                                name: `Game ${tournament.game_id}`,
                                description: 'Unknown game type',
                                icon: '🎮'
                            };
                            const statusInfo = getStatusInfo(tournament.status);
                            const participantCount = tournament.participants.length;
                            const progressPercent = (participantCount / tournament.max_players) * 100;

                            const gameColor = getGameColor(tournament.game_id);

                            return (
                                <Card
                                    key={index}
                                    bg={cardBg}
                                    border="1px solid"
                                    borderColor={borderColor}
                                    position="relative"
                                    overflow="hidden"
                                    _hover={{
                                        transform: 'translateY(-4px)',
                                        boxShadow: '2xl',
                                        borderColor: `${gameColor}.500`,
                                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                                    }}
                                    transition="all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
                                >
                                    <CardHeader pb={4}>
                                        <VStack spacing={3} align="start">
                                            <HStack justify="space-between" w="full">
                                                <HStack spacing={3}>
                                                    <Box
                                                        p={2}
                                                        bgGradient={`linear(to-br, ${gameColor}.500, ${gameColor}.600)`}
                                                        borderRadius="lg"
                                                        boxShadow="md"
                                                    >
                                                        <Text fontSize="xl">{gameInfo.icon}</Text>
                                                    </Box>
                                                    <VStack spacing={1} align="start">
                                                        <Heading size="md" noOfLines={1} fontWeight="semibold">
                                                            {tournament.name}
                                                        </Heading>
                                                        <Text fontSize="sm" color="gray.400" fontWeight="medium">
                                                            {gameInfo.name}
                                                        </Text>
                                                    </VStack>
                                                </HStack>
                                                <Badge
                                                    colorScheme={statusInfo.color}
                                                    fontSize="xs"
                                                    px={3}
                                                    py={1}
                                                    borderRadius="lg"
                                                    fontWeight="semibold"
                                                    textTransform="uppercase"
                                                    letterSpacing="0.05em"
                                                >
                                                    {statusInfo.label}
                                                </Badge>
                                            </HStack>
                                        </VStack>
                                    </CardHeader>

                                    <CardBody pt={0}>
                                        <VStack spacing={4} align="stretch">
                                            {/* Game Description */}
                                            <Text fontSize="sm" color="gray.600" noOfLines={2}>
                                                {gameInfo.description}
                                            </Text>

                                            <Divider />

                                            {/* Tournament Stats */}
                                            <SimpleGrid columns={2} spacing={4}>
                                                <Stat size="sm">
                                                    <StatLabel fontSize="xs" color="gray.500">Entry Fee</StatLabel>
                                                    <StatNumber fontSize="sm">
                                                        {formatEGLD(tournament.entry_fee)} EGLD
                                                    </StatNumber>
                                                </Stat>
                                            </SimpleGrid>

                                            {/* Enhanced Players Progress */}
                                            <Box>
                                                <HStack justify="space-between" mb={3}>
                                                    <Text fontSize="sm" color="gray.400" fontWeight="medium">Players</Text>
                                                    <Text fontSize="sm" color="gray.300" fontWeight="semibold">
                                                        {participantCount}/{tournament.max_players}
                                                    </Text>
                                                </HStack>
                                                <Box
                                                    w="full"
                                                    bg="gray.700"
                                                    borderRadius="full"
                                                    h="8px"
                                                    overflow="hidden"
                                                    position="relative"
                                                >
                                                    <Box
                                                        bgGradient={`linear(to-r, ${gameColor}.400, ${gameColor}.500)`}
                                                        h="100%"
                                                        w={`${Math.min(progressPercent, 100)}%`}
                                                        transition="width 0.5s cubic-bezier(0.4, 0, 0.2, 1)"
                                                        borderRadius="full"
                                                        boxShadow="sm"
                                                    />
                                                </Box>
                                                <HStack justify="space-between" mt={2}>
                                                    <Text fontSize="xs" color="gray.500">
                                                        Min: {tournament.min_players} to start
                                                    </Text>
                                                    <Text fontSize="xs" color="gray.500">
                                                        {Math.round(progressPercent)}% full
                                                    </Text>
                                                </HStack>
                                            </Box>

                                            <Divider />

                                            {/* Enhanced Footer Info */}
                                            <HStack justify="space-between" align="center">
                                                <HStack spacing={2} color="gray.500">
                                                    <Calendar size={14} />
                                                    <Text fontSize="sm">{formatTimeAgo(tournament.created_at)}</Text>
                                                </HStack>
                                                <Button
                                                    size="sm"
                                                    rightIcon={<ChevronRight size={14} />}
                                                    colorScheme={gameColor}
                                                    variant="solid"
                                                    fontWeight="semibold"
                                                    px={4}
                                                    py={2}
                                                    borderRadius="lg"
                                                    _hover={{
                                                        transform: 'translateX(2px)',
                                                        boxShadow: 'md'
                                                    }}
                                                    transition="all 0.2s"
                                                >
                                                    View Details
                                                </Button>
                                            </HStack>
                                        </VStack>
                                    </CardBody>
                                </Card>
                            );
                        })}
                    </SimpleGrid>
                )}
            </VStack>
        </Box>
    );
};
