import React, { useEffect, useState, useCallback, useMemo, useDeferredValue } from 'react';
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
import { getActiveTournamentIds, getTournamentDetailsFromContract, getGameConfig, getPrizePoolFromContract, getTournamentsFromBlockchain, findTournamentsByTesting, getSubmitResultsTransactionHash, debugContractResponse, clearApiCaches, getRecentNotifierEvents, getAnyJoinTs } from '../helpers';

// Using helper to clear caches instead of accessing internals

const statusColors: { [key: number]: string } = {
    0: 'yellow', // Joining
    1: 'blue',   // ReadyToStart
    2: 'green',  // Active
    3: 'orange', // ProcessingResults
    4: 'gray',   // Completed
};

const statusMap: { [key: number]: string } = {
    0: 'Joining',
    1: 'ReadyToStart',
    2: 'Active',
    3: 'ProcessingResults',
    4: 'Completed'
};

// Enhanced cache with TTL
const tournamentCache = new Map<string, { data: any; timestamp: number; ttl: number }>();
const ITEMS_PER_PAGE = 6;
const MAX_FETCH = 60; // cap initial tournaments loaded for performance
const CACHE_TTL = 60 * 1000; // 1 minute cache

// Request deduplication
const pendingRequests = new Map<string, Promise<any>>();

// Persistent cache with shorter TTL for better responsiveness
const PERSISTENT_CACHE_KEY = 'tournament_cache_v3';
const PERSISTENT_CACHE_TTL = 30 * 1000; // 30 seconds

