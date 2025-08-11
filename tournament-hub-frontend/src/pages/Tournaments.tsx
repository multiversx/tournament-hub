import React, { useEffect, useState, useCallback, useMemo } from 'react';
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
    Input,
    InputGroup,
    InputLeftElement,
    Select,
    Collapse,
    IconButton,
    useColorModeValue,
    Modal,
    ModalOverlay,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalCloseButton,
    useDisclosure,
    Flex,
    Center,
    Progress,
} from '@chakra-ui/react';
import { Users, Award, Calendar, Plus, Search, Filter, ChevronDown, ChevronUp, Trophy, Clock, Copy, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { getActiveTournamentIds, getTournamentDetailsFromContract, getGameConfig, getPrizePoolFromContract, getTournamentsFromBlockchain, findTournamentsByTesting, getSubmitResultsTransactionHash } from '../helpers';

const statusColors: { [key: number]: string } = {
    0: 'yellow', // Joining
    1: 'blue',   // ProcessingResults
    2: 'gray',   // Completed
};

const statusMap: { [key: number]: string } = {
    0: 'Joining',
    1: 'ProcessingResults',
    2: 'Completed'
};

// Cache for tournament data
const tournamentCache = new Map<string, any>();
const ITEMS_PER_PAGE = 6;

// Request deduplication - prevent multiple simultaneous requests for the same data
const pendingRequests = new Map<string, Promise<any>>();

// Persistent cache using localStorage
const PERSISTENT_CACHE_KEY = 'tournament_cache_v2';
const CACHE_EXPIRY = 30 * 1000; // 30 seconds - shorter cache for more frequent updates

function getPersistentCache() {
    try {
        const cached = localStorage.getItem(PERSISTENT_CACHE_KEY);
        if (cached) {
            const { data, timestamp } = JSON.parse(cached);
            if (Date.now() - timestamp < CACHE_EXPIRY) {
                // Convert string IDs back to BigInt
                const processedData: any = {};
                for (const [key, value] of Object.entries(data)) {
                    if (value && typeof value === 'object' && 'id' in value && typeof value.id === 'string') {
                        processedData[key] = {
                            ...value,
                            id: BigInt(value.id)
                        };
                    } else {
                        processedData[key] = value;
                    }
                }
                return processedData;
            }
        }
    } catch (e) {
        console.warn('Failed to load persistent cache:', e);
    }
    return {};
}

function setPersistentCache(data: any) {
    try {
        // Convert BigInt values to strings for JSON serialization
        const serializableData = JSON.parse(JSON.stringify(data, (key, value) => {
            if (typeof value === 'bigint') {
                return value.toString();
            }
            return value;
        }));

        localStorage.setItem(PERSISTENT_CACHE_KEY, JSON.stringify({
            data: serializableData,
            timestamp: Date.now()
        }));
    } catch (e) {
        console.warn('Failed to save persistent cache:', e);
    }
}

// Deduplication wrapper for API calls
function deduplicateRequest<T>(key: string, requestFn: () => Promise<T>): Promise<T> {
    if (pendingRequests.has(key)) {
        return pendingRequests.get(key)!;
    }

    const promise = requestFn().finally(() => {
        pendingRequests.delete(key);
    });

    pendingRequests.set(key, promise);
    return promise;
}

function formatEgld(biguint: bigint) {
    return (Number(biguint) / 1e18).toFixed(2);
}

function getGameName(gameId: number): string {
    switch (gameId) {
        case 1:
            return 'Tic-Tac-Toe';
        case 5:
            return 'CryptoBubbles';
        default:
            return `Game ID: ${gameId}`;
    }
}

// Optimized tournament card component
const TournamentCard = React.memo(({ tournament, onLoadDetails }: { tournament: any; onLoadDetails: (id: bigint) => void }) => {
    const toast = useToast();
    const bgColor = useColorModeValue('gray.800', 'gray.900');
    const borderColor = useColorModeValue('gray.700', 'gray.600');

    return (
        <Box
            bg={bgColor}
            border="1px solid"
            borderColor={borderColor}
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
                    {statusMap[Number(tournament.status)] || 'Unknown'}
                </Badge>
            </HStack>

            <Text color="gray.300" mb={2} noOfLines={2}>
                {tournament.description}
            </Text>

            <VStack align="start" spacing={2} mb={4}>

                <HStack color="gray.400" fontSize="sm" justify="space-between" w="full" align="flex-start">
                    <HStack align="center" minW="0" flex="1">
                        <Users size={16} />
                        <Text>{tournament.participants?.length || 0} players</Text>
                    </HStack>
                    <Box w="32px" display="flex" justifyContent="center" alignItems="center" h="20px">
                        {/* Empty space for alignment */}
                    </Box>
                </HStack>

                <HStack color="gray.400" fontSize="sm" justify="space-between" w="full" align="flex-start">
                    <HStack align="center" minW="0" flex="1">
                        <Award size={16} />
                        <Text>
                            Prize Pool: {tournament.prizePool !== null ?
                                formatEgld(tournament.prizePool) + ' EGLD' :
                                tournament.prizePoolLoaded ? 'Loading...' : '0.00 EGLD'
                            }
                        </Text>
                    </HStack>
                    <Box w="32px" display="flex" justifyContent="center" alignItems="center" h="20px">
                        {/* Empty space for alignment */}
                    </Box>
                </HStack>

                <HStack color="gray.400" fontSize="sm" justify="space-between" w="full" align="flex-start">
                    <HStack align="center" minW="0" flex="1">
                        <Box w="16px" /> {/* Spacer for consistent alignment */}
                        <Text>Creator: {tournament.creator ?
                            `${tournament.creator.slice(0, 8)}...${tournament.creator.slice(-6)}` :
                            'N/A'
                        }</Text>
                    </HStack>
                    <Box w="32px" display="flex" justifyContent="center" alignItems="center" h="20px">
                        <IconButton
                            aria-label="Copy creator address"
                            icon={<Copy size={12} />}
                            size="xs"
                            variant="ghost"
                            colorScheme="blue"
                            onClick={() => {
                                if (tournament.creator) {
                                    navigator.clipboard.writeText(tournament.creator);
                                    toast({
                                        title: 'Address copied!',
                                        status: 'success',
                                        duration: 2000,
                                        isClosable: true,
                                    });
                                }
                            }}
                            _hover={{ bg: 'blue.700', color: 'white' }}
                            _focus={{ bg: 'blue.700', color: 'white' }}
                        />
                    </Box>
                </HStack>

                {tournament.status === 2 && tournament.final_podium?.length > 0 && (
                    <VStack color="gray.400" fontSize="sm" align="start" spacing={2}>
                        <HStack justify="space-between" w="full" align="flex-start">
                            <HStack align="center" minW="0" flex="1">
                                <Box w="16px" /> {/* Spacer for consistent alignment */}
                                <Trophy size={16} />
                                <Text>
                                    Winner: {tournament.final_podium[0] ?
                                        `${tournament.final_podium[0].slice(0, 8)}...${tournament.final_podium[0].slice(-6)}` :
                                        'N/A'
                                    }
                                </Text>
                            </HStack>
                            <Box w="32px" display="flex" justifyContent="center" alignItems="center" h="20px">
                                <IconButton
                                    aria-label="Copy winner address"
                                    icon={<Copy size={12} />}
                                    size="xs"
                                    variant="ghost"
                                    colorScheme="blue"
                                    onClick={() => {
                                        if (tournament.final_podium[0]) {
                                            navigator.clipboard.writeText(tournament.final_podium[0]);
                                            toast({
                                                title: 'Winner address copied!',
                                                status: 'success',
                                                duration: 2000,
                                                isClosable: true,
                                            });
                                        }
                                    }}
                                    _hover={{ bg: 'blue.700', color: 'white' }}
                                    _focus={{ bg: 'blue.700', color: 'white' }}
                                />
                            </Box>
                        </HStack>
                        <HStack justify="space-between" w="full" align="flex-start">
                            <HStack align="center" minW="0" flex="1">
                                <Box w="16px" /> {/* Spacer for consistent alignment */}
                                <Text fontSize="xs">Result TX:</Text>
                                <Text fontSize="xs" fontFamily="mono">
                                    {tournament.resultTxHash ?
                                        `${tournament.resultTxHash.slice(0, 8)}...${tournament.resultTxHash.slice(-6)}` :
                                        'Pending...'
                                    }
                                </Text>
                            </HStack>
                            <Box w="32px" display="flex" justifyContent="center" alignItems="center" h="20px">
                                {tournament.resultTxHash && (
                                    <IconButton
                                        aria-label="Copy transaction hash"
                                        icon={<Copy size={12} />}
                                        size="xs"
                                        variant="ghost"
                                        colorScheme="blue"
                                        onClick={() => {
                                            navigator.clipboard.writeText(tournament.resultTxHash);
                                            toast({
                                                title: 'Transaction hash copied!',
                                                status: 'success',
                                                duration: 2000,
                                                isClosable: true,
                                            });
                                        }}
                                        _hover={{ bg: 'blue.700', color: 'white' }}
                                        _focus={{ bg: 'blue.700', color: 'white' }}
                                    />
                                )}
                            </Box>
                        </HStack>
                    </VStack>
                )}

                {tournament.gameConfig && (
                    <Box mt={2} p={2} bg="gray.700" borderRadius="md" w="full">
                        <Text fontWeight="bold" color="gray.200">Game Config</Text>
                        <Text fontSize="sm" color="gray.300">Podium Size: {tournament.gameConfig.podium_size}</Text>
                        <Text fontSize="sm" color="gray.300">House Fee: {(tournament.gameConfig.house_fee_percentage / 100).toFixed(2)}%</Text>
                    </Box>
                )}

                {/* Load details button for incomplete data */}
                {!tournament.gameConfigLoaded && (
                    <Button
                        size="sm"
                        colorScheme="blue"
                        variant="outline"
                        onClick={() => onLoadDetails(tournament.id)}
                        isLoading={tournament.loadingDetails}
                    >
                        Load Details
                    </Button>
                )}
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
    );
});

export const Tournaments = () => {
    const [tournaments, setTournaments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [showFilters, setShowFilters] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [loadingDetails, setLoadingDetails] = useState<Set<string>>(new Set());
    const [lastRefresh, setLastRefresh] = useState<number>(Date.now());
    const { isOpen, onOpen, onClose } = useDisclosure();

    const toast = useToast();
    const bgColor = useColorModeValue('gray.800', 'gray.900');
    const borderColor = useColorModeValue('gray.700', 'gray.600');

    // Load basic tournament data first
    const loadBasicTournamentData = useCallback(async (id: bigint) => {
        const cacheKey = `basic_${id}`;

        // Check in-memory cache first
        if (tournamentCache.has(cacheKey)) {
            return tournamentCache.get(cacheKey);
        }

        // Check persistent cache
        const persistentCache = getPersistentCache();
        if (persistentCache[cacheKey]) {
            const cachedData = persistentCache[cacheKey];
            console.log(`Loading tournament ${id} from persistent cache, resultTxLoaded: ${cachedData.resultTxLoaded}, resultTxHash: ${cachedData.resultTxHash}`);

            // If this is a completed tournament but result TX is missing, mark it as not loaded
            if (cachedData.status === 2 && cachedData.resultTxLoaded && !cachedData.resultTxHash) {
                console.log(`Tournament ${id} is completed but missing result TX, will retry loading`);
                cachedData.resultTxLoaded = false;
                cachedData.resultTxHash = null;
            }

            tournamentCache.set(cacheKey, cachedData);
            return cachedData;
        }

        // Use deduplication to prevent multiple simultaneous requests
        return deduplicateRequest(cacheKey, async () => {
            try {
                const details = await getTournamentDetailsFromContract(id);
                console.log(`Tournament ${id} details:`, details);
                if (details) {
                    // Load prize pool and result TX in parallel for better performance
                    const [prizePool, resultTxHash] = await Promise.allSettled([
                        getPrizePoolFromContract(id),
                        details.status === 2 ? getSubmitResultsTransactionHash(id) : Promise.resolve(null)
                    ]);

                    const basicData = {
                        id,
                        name: details.name || `Tournament #${id}`,
                        status: details.status,
                        participants: details.participants || [],
                        description: getGameName(Number(details.game_id)),
                        creator: details.creator,
                        final_podium: details.final_podium || [],
                        game_id: details.game_id,
                        prizePool: prizePool.status === 'fulfilled' ? prizePool.value : null,
                        prizePoolLoaded: true,
                        gameConfig: null,
                        gameConfigLoaded: false,
                        resultTxHash: resultTxHash.status === 'fulfilled' ? resultTxHash.value : null,
                        resultTxLoaded: details.status === 2,
                        loadingDetails: false
                    };

                    // Cache in both memory and persistent storage
                    tournamentCache.set(cacheKey, basicData);
                    const updatedPersistentCache = getPersistentCache();
                    updatedPersistentCache[cacheKey] = basicData;
                    setPersistentCache(updatedPersistentCache);

                    return basicData;
                }
            } catch (err) {
                console.error(`Error fetching basic data for tournament ${id}:`, err);
            }
            return null;
        });
    }, []);

    // Load additional tournament details on demand
    const loadTournamentDetails = useCallback(async (id: bigint) => {
        const cacheKey = `basic_${id}`;
        const tournament = tournamentCache.get(cacheKey);
        if (!tournament || loadingDetails.has(id.toString())) {
            console.log(`Skipping loadTournamentDetails for ${id}: tournament=${!!tournament}, loadingDetails=${loadingDetails.has(id.toString())}`);
            return;
        }

        console.log(`Loading tournament details for ${id}, status: ${tournament.status}, resultTxLoaded: ${tournament.resultTxLoaded}, resultTxHash: ${tournament.resultTxHash}`);
        setLoadingDetails(prev => new Set(prev).add(id.toString()));

        try {
            const promises = [];

            // Load game config
            if (!tournament.gameConfigLoaded && tournament.game_id) {
                promises.push(
                    getGameConfig(tournament.game_id).then(gameConfig => {
                        tournament.gameConfig = gameConfig;
                        tournament.gameConfigLoaded = true;
                    }).catch(() => {
                        tournament.gameConfig = null;
                        tournament.gameConfigLoaded = true;
                    })
                );
            }

            // Load result transaction hash only for completed tournaments
            if (!tournament.resultTxLoaded && tournament.status === 2) {
                console.log(`Will load result TX for tournament ${id}`);
                promises.push(
                    getSubmitResultsTransactionHash(id).then(resultTxHash => {
                        console.log(`Got result TX for tournament ${id}: ${resultTxHash}`);
                        tournament.resultTxHash = resultTxHash;
                        tournament.resultTxLoaded = true;
                    }).catch(() => {
                        console.log(`Failed to get result TX for tournament ${id}`);
                        tournament.resultTxHash = null;
                        tournament.resultTxLoaded = true;
                    })
                );
            } else {
                console.log(`Skipping result TX load for tournament ${id}: resultTxLoaded=${tournament.resultTxLoaded}, status=${tournament.status}`);
            }

            await Promise.all(promises);
            tournamentCache.set(cacheKey, tournament);

            // Update the tournaments state
            setTournaments(prev => prev.map(t => t.id === id ? tournament : t));
        } catch (err) {
            console.error(`Error loading details for tournament ${id}:`, err);
        } finally {
            setLoadingDetails(prev => {
                const newSet = new Set(prev);
                newSet.delete(id.toString());
                return newSet;
            });
        }
    }, [loadingDetails]);

    // Initial load of tournament IDs and basic data
    useEffect(() => {
        const fetchTournaments = async () => {
            setLoading(true);
            setError(null);
            try {
                // Try to get active tournament IDs from smart contract first
                console.log('Fetching tournaments: Starting with getActiveTournamentIds...');
                let tournamentIds = await getActiveTournamentIds();
                console.log(`getActiveTournamentIds returned ${tournamentIds.length} tournaments`);

                // If no tournaments found, try events (but limit the search)
                if (tournamentIds.length === 0) {
                    console.log('No active tournaments found, trying events...');
                    const eventTournaments = await getTournamentsFromBlockchain();
                    tournamentIds = eventTournaments
                        .filter((t): t is NonNullable<typeof t> => t !== null)
                        .map(t => BigInt(t.id || 0))
                        .filter(id => id > 0n)
                        .slice(0, 50); // Increased limit to 50
                    console.log(`Events returned ${tournamentIds.length} tournaments`);
                }

                // Only use testing fallback if we have no tournaments at all
                if (tournamentIds.length === 0) {
                    console.log('No tournaments found in events, trying testing fallback...');
                    tournamentIds = await findTournamentsByTesting();
                    console.log(`Testing fallback returned ${tournamentIds.length} tournaments`);
                }

                if (tournamentIds.length === 0) {
                    console.log('No tournaments found by any method');
                    setTournaments([]);
                    setLoading(false);
                    return;
                }

                console.log(`Found ${tournamentIds.length} tournaments, loading data...`);
                console.log('Tournament IDs:', tournamentIds);

                // Load basic data for all tournaments in parallel with better error handling
                const basicDataPromises = tournamentIds.map(async (id) => {
                    try {
                        return await loadBasicTournamentData(id);
                    } catch (err) {
                        console.error(`Failed to load tournament ${id}:`, err);
                        return null;
                    }
                });

                const basicDataResults = await Promise.allSettled(basicDataPromises);
                const validTournaments = basicDataResults
                    .filter(result => result.status === 'fulfilled' && result.value !== null)
                    .map(result => (result as PromiseFulfilledResult<any>).value);

                console.log(`Successfully loaded ${validTournaments.length} tournaments out of ${tournamentIds.length} found`);
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
    }, [toast, loadBasicTournamentData]);



    // Auto-load details for completed tournaments missing result TX
    useEffect(() => {
        const autoLoadMissingResultTX = async () => {
            for (const tournament of tournaments) {
                if (tournament.status === 2 && !tournament.resultTxLoaded && !loadingDetails.has(tournament.id.toString())) {
                    console.log(`Auto-loading result TX for completed tournament ${tournament.id}`);
                    await loadTournamentDetails(tournament.id);
                }
            }
        };

        if (tournaments.length > 0) {
            autoLoadMissingResultTX();
        }
    }, [tournaments, loadTournamentDetails, loadingDetails]);

    const columns = useBreakpointValue({ base: 1, md: 2, lg: 3 });

    // Filter tournaments based on search term and status
    const filteredTournaments = useMemo(() => {
        return tournaments.filter(tournament => {
            const matchesSearch = tournament.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                tournament.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                tournament.creator.toLowerCase().includes(searchTerm.toLowerCase());

            const matchesStatus = statusFilter === 'all' ||
                (statusFilter === 'active' && tournament.status !== 2) ||
                (statusFilter === 'completed' && tournament.status === 2) ||
                tournament.status.toString() === statusFilter;

            return matchesSearch && matchesStatus;
        });
    }, [tournaments, searchTerm, statusFilter]);

    // Separate active and completed tournaments
    const activeTournaments = useMemo(() =>
        filteredTournaments
            .filter(t => t.status !== 2)
            .sort((a, b) => Number(b.id) - Number(a.id)), // Sort by ID descending (newest first)
        [filteredTournaments]
    );
    const completedTournaments = useMemo(() =>
        filteredTournaments
            .filter(t => t.status === 2)
            .sort((a, b) => Number(b.id) - Number(a.id)), // Sort by ID descending (newest first)
        [filteredTournaments]
    );

    // Pagination
    const totalPages = Math.ceil(activeTournaments.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const currentTournaments = activeTournaments.slice(startIndex, endIndex);

    if (loading) {
        return (
            <Box maxW="7xl" mx="auto" py={10} px={4}>
                <VStack spacing={8}>
                    <Heading size="xl">Tournaments</Heading>
                    <Progress size="lg" isIndeterminate w="full" />
                    <SimpleGrid columns={columns} spacing={8} w="full">
                        {[...Array(ITEMS_PER_PAGE)].map((_, i) => (
                            <Skeleton key={i} h="220px" borderRadius="xl" />
                        ))}
                    </SimpleGrid>
                </VStack>
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
            {/* Header */}
            <HStack justify="space-between" align="center" mb={8}>
                <Heading size="xl">Tournaments</Heading>
                <Button
                    leftIcon={<Trophy size={16} />}
                    colorScheme="blue"
                    variant="solid"
                    size="md"
                    borderRadius="xl"
                    onClick={onOpen}
                    _hover={{ transform: 'translateY(-2px)', boxShadow: 'lg' }}
                >
                    Completed ({completedTournaments.length})
                </Button>
            </HStack>

            {/* Search and Filters */}
            <VStack spacing={4} mb={8} align="stretch">
                <HStack justify="space-between">
                    <InputGroup maxW="400px">
                        <InputLeftElement pointerEvents="none">
                            <Search size={16} color="gray.400" />
                        </InputLeftElement>
                        <Input
                            placeholder="Search tournaments..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            bg={bgColor}
                            borderColor={borderColor}
                        />
                    </InputGroup>

                    <IconButton
                        aria-label="Toggle filters"
                        icon={showFilters ? <ChevronUp size={16} color="#3182CE" /> : <ChevronDown size={16} color="#3182CE" />}
                        onClick={() => setShowFilters(!showFilters)}
                        variant="ghost"
                        size="sm"
                        colorScheme="blue"
                        _hover={{ bg: 'blue.700', color: 'white' }}
                        _focus={{ bg: 'blue.700', color: 'white' }}
                    />
                </HStack>

                <Collapse in={showFilters}>
                    <HStack spacing={4}>
                        <Select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            bg={bgColor}
                            borderColor={borderColor}
                            maxW="200px"
                        >
                            <option value="all">All Status</option>
                            <option value="active">Active Only</option>
                            <option value="completed">Completed Only</option>
                            <option value="0">Joining</option>
                            <option value="1">ProcessingResults</option>
                            <option value="2">Completed</option>
                        </Select>
                    </HStack>
                </Collapse>
            </VStack>

            {/* Active Tournaments Section */}
            <VStack spacing={6} align="stretch">
                <HStack justify="space-between" align="center">
                    <HStack>
                        <Clock size={24} color="#3182CE" />
                        <Heading size="lg">Active Tournaments</Heading>
                        <Badge colorScheme="blue" fontSize="sm" px={2} py={1} borderRadius="md">
                            {activeTournaments.length}
                        </Badge>
                    </HStack>
                    <Button
                        leftIcon={<RefreshCw size={16} />}
                        onClick={() => {
                            tournamentCache.clear();
                            localStorage.removeItem(PERSISTENT_CACHE_KEY);
                            setTournaments([]);
                            setLoading(true);
                            // Trigger a fresh fetch
                            setTimeout(() => {
                                window.location.reload();
                            }, 100);
                        }}
                        size="sm"
                        colorScheme="blue"
                        variant="outline"
                        isLoading={loading}
                    >
                        Refresh
                    </Button>
                </HStack>

                {activeTournaments.length === 0 ? (
                    <VStack justify="center" align="center" h="48" spacing={4}>
                        <Clock size={24} color="#3182CE" />
                        <Text color="gray.400" textAlign="center">
                            No active tournaments found. Create one to get started!
                        </Text>
                    </VStack>
                ) : (
                    <>
                        <SimpleGrid columns={columns} spacing={8}>
                            {currentTournaments.map((tournament) => (
                                <TournamentCard
                                    key={tournament.id}
                                    tournament={tournament}
                                    onLoadDetails={loadTournamentDetails}
                                />
                            ))}
                        </SimpleGrid>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <Flex justify="center" mt={8}>
                                <HStack spacing={2}>
                                    <IconButton
                                        aria-label="Previous page"
                                        icon={<ChevronLeft size={16} />}
                                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                        isDisabled={currentPage === 1}
                                        variant="outline"
                                        size="sm"
                                        colorScheme="blue"
                                        color="blue.300"
                                        borderColor="blue.500"
                                        _hover={{ bg: 'blue.600', color: 'white' }}
                                        _disabled={{ color: 'gray.500', borderColor: 'gray.600' }}
                                    />

                                    {/* Generate page numbers with ellipsis */}
                                    {(() => {
                                        const pages = [];
                                        const maxVisible = 5;

                                        if (totalPages <= maxVisible) {
                                            // Show all pages if total is 5 or less
                                            for (let i = 1; i <= totalPages; i++) {
                                                pages.push(i);
                                            }
                                        } else {
                                            // Show current page and surrounding pages
                                            let start = Math.max(1, currentPage - 2);
                                            let end = Math.min(totalPages, start + maxVisible - 1);

                                            // Adjust start if we're near the end
                                            if (end - start < maxVisible - 1) {
                                                start = Math.max(1, end - maxVisible + 1);
                                            }

                                            // Add first page and ellipsis if needed
                                            if (start > 1) {
                                                pages.push(1);
                                                if (start > 2) {
                                                    pages.push('...');
                                                }
                                            }

                                            // Add visible pages
                                            for (let i = start; i <= end; i++) {
                                                pages.push(i);
                                            }

                                            // Add last page and ellipsis if needed
                                            if (end < totalPages) {
                                                if (end < totalPages - 1) {
                                                    pages.push('...');
                                                }
                                                pages.push(totalPages);
                                            }
                                        }

                                        return pages.map((page, index) => (
                                            page === '...' ? (
                                                <Text key={`ellipsis-${index}`} color="gray.400" px={2}>
                                                    ...
                                                </Text>
                                            ) : (
                                                <Button
                                                    key={page}
                                                    size="sm"
                                                    variant={currentPage === page ? "solid" : "outline"}
                                                    colorScheme="blue"
                                                    onClick={() => setCurrentPage(page as number)}
                                                >
                                                    {page}
                                                </Button>
                                            )
                                        ));
                                    })()}

                                    <IconButton
                                        aria-label="Next page"
                                        icon={<ChevronRight size={16} />}
                                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                        isDisabled={currentPage === totalPages}
                                        variant="outline"
                                        size="sm"
                                        colorScheme="blue"
                                        color="blue.300"
                                        borderColor="blue.500"
                                        _hover={{ bg: 'blue.600', color: 'white' }}
                                        _disabled={{ color: 'gray.500', borderColor: 'gray.600' }}
                                    />
                                </HStack>
                            </Flex>
                        )}
                    </>
                )}
            </VStack>

            {/* Completed Tournaments Modal */}
            <Modal isOpen={isOpen} onClose={onClose} size="6xl">
                <ModalOverlay />
                <ModalContent bg={bgColor} borderColor={borderColor}>
                    <ModalHeader>
                        <HStack>
                            <Trophy size={24} color="#718096" />
                            <Text>Completed Tournaments</Text>
                            <Badge colorScheme="gray" fontSize="sm" px={2} py={1} borderRadius="md">
                                {completedTournaments.length}
                            </Badge>
                        </HStack>
                    </ModalHeader>
                    <ModalCloseButton />
                    <ModalBody pb={6}>
                        {completedTournaments.length === 0 ? (
                            <VStack justify="center" align="center" h="48" spacing={4}>
                                <Trophy size={24} color="#718096" />
                                <Text color="gray.400" textAlign="center">
                                    No completed tournaments yet.
                                </Text>
                            </VStack>
                        ) : (
                            <SimpleGrid columns={columns} spacing={8}>
                                {completedTournaments.map((tournament) => (
                                    <TournamentCard
                                        key={tournament.id}
                                        tournament={tournament}
                                        onLoadDetails={loadTournamentDetails}
                                    />
                                ))}
                            </SimpleGrid>
                        )}
                    </ModalBody>
                </ModalContent>
            </Modal>
        </Box>
    );
};

export default Tournaments; 