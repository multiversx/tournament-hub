import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    Box,
    Container,
    VStack,
    HStack,
    Heading,
    Text,
    SimpleGrid,
    Card,
    CardBody,
    CardHeader,
    Table,
    Thead,
    Tbody,
    Tr,
    Th,
    Td,
    Badge,
    Button,
    useColorModeValue,
    Icon,
    Avatar,
    Skeleton,
    SkeletonText,
    Alert,
    AlertIcon,
    AlertTitle,
    AlertDescription,
    Input,
    InputGroup,
    InputLeftElement,
    Flex,
    Spacer,
    ButtonGroup,
    IconButton,
} from '@chakra-ui/react';
import {
    Trophy,
    Medal,
    Crown,
    Star,
    Search,
    RefreshCw,
    Users,
    TrendingUp,
    ChevronLeft,
    ChevronRight,
} from 'lucide-react';
import { useGetAccountInfo } from 'lib';
import { getAllPlayersStats } from '../../helpers';

interface PlayerStats {
    address: string;
    gamesPlayed: number;
    losses: number;
    winRate: number;
    tokensWon: number;
    tokensSpent: number;
    tournamentsWon: number;
    teloRating: number;
    rank?: number;
}

interface LeaderboardStats {
    totalPlayers: number;
    averageTeloRating: number;
    topTeloRating: number;
    totalGamesPlayed: number;
}