function getPersistentCache() {
    try {
        const cached = localStorage.getItem(PERSISTENT_CACHE_KEY);
        if (cached) {
            const { data, timestamp } = JSON.parse(cached);
            if (Date.now() - timestamp < PERSISTENT_CACHE_TTL) {
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
        // Silent fail for cache errors
    }
    return {};
}

function setPersistentCache(data: any) {
    try {
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
        // Silent fail for cache errors
    }
}

// Enhanced deduplication with cache
function deduplicateRequest<T>(key: string, requestFn: () => Promise<T>): Promise<T> {
    // Check memory cache first
    const cached = tournamentCache.get(key);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
        return Promise.resolve(cached.data);
    }

    if (pendingRequests.has(key)) {
        return pendingRequests.get(key)!;
    }

    const promise = requestFn().then(result => {
        // Cache successful results
        tournamentCache.set(key, {
            data: result,
            timestamp: Date.now(),
            ttl: CACHE_TTL
        });
        return result;
    }).finally(() => {
        pendingRequests.delete(key);
    });

    pendingRequests.set(key, promise);
    return promise;
}

function toBigIntWei(value: unknown): bigint {
    try {
        if (typeof value === 'bigint') return value;
        if (typeof value === 'number') return BigInt(Math.trunc(value));
        if (typeof value === 'string') {
            if (value.startsWith('0x') || value.startsWith('0X')) return BigInt(value);
            return BigInt(value);
        }
    } catch { }
    return 0n;
}

function formatEgld(amountWeiInput: unknown, maxDecimals: number = 6) {
    const amountWei = toBigIntWei(amountWeiInput);
    const denom = 10n ** 18n;
    const integerPart = amountWei / denom;
    const remainder = amountWei % denom;
    if (remainder === 0n) {
        return integerPart.toString();
    }
    // Build fractional part with up to maxDecimals (truncate, do not round)
    const remainderStr = remainder.toString().padStart(18, '0');
    const frac = remainderStr.slice(0, Math.min(maxDecimals, 18));
    const trimmed = frac.replace(/0+$/g, '');
    return trimmed.length > 0 ? `${integerPart.toString()}.${trimmed}` : integerPart.toString();
}

function getGameName(gameId: number): string {
    const gameConfigs = {
        1: "Tic Tac Toe",
        2: "Chess",
        5: "CryptoBubbles",
        6: "DodgeDash"
    };

    return gameConfigs[gameId as keyof typeof gameConfigs] || `Game ID: ${gameId}`;
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
                    <Box w="32px" display="flex" justifyContent="center" alignItems="center" h="20px" />
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
                    <Box w="32px" display="flex" justifyContent="center" alignItems="center" h="20px" />
                </HStack>

                <HStack color="gray.400" fontSize="sm" justify="space-between" w="full" align="flex-start">
                    <HStack align="center" minW="0" flex="1">
                        <Box w="16px" />
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

                {tournament.status === 4 && tournament.final_podium?.length > 0 && (
                    <VStack color="gray.400" fontSize="sm" align="start" spacing={2}>
                        <HStack justify="space-between" w="full" align="flex-start">
                            <HStack align="center" minW="0" flex="1">
                                <Box w="16px" />
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
                                <Box w="16px" />
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

    // Optimized tournament data loading with better caching
    const loadBasicTournamentData = useCallback(async (id: bigint) => {
        const cacheKey = `basic_${id}`;

        // Check memory cache first
        const cached = tournamentCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < cached.ttl) {
            return cached.data;
        }

        // Check persistent cache
        const persistentCache = getPersistentCache();
        if (persistentCache[cacheKey]) {
            const cachedData = persistentCache[cacheKey];
            tournamentCache.set(cacheKey, {
                data: cachedData,
                timestamp: Date.now(),
                ttl: CACHE_TTL
            });
            return cachedData;
        }

        return deduplicateRequest(cacheKey, async () => {
            try {
                console.log(`loadBasicTournamentData: Fetching details for tournament ${id}...`);
                const details = await getTournamentDetailsFromContract(id);
                console.log(`loadBasicTournamentData: Details for tournament ${id}:`, details);

                if (details) {
                    const participantsCount = (details.participants || []).length;
                    const computedPrizePool = (details.entry_fee ?? 0n) * BigInt(participantsCount);
                    const basicData = {
                        id,
                        name: details.name || `Tournament #${id}`,
                        status: details.status,
                        participants: details.participants || [],
                        description: getGameName(Number(details.game_id)),
                        creator: details.creator,
                        final_podium: details.final_podium || [],
                        game_id: details.game_id,
                        prizePool: computedPrizePool,
                        prizePoolLoaded: true,
                        gameConfig: null,
                        gameConfigLoaded: false,
                        resultTxHash: null,
                        resultTxLoaded: details.status !== 2,
                        loadingDetails: false
                    };

                    console.log(`loadBasicTournamentData: Created basic data for tournament ${id}:`, basicData);

                    // Update persistent cache
                    const updatedPersistentCache = getPersistentCache();
                    updatedPersistentCache[cacheKey] = basicData;
                    setPersistentCache(updatedPersistentCache);

                    return basicData;
                } else {
                    console.log(`loadBasicTournamentData: No details returned for tournament ${id}`);
                }
            } catch (err) {
                console.error(`loadBasicTournamentData: Error loading tournament ${id}:`, err);
            }
            return null;
        });
    }, []);

    // Optimized details loading
    const loadTournamentDetails = useCallback(async (id: bigint) => {
        const cacheKey = `basic_${id}`;
        const tournament = tournamentCache.get(cacheKey)?.data;
        if (!tournament || loadingDetails.has(id.toString())) {
            return;
        }

        setLoadingDetails(prev => new Set(prev).add(id.toString()));

        try {
            const promises = [];

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

            if (!tournament.prizePoolLoaded) {
                promises.push(
                    getPrizePoolFromContract(id).then(prizePool => {
                        tournament.prizePool = prizePool;
                        tournament.prizePoolLoaded = true;
                    }).catch(() => {
                        tournament.prizePool = null;
                        tournament.prizePoolLoaded = true;
                    })
                );
            }

            if (!tournament.resultTxLoaded && tournament.status === 2) {
                promises.push(
                    getSubmitResultsTransactionHash(id).then(resultTxHash => {
                        tournament.resultTxHash = resultTxHash;
                        tournament.resultTxLoaded = true;
                    }).catch(() => {
                        tournament.resultTxHash = null;
                        tournament.resultTxLoaded = true;
                    })
                );
            }

            await Promise.all(promises);
            tournamentCache.set(cacheKey, {
                data: tournament,
                timestamp: Date.now(),
                ttl: CACHE_TTL
            });

            setTournaments(prev => prev.map(t => t.id === id ? tournament : t));
        } catch (err) {
            // Silent error handling
        } finally {
            setLoadingDetails(prev => {
                const newSet = new Set(prev);
                newSet.delete(id.toString());
                return newSet;
            });
        }
    }, [loadingDetails]);

    // Optimized initial load
    useEffect(() => {
        const fetchTournaments = async () => {
            setLoading(true);
            setError(null);
            try {
                // Begin tournament discovery

                let tournamentIds = await getActiveTournamentIds();
                // Try direct contract query first

                let eventTournaments: any[] = []; // Declare eventTournaments in the proper scope

                if (tournamentIds.length === 0) {
                    eventTournaments = await getTournamentsFromBlockchain();

                    tournamentIds = eventTournaments
                        .filter((t): t is NonNullable<typeof t> => t !== null)
                        .map(t => BigInt(t.id || 0))
                        .filter(id => id > 0n)
                        .slice(0, 50);
                    // fall through
                }

                if (tournamentIds.length === 0) {
                    tournamentIds = await findTournamentsByTesting();
                }

                if (tournamentIds.length === 0) {
                    setTournaments([]);
                    setLoading(false);
                    return;
                }

                // Sort newest first and cap how many we fetch initially
                const sortedIds = [...tournamentIds].sort((a, b) => Number(b) - Number(a));
                const limitedIds = sortedIds.slice(0, MAX_FETCH);

                // Load basic data in small batches to avoid network/CPU spikes
                const batchSize = 8;
                const basicResults: any[] = [];
                for (let i = 0; i < limitedIds.length; i += batchSize) {
                    const batch = limitedIds.slice(i, i + batchSize);
                    const batchResults = await Promise.allSettled(batch.map(async (id) => {
                        try {
                            return await loadBasicTournamentData(id);
                        } catch (err) {
                            console.error(`Failed to load tournament ${id}:`, err);
                            return null;
                        }
                    }));
                    basicResults.push(...batchResults);
                }

                const validTournaments = basicResults
                    .filter(result => result.status === 'fulfilled' && result.value !== null)
                    .map(result => (result as PromiseFulfilledResult<any>).value);

                setTournaments(validTournaments);
            } catch (err) {
                console.error('Error fetching tournaments:', err);
                setError('Failed to fetch tournaments');
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

    // Auto-load details for completed tournaments
    useEffect(() => {
        const autoLoadMissingResultTX = async () => {
            for (const tournament of tournaments) {
                if (tournament.status === 4 && !tournament.resultTxLoaded && !loadingDetails.has(tournament.id.toString())) {
                    await loadTournamentDetails(tournament.id);
                }
            }
        };

        if (tournaments.length > 0) {
            autoLoadMissingResultTX();
        }
    }, [tournaments, loadTournamentDetails, loadingDetails]);

    // Poll Notifier events and auto-add tournaments upon tournamentCreated
    useEffect(() => {
        let mounted = true;
        let lastSeenTs = 0;
        let lastJoinTs = 0;
        const interval = setInterval(async () => {
            try {
                // quick refresh on any join (players list often updated)
                const anyJoinTs = await getAnyJoinTs();
                if (anyJoinTs > lastJoinTs) {
                    lastJoinTs = anyJoinTs;
                    // light refresh: refetch visible tournaments' basic data
                    setTournaments(prev => [...prev]);
                }
                const events = await getRecentNotifierEvents();
                if (!mounted || events.length === 0) return;
                // Process only new events
                const newEvents = events.filter(e => e.ts > lastSeenTs);
                if (newEvents.length === 0) return;
                lastSeenTs = Math.max(lastSeenTs, ...newEvents.map(e => e.ts));
                // For tournamentCreated, fetch details and add to list if not present
                const created = newEvents.filter(e => e.identifier === 'tournamentCreated');
                if (created.length === 0) return;
                const uniqueIds = Array.from(new Set(created.map(e => BigInt(e.tournament_id))));
                for (const id of uniqueIds) {
                    // Skip if already present
                    if (tournaments.some(t => BigInt(t.id) === id)) continue;
                    const basic = await loadBasicTournamentData(id);
                    if (basic) {
                        setTournaments(prev => [basic, ...prev].sort((a, b) => Number(b.id) - Number(a.id)));
                    }
                }
            } catch {
                // ignore polling errors
            }
        }, 3000);
        return () => {
            mounted = false;
            clearInterval(interval);
        };
    }, [tournaments, loadBasicTournamentData]);

    const columns = useBreakpointValue({ base: 1, md: 2, lg: 3 });

    // Optimized filtering with deferred search value
    const deferredSearch = useDeferredValue(searchTerm);
    const filteredTournaments = useMemo(() => {
        return tournaments.filter(tournament => {
            const query = deferredSearch.toLowerCase();
            const matchesSearch = tournament.name.toLowerCase().includes(query) ||
                tournament.description.toLowerCase().includes(query) ||
                tournament.creator.toLowerCase().includes(query);

            const matchesStatus = statusFilter === 'all' ||
                (statusFilter === 'active' && tournament.status !== 4) ||
                (statusFilter === 'completed' && tournament.status === 4) ||
                tournament.status.toString() === statusFilter;

            return matchesSearch && matchesStatus;
        });
    }, [tournaments, deferredSearch, statusFilter]);

    // Optimized sorting
    const activeTournaments = useMemo(() =>
        filteredTournaments
            .filter(t => t.status !== 4) // Not completed (status 4)
            .sort((a, b) => Number(b.id) - Number(a.id)),
        [filteredTournaments]
    );
    const completedTournaments = useMemo(() =>
        filteredTournaments
            .filter(t => t.status === 4) // Completed (status 4)
            .sort((a, b) => Number(b.id) - Number(a.id)),
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
                            <option value="1">ReadyToStart</option>
                            <option value="2">Active</option>
                            <option value="3">ProcessingResults</option>
                            <option value="4">Completed</option>
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
                    <HStack spacing={2}>
                        <Button
                            leftIcon={<RefreshCw size={16} />}
                            onClick={() => {
                                tournamentCache.clear();
                                localStorage.removeItem(PERSISTENT_CACHE_KEY);
                                // Clear API cache by reloading the page
                                setTournaments([]);
                                setLoading(true);
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
                        <Button
                            onClick={async () => {
                                console.log('Debugging contract...');
                                const debug = await debugContractResponse();
                                console.log('Contract debug:', debug);
                                toast({
                                    title: 'Debug Info',
                                    description: `Contract: ${debug.contractInfo ? 'Found' : 'Not found'}, Games: ${debug.gamesResponse?.data?.value || 'Error'}, Tournaments: ${debug.functionResponse?.data?.value || 'Error'}`,
                                    status: 'info',
                                    duration: 10000,
                                    isClosable: true,
                                });
                            }}
                            size="sm"
                            colorScheme="yellow"
                            variant="outline"
                        >
                            Debug
                        </Button>
                        <Button
                            onClick={() => {
                                tournamentCache.clear();
                                localStorage.removeItem(PERSISTENT_CACHE_KEY);
                                clearApiCaches();
                                pendingRequests.clear();
                                toast({
                                    title: 'Cache Cleared',
                                    description: 'All caches have been cleared',
                                    status: 'success',
                                    duration: 3000,
                                    isClosable: true,
                                });
                            }}
                            size="sm"
                            colorScheme="red"
                            variant="outline"
                        >
                            Clear Cache
                        </Button>
                        <Button
                            onClick={() => window.location.href = '/tournaments/create'}
                            size="sm"
                            colorScheme="green"
                            variant="solid"
                        >
                            Create Tournament
                        </Button>
                    </HStack>
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

                                    {(() => {
                                        const pages = [];
                                        const maxVisible = 5;

                                        if (totalPages <= maxVisible) {
                                            for (let i = 1; i <= totalPages; i++) {
                                                pages.push(i);
                                            }
                                        } else {
                                            let start = Math.max(1, currentPage - 2);
                                            let end = Math.min(totalPages, start + maxVisible - 1);

                                            if (end - start < maxVisible - 1) {
                                                start = Math.max(1, end - maxVisible + 1);
                                            }

                                            if (start > 1) {
                                                pages.push(1);
                                                if (start > 2) {
                                                    pages.push('...');
                                                }
                                            }

                                            for (let i = start; i <= end; i++) {
                                                pages.push(i);
                                            }

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