export const Leaderboard = React.memo(() => {
    const { address } = useGetAccountInfo();
    const [players, setPlayers] = useState<PlayerStats[]>([]);
    const [stats, setStats] = useState<LeaderboardStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
    const [refreshing, setRefreshing] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);

    const ITEMS_PER_PAGE = 50;

    const bgColor = useColorModeValue('gray.800', 'gray.900');
    const cardBg = useColorModeValue('gray.700', 'gray.800');
    const borderColor = useColorModeValue('gray.600', 'gray.700');


    // Debounce search term
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
            setCurrentPage(1); // Reset to first page on search
        }, 300);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const fetchLeaderboardData = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            // Add timeout to prevent infinite loading
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Request timeout after 30 seconds')), 30000)
            );

            // Fetch real player stats from smart contract
            const allPlayersData = await Promise.race([
                getAllPlayersStats(),
                timeoutPromise
            ]) as any[];
            console.log('Leaderboard - Raw data from contract:', allPlayersData);

            if (!allPlayersData || allPlayersData.length === 0) {
                console.log('Leaderboard - No players data received');
                setPlayers([]);
                setStats({
                    totalPlayers: 0,
                    averageTeloRating: 1500,
                    topTeloRating: 1500,
                    totalGamesPlayed: 0,
                });
                return;
            }

            // Transform the data to match our interface
            const transformedPlayers: PlayerStats[] = allPlayersData.map((player: any) => {
                // Convert BigInt values to numbers
                const wins = Number(player.wins || 0);
                const losses = Number(player.losses || 0);
                const tournamentsWon = Number(player.tournaments_won || 0);

                // Calculate games_played from wins + losses for accuracy
                // The smart contract may have incorrect games_played due to historical bugs
                const gamesPlayed = wins + losses;

                // Win rate is strictly Victories / Games (0-100%)
                const rawWinRate = gamesPlayed > 0 ? (wins / gamesPlayed) * 100 : 0;
                const winRate = Math.min(100, Math.max(0, rawWinRate));

                return {
                    address: player.address,
                    gamesPlayed,
                    losses,
                    winRate,
                    tokensWon: player.tokens_won ? Number(player.tokens_won) / 1e18 : 0, // Convert from wei
                    tokensSpent: player.tokens_spent ? Number(player.tokens_spent) / 1e18 : 0, // Convert from wei
                    tournamentsWon,
                    teloRating: Number(player.telo_rating || 1500),
                };
            });

            // Show players who have any activity (games played > 0)
            console.log('Leaderboard - Transformed players:', transformedPlayers);
            const activePlayers = transformedPlayers.filter(player => player.gamesPlayed > 0);
            console.log('Leaderboard - Active players (gamesPlayed > 0):', activePlayers);

            // Sort by TELO rating and add ranks
            const rankedPlayers = activePlayers
                .sort((a, b) => b.teloRating - a.teloRating)
                .map((player, index) => ({
                    ...player,
                    rank: index + 1,
                }));

            // Calculate stats
            const totalPlayers = rankedPlayers.length;
            const averageTeloRating = totalPlayers > 0
                ? Math.round(rankedPlayers.reduce((sum, p) => sum + p.teloRating, 0) / totalPlayers)
                : 1500;
            const topTeloRating = totalPlayers > 0 ? rankedPlayers[0].teloRating : 1500;
            const totalGamesPlayed = rankedPlayers.reduce((sum, p) => sum + p.gamesPlayed, 0);

            const calculatedStats: LeaderboardStats = {
                totalPlayers,
                averageTeloRating,
                topTeloRating,
                totalGamesPlayed,
            };

            console.log('Leaderboard - Final ranked players:', rankedPlayers);
            console.log('Leaderboard - Final stats:', calculatedStats);
            setPlayers(rankedPlayers);
            setStats(calculatedStats);

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to load leaderboard data';
            setError(errorMessage);
            console.error('Error fetching leaderboard:', err);

        } finally {
            setLoading(false);
        }
    }, []); // Empty deps because we're only calling it once on mount

    useEffect(() => {
        fetchLeaderboardData();
    }, [fetchLeaderboardData]);

    const handleRefresh = useCallback(async () => {
        setRefreshing(true);
        await fetchLeaderboardData();
        setRefreshing(false);
    }, [fetchLeaderboardData]);

    // Memoize filtered players
    const filteredPlayers = useMemo(() => {
        if (!debouncedSearchTerm) return players;
        const lowerSearch = debouncedSearchTerm.toLowerCase();
        return players.filter(player =>
            player.address.toLowerCase().includes(lowerSearch)
        );
    }, [players, debouncedSearchTerm]);

    // Memoize paginated players
    const paginatedPlayers = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        const end = start + ITEMS_PER_PAGE;
        return filteredPlayers.slice(start, end);
    }, [filteredPlayers, currentPage]);

    // Memoize pagination info
    const paginationInfo = useMemo(() => {
        const totalPages = Math.ceil(filteredPlayers.length / ITEMS_PER_PAGE);
        const startItem = (currentPage - 1) * ITEMS_PER_PAGE + 1;
        const endItem = Math.min(currentPage * ITEMS_PER_PAGE, filteredPlayers.length);

        return {
            totalPages,
            startItem,
            endItem,
            hasNextPage: currentPage < totalPages,
            hasPrevPage: currentPage > 1,
        };
    }, [filteredPlayers.length, currentPage]);

    // Memoize helper functions
    const formatAddress = useCallback((addr: string) => {
        return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
    }, []);

    const getRankIcon = useCallback((rank: number) => {
        if (rank === 1) return <Crown size={20} color="#FFD700" />;
        if (rank === 2) return <Medal size={20} color="#C0C0C0" />;
        if (rank === 3) return <Medal size={20} color="#CD7F32" />;
        return <Text fontWeight="bold" color="gray.400">#{rank}</Text>;
    }, []);

    const getRankColor = useCallback((rank: number) => {
        if (rank === 1) return 'yellow.400';
        if (rank === 2) return 'gray.300';
        if (rank === 3) return 'orange.400';
        return 'gray.400';
    }, []);

    const handleNextPage = useCallback(() => {
        if (paginationInfo.hasNextPage) {
            setCurrentPage(prev => prev + 1);
        }
    }, [paginationInfo.hasNextPage]);

    const handlePrevPage = useCallback(() => {
        if (paginationInfo.hasPrevPage) {
            setCurrentPage(prev => prev - 1);
        }
    }, [paginationInfo.hasPrevPage]);

    if (loading) {
        return (
            <Container maxW="7xl" py={10}>
                <VStack spacing={8} align="stretch">
                    <VStack spacing={4} align="start">
                        <Skeleton height="40px" width="200px" />
                        <Skeleton height="20px" width="400px" />
                    </VStack>
                    <SimpleGrid columns={{ base: 1, md: 4 }} spacing={6}>
                        {[1, 2, 3, 4].map((i) => (
                            <Card key={i} bg={cardBg} border="1px solid" borderColor={borderColor}>
                                <CardBody>
                                    <SkeletonText mt="4" noOfLines={3} spacing="4" />
                                </CardBody>
                            </Card>
                        ))}
                    </SimpleGrid>
                    <Card bg={cardBg} border="1px solid" borderColor={borderColor}>
                        <CardBody>
                            <SkeletonText mt="4" noOfLines={10} spacing="4" />
                        </CardBody>
                    </Card>
                </VStack>
            </Container>
        );
    }

    if (error) {
        return (
            <Container maxW="7xl" py={10}>
                <Alert status="error">
                    <AlertIcon />
                    <AlertTitle>Error loading leaderboard!</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
                <Button mt={4} onClick={handleRefresh} isLoading={refreshing}>
                    Retry
                </Button>
            </Container>
        );
    }

    return (
        <Container maxW="7xl" py={10}>
            <VStack spacing={8} align="stretch">
                {/* Header */}
                <HStack justify="space-between" align="start">
                    <VStack spacing={4} align="start">
                        <HStack spacing={3}>
                            <Icon as={Trophy} boxSize={8} color="yellow.400" />
                            <Heading size="2xl" bgGradient="linear(to-r, yellow.400, orange.400)" bgClip="text">
                                Leaderboard
                            </Heading>
                        </HStack>
                        <Text color="gray.400" fontSize="lg">
                            Top players ranked by TELO rating and tournament performance.
                        </Text>
                    </VStack>
                    <HStack spacing={2}>
                        <Button
                            onClick={handleRefresh}
                            isLoading={refreshing}
                            loadingText="Refreshing..."
                            colorScheme="blue"
                            variant="outline"
                            leftIcon={<RefreshCw size={16} />}
                            size="sm"
                        >
                            Refresh
                        </Button>
                        {process.env.NODE_ENV === 'development' && (
                            <Button
                                onClick={() => {
                                    import('../../helpers/debug-leaderboard').then(module => {
                                        module.debugLeaderboard();
                                    });
                                }}
                                colorScheme="purple"
                                variant="outline"
                                size="sm"
                            >
                                Debug
                            </Button>
                        )}
                    </HStack>
                </HStack>

                {/* Stats Overview */}
                <SimpleGrid columns={{ base: 1, md: 4 }} spacing={6}>
                    <Card bg={cardBg} border="1px solid" borderColor={borderColor}>
                        <CardBody>
                            <HStack spacing={3}>
                                <Icon as={Users} boxSize={6} color="blue.400" />
                                <VStack spacing={0} align="start">
                                    <Text color="gray.400" fontSize="sm">Total Players</Text>
                                    <Text color="blue.400" fontSize="2xl" fontWeight="bold">
                                        {stats?.totalPlayers.toLocaleString()}
                                    </Text>
                                </VStack>
                            </HStack>
                        </CardBody>
                    </Card>

                    <Card bg={cardBg} border="1px solid" borderColor={borderColor}>
                        <CardBody>
                            <HStack spacing={3}>
                                <Icon as={Star} boxSize={6} color="yellow.400" />
                                <VStack spacing={0} align="start">
                                    <Text color="gray.400" fontSize="sm">Top TELO Rating</Text>
                                    <Text color="yellow.400" fontSize="2xl" fontWeight="bold">
                                        {stats?.topTeloRating}
                                    </Text>
                                </VStack>
                            </HStack>
                        </CardBody>
                    </Card>

                    <Card bg={cardBg} border="1px solid" borderColor={borderColor}>
                        <CardBody>
                            <HStack spacing={3}>
                                <Icon as={TrendingUp} boxSize={6} color="green.400" />
                                <VStack spacing={0} align="start">
                                    <Text color="gray.400" fontSize="sm">Average Rating</Text>
                                    <Text color="green.400" fontSize="2xl" fontWeight="bold">
                                        {stats?.averageTeloRating}
                                    </Text>
                                </VStack>
                            </HStack>
                        </CardBody>
                    </Card>

                    <Card bg={cardBg} border="1px solid" borderColor={borderColor}>
                        <CardBody>
                            <HStack spacing={3}>
                                <Icon as={Trophy} boxSize={6} color="purple.400" />
                                <VStack spacing={0} align="start">
                                    <Text color="gray.400" fontSize="sm">Total Games</Text>
                                    <Text color="purple.400" fontSize="2xl" fontWeight="bold">
                                        {stats?.totalGamesPlayed.toLocaleString()}
                                    </Text>
                                </VStack>
                            </HStack>
                        </CardBody>
                    </Card>
                </SimpleGrid>

                {/* Search and Filter */}
                <Card bg={cardBg} border="1px solid" borderColor={borderColor}>
                    <CardBody>
                        <Flex align="center" gap={4}>
                            <InputGroup maxW="400px">
                                <InputLeftElement pointerEvents="none">
                                    <Icon as={Search} color="gray.400" />
                                </InputLeftElement>
                                <Input
                                    placeholder="Search by address..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    bg="gray.700"
                                    borderColor="gray.600"
                                    _placeholder={{ color: 'gray.400' }}
                                />
                            </InputGroup>
                            <Spacer />
                            <Text color="gray.400" fontSize="sm">
                                Showing {paginationInfo.startItem}-{paginationInfo.endItem} of {filteredPlayers.length} players
                            </Text>
                        </Flex>
                    </CardBody>
                </Card>

                {/* Leaderboard Table */}
                <Card bg={cardBg} border="1px solid" borderColor={borderColor}>
                    <CardHeader>
                        <HStack spacing={3}>
                            <Icon as={Trophy} boxSize={6} color="yellow.400" />
                            <VStack spacing={0} align="start">
                                <Heading size="md" color="gray.200">
                                    Player Rankings
                                </Heading>
                                <Text color="gray.400" fontSize="sm">
                                    Ranked by TELO rating
                                </Text>
                            </VStack>
                        </HStack>
                    </CardHeader>
                    <CardBody pt={0}>
                        <Box overflowX="auto">
                            <Table variant="simple" size="sm">
                                <Thead>
                                    <Tr>
                                        <Th color="gray.400">Rank</Th>
                                        <Th color="gray.400">Player</Th>
                                        <Th color="gray.400" isNumeric>TELO Rating</Th>
                                        <Th color="gray.400" isNumeric>Games</Th>
                                        <Th color="gray.400" isNumeric>Win Rate</Th>
                                        <Th color="gray.400" isNumeric>Victories</Th>
                                        <Th color="gray.400" isNumeric>Tokens Won</Th>
                                        <Th color="gray.400" isNumeric>Tokens Lost</Th>
                                    </Tr>
                                </Thead>
                                <Tbody>
                                    {paginatedPlayers.map((player) => (
                                        <Tr key={player.address} _hover={{ bg: 'gray.700' }}>
                                            <Td>
                                                <HStack spacing={2}>
                                                    {getRankIcon(player.rank!)}
                                                </HStack>
                                            </Td>
                                            <Td>
                                                <HStack spacing={3}>
                                                    <Avatar
                                                        size="sm"
                                                        name={formatAddress(player.address)}
                                                        bg={player.address === address ? 'blue.500' : 'gray.600'}
                                                    />
                                                    <VStack spacing={0} align="start">
                                                        <Text
                                                            color={player.address === address ? 'blue.400' : 'gray.300'}
                                                            fontWeight={player.address === address ? 'bold' : 'normal'}
                                                            fontSize="sm"
                                                        >
                                                            {formatAddress(player.address)}
                                                        </Text>
                                                        {player.address === address && (
                                                            <Badge colorScheme="blue" size="sm">
                                                                You
                                                            </Badge>
                                                        )}
                                                    </VStack>
                                                </HStack>
                                            </Td>
                                            <Td isNumeric>
                                                <Text color={getRankColor(player.rank!)} fontWeight="bold">
                                                    {player.teloRating}
                                                </Text>
                                            </Td>
                                            <Td isNumeric color="gray.300">{player.gamesPlayed}</Td>
                                            <Td isNumeric color="purple.400">{player.winRate.toFixed(1)}%</Td>
                                            <Td isNumeric color="yellow.400" fontWeight="semibold">{player.tournamentsWon}</Td>
                                            <Td isNumeric color="green.400">{player.tokensWon.toFixed(2)} EGLD</Td>
                                            <Td isNumeric color="red.400">{player.tokensSpent.toFixed(2)} EGLD</Td>
                                        </Tr>
                                    ))}
                                </Tbody>
                            </Table>
                        </Box>

                        {/* Pagination Controls */}
                        {paginationInfo.totalPages > 1 && (
                            <Flex justify="center" align="center" mt={6} gap={4}>
                                <ButtonGroup size="sm" isAttached variant="outline">
                                    <IconButton
                                        aria-label="Previous page"
                                        icon={<ChevronLeft size={16} />}
                                        onClick={handlePrevPage}
                                        isDisabled={!paginationInfo.hasPrevPage}
                                    />
                                    <Button isDisabled>
                                        Page {currentPage} of {paginationInfo.totalPages}
                                    </Button>
                                    <IconButton
                                        aria-label="Next page"
                                        icon={<ChevronRight size={16} />}
                                        onClick={handleNextPage}
                                        isDisabled={!paginationInfo.hasNextPage}
                                    />
                                </ButtonGroup>
                            </Flex>
                        )}
                    </CardBody>
                </Card>
            </VStack>
        </Container>
    );
});

Leaderboard.displayName = 'Leaderboard';
