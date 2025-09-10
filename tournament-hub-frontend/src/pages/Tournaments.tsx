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
import { getActiveTournamentIds, getTournamentDetailsFromContract, getGameConfig, getPrizePoolFromContract, getTournamentsFromBlockchain, findTournamentsByTesting, getSubmitResultsTransactionHash, debugContractResponse, clearApiCaches, getRecentNotifierEvents, getAnyJoinTs, isTournamentCompletedByEvents, parseTournamentHex } from '../helpers';
import { getContractAddress, getNetwork } from '../config/contract';

// Using helper to clear caches instead of accessing internals

// Helper function to get the correct API URL based on network
function getApiUrl(): string {
    const network = getNetwork();
    switch (network) {
        case 'devnet':
            return 'https://devnet-gateway.multiversx.com';
        case 'testnet':
            return 'https://testnet-api.multiversx.com';
        case 'mainnet':
            return 'https://api.multiversx.com';
        default:
            return 'https://devnet-gateway.multiversx.com';
    }
}

const statusColors: { [key: number]: string } = {
    0: 'yellow', // Joining
    1: 'blue',   // Ready to Start
    2: 'green',  // Active/Playing
    3: 'orange', // Processing Results
    4: 'purple', // Completed
};

const statusMap: { [key: number]: string } = {
    0: 'Joining',
    1: 'Ready to Start',
    2: 'Playing',
    3: 'Processing Results',
    4: 'Completed'
};

// Enhanced cache with TTL
const tournamentCache = new Map<string, { data: any; timestamp: number; ttl: number }>();
const ITEMS_PER_PAGE = 6;
const MAX_FETCH = 50; // Reduced from 200 to reduce API load and rate limiting
const MAX_CONCURRENT_QUERIES = 3; // Limit concurrent contract queries to prevent rate limiting
const CACHE_TTL = 300 * 1000; // 5 minutes cache

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

// Helper function to deduplicate tournaments by ID
function deduplicateTournaments(tournaments: any[]): any[] {
    const seen = new Set<string>();
    return tournaments.filter(tournament => {
        const id = tournament.id.toString();
        if (seen.has(id)) {
            console.warn(`Removing duplicate tournament with ID: ${id}`);
            return false;
        }
        seen.add(id);
        return true;
    });
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
const TournamentCard = React.memo(({ tournament, onLoadDetails, onRetryTournament }: { tournament: any; onLoadDetails: (id: bigint) => void; onRetryTournament?: (id: bigint) => void }) => {
    const toast = useToast();
    const bgColor = useColorModeValue('gray.800', 'gray.900');
    const borderColor = useColorModeValue('gray.700', 'gray.600');

    return (
        <Box
            bgGradient="linear(135deg, gray.800, gray.900)"
            border="2px solid"
            borderColor="gray.600"
            boxShadow="0 20px 40px rgba(0,0,0,0.3)"
            borderRadius="2xl"
            p={6}
            transition="all 0.3s ease"
            _hover={{
                borderColor: "blue.400",
                boxShadow: "0 25px 50px rgba(59, 130, 246, 0.2)",
                transform: 'translateY(-5px)'
            }}
            display="flex"
            flexDirection="column"
            justifyContent="space-between"
            position="relative"
            overflow="hidden"
        >
            {/* Animated Background */}
            <Box
                position="absolute"
                top={0}
                left={0}
                right={0}
                h="4px"
                bgGradient="linear(90deg, blue.500, purple.500, pink.500, blue.500)"
                backgroundSize="200% 100%"
                animation="gradient 3s ease infinite"
                sx={{
                    '@keyframes gradient': {
                        '0%': { backgroundPosition: '0% 50%' },
                        '50%': { backgroundPosition: '100% 50%' },
                        '100%': { backgroundPosition: '0% 50%' }
                    }
                }}
            />
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
                            Prize Pool: {tournament.prizePool !== null && tournament.prizePool !== undefined ?
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
                        <Text>Creator: {tournament.creator && tournament.creator !== 'Unknown' && tournament.creator !== 'Loading...' ?
                            `${tournament.creator.slice(0, 8)}...${tournament.creator.slice(-6)}` :
                            tournament.creator || 'N/A'
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
                    <HStack spacing={2} w="full">
                        <Button
                            size="md"
                            variant="outline"
                            colorScheme="blue"
                            borderRadius="xl"
                            border="2px solid"
                            borderColor="blue.500"
                            color="blue.300"
                            fontWeight="semibold"
                            onClick={() => onLoadDetails(tournament.id)}
                            isLoading={tournament.loadingDetails}
                            _hover={{
                                bg: "blue.600",
                                color: "white",
                                transform: "translateY(-2px)",
                                boxShadow: "0 8px 20px rgba(59, 130, 246, 0.3)"
                            }}
                            transition="all 0.2s ease"
                            flex="1"
                        >
                            Load Details
                        </Button>
                        {tournament.isFallback && tournament.status === 4 && onRetryTournament && (
                            <Button
                                size="md"
                                variant="outline"
                                colorScheme="orange"
                                borderRadius="xl"
                                border="2px solid"
                                borderColor="orange.500"
                                color="orange.300"
                                fontWeight="semibold"
                                onClick={() => onRetryTournament(tournament.id)}
                                _hover={{
                                    bg: "orange.600",
                                    color: "white",
                                    transform: "translateY(-2px)",
                                    boxShadow: "0 8px 20px rgba(255, 165, 0, 0.3)"
                                }}
                                transition="all 0.2s ease"
                            >
                                Retry
                            </Button>
                        )}
                    </HStack>
                )}
            </VStack>

            <Button
                as="a"
                href={`/tournaments/${tournament.id}`}
                size="md"
                w="full"
                mt={2}
                borderRadius="xl"
                fontWeight="bold"
                fontSize="md"
                bgGradient="linear(135deg, blue.500, purple.600, blue.700)"
                color="white"
                boxShadow="0 10px 30px rgba(59, 130, 246, 0.4)"
                _hover={{
                    bgGradient: "linear(135deg, blue.600, purple.700, blue.800)",
                    transform: 'translateY(-3px)',
                    boxShadow: '0 15px 40px rgba(59, 130, 246, 0.6)'
                }}
                _active={{
                    transform: 'translateY(-1px)',
                    boxShadow: '0 8px 25px rgba(59, 130, 246, 0.5)'
                }}
                transition="all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
                position="relative"
                overflow="hidden"
            >
                {/* Animated background effect */}
                <Box
                    position="absolute"
                    top={0}
                    left="-100%"
                    w="100%"
                    h="100%"
                    bgGradient="linear(90deg, transparent, rgba(255,255,255,0.2), transparent)"
                    transition="left 0.5s ease"
                    _groupHover={{
                        left: "100%"
                    }}
                />
                <HStack spacing={2} justify="center">
                    <Box
                        p={1}
                        bg="rgba(255,255,255,0.2)"
                        borderRadius="md"
                    >
                        <Trophy size={16} />
                    </Box>
                    <Text>View Details</Text>
                </HStack>
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
    const [refreshing, setRefreshing] = useState(false);
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
            const maxRetries = 3;
            let lastError: any = null;

            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                    console.log(`loadBasicTournamentData: Fetching details for tournament ${id} (attempt ${attempt}/${maxRetries})...`);

                    // Add extra delay for completed tournaments to avoid rate limiting
                    if (attempt > 1) {
                        const delay = attempt * 2000; // 2s, 4s, 6s
                        console.log(`loadBasicTournamentData: Waiting ${delay}ms before retry for tournament ${id}...`);
                        await new Promise(resolve => setTimeout(resolve, delay));
                    }

                    // Use getTournament endpoint (getTournamentBasicInfo doesn't exist in deployed contract)
                    console.log(`loadBasicTournamentData: Fetching tournament ${id} using getTournament...`);
                    const details = await getTournamentDetailsFromContract(id);
                    console.log(`loadBasicTournamentData: Details for tournament ${id}:`, details);

                    if (details) {
                        const participantsCount = (details.participants || []).length;
                        const computedPrizePool = BigInt(details.entry_fee ?? 0) * BigInt(participantsCount);
                        const basicData = {
                            id,
                            name: details.name || `Tournament #${id}`,
                            status: details.status,
                            participants: details.participants || [],
                            description: getGameName(Number(details.game_id)),
                            creator: details.creator || 'Unknown',
                            final_podium: details.final_podium || [],
                            game_id: details.game_id,
                            prizePool: computedPrizePool,
                            prizePoolLoaded: true,
                            gameConfig: null,
                            gameConfigLoaded: false,
                            resultTxHash: null,
                            resultTxLoaded: details.status !== 4,
                            loadingDetails: false
                        };

                        console.log(`loadBasicTournamentData: Created basic data for tournament ${id}:`, basicData);

                        // Update persistent cache
                        const updatedPersistentCache = getPersistentCache();
                        updatedPersistentCache[cacheKey] = basicData;
                        setPersistentCache(updatedPersistentCache);

                        return basicData;
                    } else {
                        console.log(`loadBasicTournamentData: No details returned for tournament ${id}, creating fallback data`);

                        // Try to get just the status from the contract before creating fallback data
                        let actualStatus = 0; // Default to Joining status
                        try {
                            const statusResponse = await fetch(`${getApiUrl()}/vm-values/query`, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({
                                    scAddress: getContractAddress(),
                                    funcName: 'getTournament',
                                    args: [Number(id).toString(16).padStart(16, '0')],
                                    caller: getContractAddress(),
                                    gasLimit: 50000000
                                })
                            });

                            if (statusResponse.ok) {
                                const statusData = await statusResponse.json();
                                if (statusData && statusData.data && statusData.data.data && statusData.data.data.returnData && statusData.data.data.returnData.length > 0) {
                                    const tournamentHex = statusData.data.data.returnData[0];
                                    const tournament = await parseTournamentHex(tournamentHex, id);
                                    if (tournament) {
                                        actualStatus = tournament.status;
                                        console.log(`loadBasicTournamentData: Got actual status ${actualStatus} for tournament ${id}`);
                                    }
                                }
                            }
                        } catch (statusError) {
                            console.log(`loadBasicTournamentData: Could not get status for tournament ${id}, using default:`, statusError);
                        }

                        // Create fallback data for tournaments that fail to load details
                        const fallbackData = {
                            id,
                            name: `Tournament ${id}`,
                            status: actualStatus, // Use actual status if we could get it
                            participants: [],
                            description: `Tournament #${id}`,
                            creator: 'Unknown',
                            final_podium: [],
                            game_id: 0n,
                            prizePool: 0n,
                            prizePoolLoaded: true,
                            gameConfig: null,
                            gameConfigLoaded: false,
                            resultTxHash: null,
                            resultTxLoaded: true,
                            loadingDetails: false,
                            isFallback: true // Mark as fallback data
                        };

                        console.log(`loadBasicTournamentData: Created fallback data for tournament ${id}:`, fallbackData);

                        // Update persistent cache
                        const updatedPersistentCache = getPersistentCache();
                        updatedPersistentCache[cacheKey] = fallbackData;
                        setPersistentCache(updatedPersistentCache);

                        return fallbackData;
                    }
                } catch (err) {
                    lastError = err;
                    console.error(`loadBasicTournamentData: Error loading tournament ${id} (attempt ${attempt}):`, err);

                    // If this is not the last attempt, wait before retrying
                    if (attempt < maxRetries) {
                        const delay = attempt * 2000; // Exponential backoff: 2s, 4s, 6s
                        console.log(`loadBasicTournamentData: Retrying tournament ${id} in ${delay}ms...`);
                        await new Promise(resolve => setTimeout(resolve, delay));
                    }
                }
            }

            // If all retries failed, create fallback data instead of returning null
            console.error(`loadBasicTournamentData: Failed to fetch tournament ${id} after ${maxRetries} attempts, creating fallback data:`, lastError);

            // Try to get just the status from the contract before creating fallback data
            let actualStatus = 0; // Default to Joining status
            try {
                const statusResponse = await fetch(`${getApiUrl()}/vm-values/query`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        scAddress: getContractAddress(),
                        funcName: 'getTournament',
                        args: [Number(id).toString(16).padStart(16, '0')],
                        caller: getContractAddress(),
                        gasLimit: 50000000
                    })
                });

                if (statusResponse.ok) {
                    const statusData = await statusResponse.json();
                    if (statusData && statusData.data && statusData.data.data && statusData.data.data.returnData && statusData.data.data.returnData.length > 0) {
                        const tournamentHex = statusData.data.data.returnData[0];
                        const tournament = await parseTournamentHex(tournamentHex, id);
                        if (tournament) {
                            actualStatus = tournament.status;
                            console.log(`loadBasicTournamentData: Got actual status ${actualStatus} for tournament ${id} after retry failure`);
                        }
                    }
                }
            } catch (statusError) {
                console.log(`loadBasicTournamentData: Could not get status for tournament ${id} after retry failure, using default:`, statusError);
            }

            const fallbackData = {
                id,
                name: `Tournament ${id}`,
                status: actualStatus, // Use actual status if we could get it
                participants: [],
                description: `Tournament #${id}`,
                creator: 'Unknown',
                final_podium: [],
                game_id: 0n,
                prizePool: 0n,
                prizePoolLoaded: true,
                gameConfig: null,
                gameConfigLoaded: false,
                resultTxHash: null,
                resultTxLoaded: true,
                loadingDetails: false,
                isFallback: true // Mark as fallback data
            };

            console.log(`loadBasicTournamentData: Created fallback data for tournament ${id} after retry failure:`, fallbackData);
            return fallbackData;
        });
    }, []);

    // Retry function for completed tournaments with fallback data
    const retryTournament = useCallback(async (id: bigint) => {
        console.log(`Manual retry for tournament ${id}`);
        try {
            // Clear cache for this tournament to force fresh data
            const cacheKey = `basic_${id}`;
            tournamentCache.delete(cacheKey);

            const realData = await loadBasicTournamentData(id);
            if (realData && !realData.isFallback) {
                console.log(`Successfully loaded real data for tournament ${id}:`, realData);
                setTournaments(prev => {
                    return prev.map(t => t.id === id ? realData : t);
                });
                toast({
                    title: 'Success!',
                    description: `Tournament ${id} details loaded successfully`,
                    status: 'success',
                    duration: 3000,
                    isClosable: true,
                });
            } else {
                console.log(`Still getting fallback data for tournament ${id}`);
                toast({
                    title: 'Still Loading',
                    description: `Tournament ${id} details are still being loaded. Please try again later.`,
                    status: 'warning',
                    duration: 3000,
                    isClosable: true,
                });
            }
        } catch (error) {
            console.error(`Manual retry failed for tournament ${id}:`, error);
            toast({
                title: 'Retry Failed',
                description: `Failed to load tournament ${id} details. Please try again later.`,
                status: 'error',
                duration: 3000,
                isClosable: true,
            });
        }
    }, [loadBasicTournamentData, toast]);

    // Function to clear all caches and force refresh
    const clearAllCachesAndRefresh = useCallback(async () => {
        console.log('Clearing all caches and forcing refresh...');

        // Clear all caches
        tournamentCache.clear();
        clearApiCaches();

        // Force refresh by reloading the page
        window.location.reload();
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

            if (!tournament.resultTxLoaded && tournament.status === 4) {
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

    // Refresh function
    const refreshTournaments = useCallback(async () => {
        setRefreshing(true);
        try {
            // Clear caches
            clearApiCaches();
            tournamentCache.clear();
            localStorage.removeItem(PERSISTENT_CACHE_KEY);

            // Reload tournaments
            setTournaments([]);
            setLoading(true);

            // Trigger a re-fetch by updating the lastRefresh timestamp
            setLastRefresh(Date.now());

            toast({
                title: 'Refreshing tournaments...',
                status: 'info',
                duration: 2000,
                isClosable: true,
            });
        } catch (error) {
            console.error('Error refreshing tournaments:', error);
            toast({
                title: 'Error refreshing tournaments',
                status: 'error',
                duration: 3000,
                isClosable: true,
            });
        } finally {
            setRefreshing(false);
        }
    }, [toast]);

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

                if (!tournamentIds || tournamentIds.length === 0) {
                    eventTournaments = await getTournamentsFromBlockchain();

                    tournamentIds = (eventTournaments || [])
                        .filter((t): t is NonNullable<typeof t> => t !== null)
                        .map(t => BigInt(t.id || 0))
                        .filter(id => id > 0n)
                        .slice(0, 200);
                    // fall through
                }

                if (!tournamentIds || tournamentIds.length === 0) {
                    tournamentIds = await findTournamentsByTesting();
                }

                if (!tournamentIds || tournamentIds.length === 0) {
                    setTournaments([]);
                    setLoading(false);
                    return;
                }

                // Sort newest first and cap how many we fetch initially
                const sortedIds = [...(tournamentIds || [])].sort((a, b) => Number(b) - Number(a));
                const limitedIds = sortedIds.slice(0, MAX_FETCH);

                // Load tournaments with aggressive parallel processing and smart caching
                const maxInitialLoad = 100; // Load more tournaments
                const limitedIdsForLoad = limitedIds.slice(0, maxInitialLoad);

                console.log(`Loading ${limitedIdsForLoad.length} tournaments with parallel processing...`);

                // Process all tournaments in parallel with Promise.allSettled
                // This will be much faster than sequential processing
                const allResults = await Promise.allSettled(
                    limitedIdsForLoad.map(async (id) => {
                        try {
                            return await loadBasicTournamentData(id);
                        } catch (err) {
                            console.error(`Failed to load tournament ${id}:`, err);
                            return null;
                        }
                    })
                );

                const basicResults = allResults;

                const validTournaments = basicResults
                    .filter(result => result.status === 'fulfilled' && result.value !== null)
                    .map(result => (result as PromiseFulfilledResult<any>).value);

                console.log(`Successfully loaded ${validTournaments.length} tournaments (including ${validTournaments.filter(t => t.isFallback).length} fallback tournaments)`);

                // Debug: Log all tournament IDs to check for duplicates
                const tournamentIdStrings = validTournaments.map(t => t.id.toString());
                const uniqueIds = [...new Set(tournamentIdStrings)];
                if (tournamentIdStrings.length !== uniqueIds.length) {
                    console.warn(`Duplicate tournament IDs detected in initial load:`, tournamentIdStrings);
                }

                // Deduplicate tournaments before setting state (include ALL tournaments, not just real ones)
                const deduplicatedTournaments = deduplicateTournaments(validTournaments);
                if (deduplicatedTournaments.length !== validTournaments.length) {
                    console.log(`Removed ${validTournaments.length - deduplicatedTournaments.length} duplicate tournaments`);
                }

                console.log(`Setting tournaments state with ${deduplicatedTournaments.length} tournaments (including ${deduplicatedTournaments.filter(t => t.isFallback).length} fallback tournaments)`);
                setTournaments(deduplicatedTournaments);

                // Try to load real data for fallback tournaments in the background
                const fallbackTournaments = validTournaments.filter(t => t.isFallback);
                if (fallbackTournaments.length > 0) {
                    console.log(`Attempting to load real data for ${fallbackTournaments.length} fallback tournaments...`);

                    // Prioritize completed tournaments (status 4) for loading
                    const completedFallbacks = fallbackTournaments.filter(t => t.status === 4);
                    const otherFallbacks = fallbackTournaments.filter(t => t.status !== 4);

                    console.log(`Found ${completedFallbacks.length} completed fallback tournaments and ${otherFallbacks.length} other fallback tournaments`);

                    // Removed background retry logic to prevent rate limiting
                    console.log(`Skipping background retry for ${completedFallbacks.length} completed and ${otherFallbacks.length} other fallback tournaments to prevent rate limiting`);
                }
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

    // Special retry mechanism for completed tournaments with fallback data
    useEffect(() => {
        const retryCompletedTournaments = async () => {
            const completedFallbacks = tournaments.filter(t => t.status === 4 && t.isFallback);
            if (completedFallbacks.length === 0) return;

            console.log(`Retrying ${completedFallbacks.length} completed tournaments with fallback data...`);

            for (const tournament of completedFallbacks) {
                try {
                    // Add a small delay to avoid rate limiting
                    await new Promise(resolve => setTimeout(resolve, 1000));

                    console.log(`Retrying completed tournament ${tournament.id} with enhanced retry...`);

                    // Clear cache for this tournament to force fresh data
                    const cacheKey = `basic_${tournament.id}`;
                    tournamentCache.delete(cacheKey);

                    const realData = await loadBasicTournamentData(tournament.id);

                    if (realData && !realData.isFallback) {
                        console.log(`Successfully loaded real data for completed tournament ${tournament.id}:`, realData);
                        setTournaments(prev => {
                            return prev.map(t => t.id === tournament.id ? realData : t);
                        });
                    } else {
                        console.log(`Still getting fallback data for completed tournament ${tournament.id}, will retry later`);
                    }
                } catch (error) {
                    console.log(`Enhanced retry failed for completed tournament ${tournament.id}:`, error);
                }
            }
        };

        // Retry completed tournaments after a delay
        const timeoutId = setTimeout(retryCompletedTournaments, 5000);
        return () => clearTimeout(timeoutId);
    }, [tournaments, loadBasicTournamentData]);

    // Poll Notifier events and auto-add tournaments upon tournamentCreated
    useEffect(() => {
        let mounted = true;
        let lastSeenTs = 0;
        let lastJoinTs = 0;
        let consecutiveErrors = 0;
        let pollInterval = 3000; // Start with 3 seconds

        const pollNotifier = async () => {
            try {
                // quick refresh on any join (players list often updated)
                const anyJoinTs = await getAnyJoinTs();
                if (anyJoinTs > lastJoinTs) {
                    lastJoinTs = anyJoinTs;
                    // light refresh: refetch visible tournaments' basic data
                    setTournaments(prev => [...prev]);
                }
                const events = await getRecentNotifierEvents();
                if (!mounted || events.length === 0) {
                    // Reset error count on successful API call
                    consecutiveErrors = 0;
                    pollInterval = 3000;
                    return;
                }
                // Process only new events
                const newEvents = events.filter(e => e.ts > lastSeenTs);
                if (newEvents.length === 0) {
                    // Reset error count on successful API call
                    consecutiveErrors = 0;
                    pollInterval = 3000;
                    return;
                }
                lastSeenTs = Math.max(lastSeenTs, ...newEvents.map(e => e.ts));
                // For tournamentCreated, fetch details and add to list if not present
                const created = newEvents.filter(e => e.identifier === 'tournamentCreated');
                if (created.length === 0) {
                    // Reset error count on successful API call
                    consecutiveErrors = 0;
                    pollInterval = 3000;
                    return;
                }
                const uniqueIds = Array.from(new Set(created.map(e => BigInt(e.tournament_id))));
                for (const id of uniqueIds) {
                    // Skip if already present - use more robust comparison
                    if (tournaments.some(t => BigInt(t.id) === id)) {
                        console.log(`Tournament ${id} already exists, skipping...`);
                        continue;
                    }
                    console.log(`Adding new tournament ${id} from polling...`);
                    const basic = await loadBasicTournamentData(id);
                    if (basic && !basic.isFallback) {
                        setTournaments(prev => {
                            // Double-check for duplicates before adding
                            if (prev.some(t => BigInt(t.id) === id)) {
                                console.log(`Tournament ${id} was added by another process, skipping...`);
                                return prev;
                            }
                            console.log(`Successfully adding tournament ${id} to list`);
                            const newTournaments = [basic, ...prev].sort((a, b) => Number(b.id) - Number(a.id));
                            // Deduplicate the entire list to be safe
                            return deduplicateTournaments(newTournaments);
                        });
                    } else if (basic && basic.isFallback) {
                        console.log(`Skipping fallback tournament ${id} from polling`);
                    }
                }
                // Reset error count on successful API call
                consecutiveErrors = 0;
                pollInterval = 3000;
            } catch (error) {
                consecutiveErrors++;
                console.warn(`Polling error ${consecutiveErrors}:`, error);

                // Increase polling interval on consecutive errors to reduce server load
                if (consecutiveErrors >= 3) {
                    pollInterval = Math.min(pollInterval * 1.5, 30000); // Max 30 seconds
                    console.log(`Increased polling interval to ${pollInterval}ms due to errors`);
                }
            }
        };

        let interval: NodeJS.Timeout;

        const scheduleNextPoll = () => {
            if (mounted) {
                interval = setTimeout(() => {
                    pollNotifier().then(() => {
                        scheduleNextPoll();
                    });
                }, pollInterval);
            }
        };

        // Start the first poll
        scheduleNextPoll();

        return () => {
            mounted = false;
            if (interval) {
                clearTimeout(interval);
            }
        };
    }, [tournaments, loadBasicTournamentData]);

    const columns = useBreakpointValue({ base: 1, md: 2, lg: 3 });

    // Optimized filtering with deferred search value
    const deferredSearch = useDeferredValue(searchTerm);
    const filteredTournaments = useMemo(() => {
        const filtered = tournaments.filter(tournament => {
            // Filter out fallback tournaments (mock data) from display
            if (tournament.isFallback) {
                console.log(`Filtering out fallback tournament ${tournament.id} from display`);
                return false;
            }

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
        console.log(`Filtered tournaments: ${filtered.length} (total tournaments: ${tournaments.length}, search: "${deferredSearch}", status: "${statusFilter}")`);

        // Debug: Log details of each tournament
        console.log('Tournament details:');
        filtered.forEach((tournament, index) => {
            console.log(`Tournament ${index + 1}:`, {
                id: tournament.id,
                name: tournament.name,
                status: tournament.status,
                isFallback: tournament.isFallback,
                participants: tournament.participants?.length || 0,
                creator: tournament.creator
            });
        });


        return filtered;
    }, [tournaments, deferredSearch, statusFilter]);

    // Optimized sorting
    const activeTournaments = useMemo(() => {
        const active = filteredTournaments
            .filter(t => t.status !== 4) // Not completed (status 4)
            .sort((a, b) => Number(b.id) - Number(a.id));
        console.log(`Active tournaments: ${active.length} (total filtered: ${filteredTournaments.length})`);
        return active;
    }, [filteredTournaments]);
    const completedTournaments = useMemo(() => {
        const completed = tournaments
            .filter(t => t.status === 4) // Completed (status 4) - include fallback tournaments too
            .sort((a, b) => Number(b.id) - Number(a.id));
        console.log(`Completed tournaments: ${completed.length} (total tournaments: ${tournaments.length})`);
        return completed;
    }, [tournaments]);

    // Use completed tournaments directly from the tournaments list - no need for additional contract queries
    const enhancedCompletedTournaments = useMemo(() => {
        const completed = tournaments
            .filter(t => t.status === 4) // Completed (status 4)
            .sort((a, b) => Number(b.id) - Number(a.id));
        console.log(`Enhanced completed tournaments: ${completed.length} (total tournaments: ${tournaments.length})`);
        return completed;
    }, [tournaments]);

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
                <VStack spacing={2}>
                    <Button variant="outline" onClick={() => window.location.reload()}>
                        Retry
                    </Button>
                    <Button
                        variant="outline"
                        colorScheme="blue"
                        onClick={() => {
                            if (typeof window !== 'undefined' && (window as any).showDeploymentInstructions) {
                                (window as any).showDeploymentInstructions();
                            }
                        }}
                    >
                        Show Deployment Instructions
                    </Button>
                </VStack>
            </VStack>
        );
    }

    return (
        <Box maxW="7xl" mx="auto" py={10} px={4}>
            {/* Cool Header with Gradient */}
            <Box
                bgGradient="radial(circle at 20% 50%, rgba(59, 130, 246, 0.1) 0%, transparent 50%), radial(circle at 80% 20%, rgba(147, 51, 234, 0.1) 0%, transparent 50%), radial(circle at 40% 80%, rgba(236, 72, 153, 0.1) 0%, transparent 50%)"
                borderRadius="2xl"
                p={8}
                border="1px solid"
                borderColor="gray.700"
                mb={8}
                _hover={{
                    borderColor: "blue.400",
                    boxShadow: "0 20px 40px rgba(59, 130, 246, 0.1)"
                }}
                transition="all 0.3s ease"
            >
                <HStack justify="space-between" align="center">
                    <VStack spacing={2} align="start">
                        <Heading
                            size="xl"
                            bgGradient="linear(135deg, blue.400, purple.500, pink.400)"
                            bgClip="text"
                            fontWeight="extrabold"
                        >
                            Tournaments
                        </Heading>
                        <Text color="gray.400" fontSize="md">
                            Discover and join competitive gaming tournaments
                        </Text>
                    </VStack>
                    <Button
                        leftIcon={<Trophy size={18} />}
                        size="lg"
                        px={6}
                        py={4}
                        fontSize="md"
                        fontWeight="bold"
                        bgGradient="linear(135deg, blue.500, purple.600, blue.700)"
                        color="white"
                        borderRadius="xl"
                        boxShadow="0 10px 30px rgba(59, 130, 246, 0.4)"
                        onClick={onOpen}
                        _hover={{
                            bgGradient: "linear(135deg, blue.600, purple.700, blue.800)",
                            transform: 'translateY(-3px)',
                            boxShadow: '0 15px 40px rgba(59, 130, 246, 0.6)'
                        }}
                        _active={{
                            transform: 'translateY(-1px)',
                            boxShadow: '0 8px 25px rgba(59, 130, 246, 0.5)'
                        }}
                        transition="all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
                        position="relative"
                        overflow="hidden"
                    >
                        {/* Animated background effect */}
                        <Box
                            position="absolute"
                            top={0}
                            left="-100%"
                            w="100%"
                            h="100%"
                            bgGradient="linear(90deg, transparent, rgba(255,255,255,0.2), transparent)"
                            transition="left 0.5s ease"
                            _groupHover={{
                                left: "100%"
                            }}
                        />
                        <HStack spacing={2}>
                            <Box
                                p={1}
                                bg="rgba(255,255,255,0.2)"
                                borderRadius="md"
                            >
                                <Trophy size={18} />
                            </Box>
                            <Text>Completed ({enhancedCompletedTournaments.length})</Text>
                        </HStack>
                    </Button>
                </HStack>
                <Button
                    leftIcon={<RefreshCw size={18} />}
                    colorScheme="orange"
                    variant="outline"
                    size="lg"
                    onClick={clearAllCachesAndRefresh}
                    _hover={{ bg: 'orange.600', color: 'white' }}
                    _focus={{ bg: 'orange.600', color: 'white' }}
                >
                    Clear Cache & Refresh
                </Button>
            </Box>

            {/* Cool Search and Filters */}
            <Box
                p={8}
                bgGradient="linear(135deg, gray.800, gray.900)"
                borderRadius="2xl"
                border="2px solid"
                borderColor="gray.600"
                boxShadow="0 20px 40px rgba(0,0,0,0.3)"
                mb={8}
                _hover={{
                    borderColor: "purple.400",
                    boxShadow: "0 25px 50px rgba(147, 51, 234, 0.2)"
                }}
                transition="all 0.3s ease"
                position="relative"
                overflow="hidden"
            >
                {/* Animated Background */}
                <Box
                    position="absolute"
                    top={0}
                    left={0}
                    right={0}
                    h="4px"
                    bgGradient="linear(90deg, purple.500, pink.500, purple.500)"
                    backgroundSize="200% 100%"
                    animation="gradient 3s ease infinite"
                    sx={{
                        '@keyframes gradient': {
                            '0%': { backgroundPosition: '0% 50%' },
                            '50%': { backgroundPosition: '100% 50%' },
                            '100%': { backgroundPosition: '0% 50%' }
                        }
                    }}
                />

                <VStack spacing={6} align="stretch">
                    <HStack justify="space-between" align="center">
                        <HStack spacing={3}>
                            <Box
                                p={2}
                                bgGradient="linear(135deg, purple.500, pink.600)"
                                borderRadius="xl"
                                boxShadow="0 8px 20px rgba(147, 51, 234, 0.3)"
                            >
                                <Search size={20} color="white" />
                            </Box>
                            <Heading size="lg" color="white" fontWeight="bold">Search & Filter</Heading>
                        </HStack>
                        <IconButton
                            aria-label="Toggle filters"
                            icon={showFilters ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                            onClick={() => setShowFilters(!showFilters)}
                            variant="ghost"
                            size="md"
                            color="purple.300"
                            _hover={{
                                bg: 'purple.600',
                                color: 'white',
                                transform: 'scale(1.1)'
                            }}
                            _focus={{ bg: 'purple.600', color: 'white' }}
                            transition="all 0.2s ease"
                        />
                    </HStack>

                    <InputGroup maxW="600px">
                        <InputLeftElement pointerEvents="none">
                            <Search size={20} color="purple.400" />
                        </InputLeftElement>
                        <Input
                            placeholder="Search tournaments by name, creator, or game type..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            bg="gray.700"
                            border="2px solid"
                            borderColor="gray.600"
                            borderRadius="xl"
                            _hover={{
                                borderColor: "purple.400",
                                transform: "translateY(-1px)",
                                boxShadow: "0 4px 12px rgba(147, 51, 234, 0.2)"
                            }}
                            _focus={{
                                borderColor: "purple.500",
                                boxShadow: "0 0 0 3px rgba(147, 51, 234, 0.1)",
                                transform: "translateY(-1px)"
                            }}
                            size="lg"
                            fontSize="md"
                            color="white"
                            _placeholder={{ color: "gray.400" }}
                            transition="all 0.2s ease"
                        />
                    </InputGroup>

                    <Collapse in={showFilters}>
                        <HStack spacing={4} flexWrap="wrap">
                            <Select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                bg="gray.700"
                                border="2px solid"
                                borderColor="gray.600"
                                borderRadius="xl"
                                maxW="200px"
                                _hover={{
                                    borderColor: "purple.400",
                                    transform: "translateY(-1px)",
                                    boxShadow: "0 4px 12px rgba(147, 51, 234, 0.2)"
                                }}
                                _focus={{
                                    borderColor: "purple.500",
                                    boxShadow: "0 0 0 3px rgba(147, 51, 234, 0.1)"
                                }}
                                color="white"
                                transition="all 0.2s ease"
                            >
                                <option value="all">All Status</option>
                                <option value="active">Playing Only</option>
                                <option value="completed">Completed Only</option>
                                <option value="0">Joining</option>
                                <option value="1">Playing</option>
                                <option value="2">Processing Results</option>
                                <option value="3">Completed</option>
                            </Select>

                            <Button
                                size="md"
                                variant="outline"
                                colorScheme="purple"
                                borderRadius="xl"
                                border="2px solid"
                                borderColor="purple.500"
                                color="purple.300"
                                fontWeight="semibold"
                                onClick={() => {
                                    setSearchTerm('');
                                    setStatusFilter('all');
                                }}
                                _hover={{
                                    bg: "purple.600",
                                    color: "white",
                                    transform: "translateY(-2px)",
                                    boxShadow: "0 8px 20px rgba(147, 51, 234, 0.3)"
                                }}
                                transition="all 0.2s ease"
                            >
                                Clear Filters
                            </Button>
                        </HStack>
                    </Collapse>
                </VStack>
            </Box>

            {/* Active Tournaments Section */}
            <VStack spacing={6} align="stretch">

                {/* Cool No Tournaments Message */}
                {tournaments.length === 0 && !loading && (
                    <Box
                        p={12}
                        textAlign="center"
                        bgGradient="linear(135deg, gray.800, gray.900)"
                        borderRadius="2xl"
                        border="2px solid"
                        borderColor="gray.600"
                        boxShadow="0 20px 40px rgba(0,0,0,0.3)"
                        _hover={{
                            borderColor: "blue.400",
                            boxShadow: "0 25px 50px rgba(59, 130, 246, 0.2)"
                        }}
                        transition="all 0.3s ease"
                        position="relative"
                        overflow="hidden"
                    >
                        {/* Animated Background */}
                        <Box
                            position="absolute"
                            top={0}
                            left={0}
                            right={0}
                            h="4px"
                            bgGradient="linear(90deg, blue.500, purple.500, pink.500, blue.500)"
                            backgroundSize="200% 100%"
                            animation="gradient 3s ease infinite"
                            sx={{
                                '@keyframes gradient': {
                                    '0%': { backgroundPosition: '0% 50%' },
                                    '50%': { backgroundPosition: '100% 50%' },
                                    '100%': { backgroundPosition: '0% 50%' }
                                }
                            }}
                        />

                        <VStack spacing={6}>
                            <Box
                                p={4}
                                bgGradient="linear(135deg, blue.500, purple.600)"
                                borderRadius="2xl"
                                boxShadow="0 10px 30px rgba(59, 130, 246, 0.4)"
                                _hover={{
                                    transform: "scale(1.1)",
                                    boxShadow: "0 15px 40px rgba(59, 130, 246, 0.6)"
                                }}
                                transition="all 0.3s ease"
                            >
                                <Trophy size={56} color="white" />
                            </Box>
                            <VStack spacing={3}>
                                <Heading fontSize="2xl" fontWeight="bold" color="white">
                                    No Tournaments Yet
                                </Heading>
                                <Text color="gray.300" fontSize="lg" maxW="md">
                                    Be the first to create a tournament and start the competition!
                                </Text>
                            </VStack>
                            <Button
                                size="lg"
                                px={8}
                                py={6}
                                fontSize="lg"
                                fontWeight="bold"
                                bgGradient="linear(135deg, blue.500, purple.600, blue.700)"
                                color="white"
                                borderRadius="xl"
                                boxShadow="0 10px 30px rgba(59, 130, 246, 0.4)"
                                onClick={() => {
                                    window.location.href = '/create';
                                }}
                                _hover={{
                                    bgGradient: "linear(135deg, blue.600, purple.700, blue.800)",
                                    transform: 'translateY(-3px)',
                                    boxShadow: '0 15px 40px rgba(59, 130, 246, 0.6)'
                                }}
                                _active={{
                                    transform: 'translateY(-1px)',
                                    boxShadow: '0 8px 25px rgba(59, 130, 246, 0.5)'
                                }}
                                transition="all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
                                position="relative"
                                overflow="hidden"
                            >
                                {/* Animated background effect */}
                                <Box
                                    position="absolute"
                                    top={0}
                                    left="-100%"
                                    w="100%"
                                    h="100%"
                                    bgGradient="linear(90deg, transparent, rgba(255,255,255,0.2), transparent)"
                                    transition="left 0.5s ease"
                                    _groupHover={{
                                        left: "100%"
                                    }}
                                />
                                <HStack spacing={3}>
                                    <Box
                                        p={1}
                                        bg="rgba(255,255,255,0.2)"
                                        borderRadius="md"
                                    >
                                        <Plus size={20} />
                                    </Box>
                                    <Text>Create Your First Tournament</Text>
                                </HStack>
                            </Button>
                        </VStack>
                    </Box>
                )}

                <Box
                    bgGradient="linear(135deg, gray.800, gray.900)"
                    borderRadius="2xl"
                    p={6}
                    border="2px solid"
                    borderColor="gray.600"
                    boxShadow="0 20px 40px rgba(0,0,0,0.3)"
                    _hover={{
                        borderColor: "green.400",
                        boxShadow: "0 25px 50px rgba(34, 197, 94, 0.2)"
                    }}
                    transition="all 0.3s ease"
                    position="relative"
                    overflow="hidden"
                >
                    {/* Animated Background */}
                    <Box
                        position="absolute"
                        top={0}
                        left={0}
                        right={0}
                        h="4px"
                        bgGradient="linear(90deg, green.500, emerald.500, green.500)"
                        backgroundSize="200% 100%"
                        animation="gradient 3s ease infinite"
                        sx={{
                            '@keyframes gradient': {
                                '0%': { backgroundPosition: '0% 50%' },
                                '50%': { backgroundPosition: '100% 50%' },
                                '100%': { backgroundPosition: '0% 50%' }
                            }
                        }}
                    />

                    <HStack justify="space-between" align="center">
                        <HStack spacing={4}>
                            <Box
                                p={2}
                                bgGradient="linear(135deg, green.500, emerald.600)"
                                borderRadius="xl"
                                boxShadow="0 8px 20px rgba(34, 197, 94, 0.3)"
                            >
                                <Clock size={24} color="white" />
                            </Box>
                            <VStack spacing={1} align="start">
                                <HStack spacing={3}>
                                    <Heading size="lg" color="white" fontWeight="bold">Active Tournaments</Heading>
                                    <Badge
                                        bgGradient="linear(135deg, green.500, emerald.600)"
                                        color="white"
                                        fontSize="sm"
                                        px={3}
                                        py={1}
                                        borderRadius="xl"
                                        boxShadow="0 4px 12px rgba(34, 197, 94, 0.3)"
                                    >
                                        {activeTournaments.length}
                                    </Badge>
                                </HStack>
                                {activeTournaments.length > 0 && activeTournaments.some(t => t.isWorkaround) && (
                                    <Text fontSize="sm" color="blue.300" fontWeight="medium">
                                        ℹ️ Using workaround data (contract getTournament function has a bug)
                                    </Text>
                                )}
                                {activeTournaments.length > 0 && activeTournaments.every(t => t.isFallback) && (
                                    <Text fontSize="sm" color="yellow.300" fontWeight="medium">
                                        ⚠️ Tournament data failed to load - showing placeholder data
                                    </Text>
                                )}
                            </VStack>
                        </HStack>
                        <HStack spacing={3}>
                            <Button
                                onClick={() => window.location.href = '/tournaments/create'}
                                size="md"
                                bgGradient="linear(135deg, green.500, emerald.600, green.700)"
                                color="white"
                                borderRadius="xl"
                                boxShadow="0 10px 30px rgba(34, 197, 94, 0.4)"
                                leftIcon={<Plus size={18} />}
                                fontWeight="bold"
                                _hover={{
                                    bgGradient: "linear(135deg, green.600, emerald.700, green.800)",
                                    transform: 'translateY(-3px)',
                                    boxShadow: '0 15px 40px rgba(34, 197, 94, 0.6)'
                                }}
                                _active={{
                                    transform: 'translateY(-1px)',
                                    boxShadow: '0 8px 25px rgba(34, 197, 94, 0.5)'
                                }}
                                transition="all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
                                position="relative"
                                overflow="hidden"
                            >
                                {/* Animated background effect */}
                                <Box
                                    position="absolute"
                                    top={0}
                                    left="-100%"
                                    w="100%"
                                    h="100%"
                                    bgGradient="linear(90deg, transparent, rgba(255,255,255,0.2), transparent)"
                                    transition="left 0.5s ease"
                                    _groupHover={{
                                        left: "100%"
                                    }}
                                />
                                <Text>Create Tournament</Text>
                            </Button>
                        </HStack>
                    </HStack>
                </Box>

                {activeTournaments.length === 0 ? (
                    <Box
                        p={8}
                        textAlign="center"
                        bgGradient="linear(135deg, gray.800, gray.900)"
                        borderRadius="2xl"
                        border="2px solid"
                        borderColor="gray.600"
                        boxShadow="0 20px 40px rgba(0,0,0,0.3)"
                        _hover={{
                            borderColor: "green.400",
                            boxShadow: "0 25px 50px rgba(34, 197, 94, 0.2)"
                        }}
                        transition="all 0.3s ease"
                        position="relative"
                        overflow="hidden"
                    >
                        {/* Animated Background */}
                        <Box
                            position="absolute"
                            top={0}
                            left={0}
                            right={0}
                            h="4px"
                            bgGradient="linear(90deg, green.500, emerald.500, green.500)"
                            backgroundSize="200% 100%"
                            animation="gradient 3s ease infinite"
                            sx={{
                                '@keyframes gradient': {
                                    '0%': { backgroundPosition: '0% 50%' },
                                    '50%': { backgroundPosition: '100% 50%' },
                                    '100%': { backgroundPosition: '0% 50%' }
                                }
                            }}
                        />

                        <VStack spacing={4}>
                            <Box
                                p={3}
                                bgGradient="linear(135deg, green.500, emerald.600)"
                                borderRadius="xl"
                                boxShadow="0 8px 20px rgba(34, 197, 94, 0.3)"
                                _hover={{
                                    transform: "scale(1.1)",
                                    boxShadow: "0 12px 25px rgba(34, 197, 94, 0.4)"
                                }}
                                transition="all 0.3s ease"
                            >
                                <Clock size={32} color="white" />
                            </Box>
                            <Text color="gray.300" fontSize="lg" fontWeight="medium">
                                No active tournaments found. Create one to get started!
                            </Text>
                        </VStack>
                    </Box>
                ) : (
                    <>
                        <SimpleGrid columns={columns} spacing={8}>
                            {currentTournaments.map((tournament) => (
                                <TournamentCard
                                    key={tournament.id}
                                    tournament={tournament}
                                    onLoadDetails={loadTournamentDetails}
                                    onRetryTournament={retryTournament}
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

            {/* Cool Completed Tournaments Modal */}
            <Modal isOpen={isOpen} onClose={onClose} size="6xl">
                <ModalOverlay bg="blackAlpha.600" backdropFilter="blur(10px)" />
                <ModalContent
                    bgGradient="linear(135deg, gray.800, gray.900)"
                    borderRadius="2xl"
                    border="2px solid"
                    borderColor="gray.600"
                    boxShadow="0 25px 50px rgba(0,0,0,0.5)"
                    position="relative"
                    overflow="hidden"
                >
                    {/* Animated Background */}
                    <Box
                        position="absolute"
                        top={0}
                        left={0}
                        right={0}
                        h="4px"
                        bgGradient="linear(90deg, purple.500, pink.500, purple.500)"
                        backgroundSize="200% 100%"
                        animation="gradient 3s ease infinite"
                        sx={{
                            '@keyframes gradient': {
                                '0%': { backgroundPosition: '0% 50%' },
                                '50%': { backgroundPosition: '100% 50%' },
                                '100%': { backgroundPosition: '0% 50%' }
                            }
                        }}
                    />

                    <ModalHeader pb={4}>
                        <HStack spacing={4}>
                            <Box
                                p={2}
                                bgGradient="linear(135deg, purple.500, pink.600)"
                                borderRadius="xl"
                                boxShadow="0 8px 20px rgba(147, 51, 234, 0.3)"
                            >
                                <Trophy size={24} color="white" />
                            </Box>
                            <VStack spacing={1} align="start">
                                <Heading size="lg" color="white" fontWeight="bold">
                                    Completed Tournaments
                                </Heading>
                                <Text color="purple.300" fontSize="sm" fontWeight="medium">
                                    View all finished tournaments and their results
                                </Text>
                            </VStack>
                            <Badge
                                bgGradient="linear(135deg, purple.500, pink.600)"
                                color="white"
                                fontSize="md"
                                px={3}
                                py={1}
                                borderRadius="xl"
                                boxShadow="0 4px 12px rgba(147, 51, 234, 0.3)"
                                fontWeight="bold"
                            >
                                {enhancedCompletedTournaments.length}
                            </Badge>
                        </HStack>
                    </ModalHeader>
                    <ModalCloseButton
                        color="purple.300"
                        _hover={{
                            bg: 'purple.600',
                            color: 'white',
                            transform: 'scale(1.1)'
                        }}
                        _focus={{ bg: 'purple.600', color: 'white' }}
                        transition="all 0.2s ease"
                    />
                    <ModalBody pb={8}>
                        {enhancedCompletedTournaments.length === 0 ? (
                            <Box
                                p={12}
                                textAlign="center"
                                bgGradient="linear(135deg, gray.700, gray.800)"
                                borderRadius="2xl"
                                border="2px solid"
                                borderColor="gray.600"
                                boxShadow="0 20px 40px rgba(0,0,0,0.3)"
                                _hover={{
                                    borderColor: "purple.400",
                                    boxShadow: "0 25px 50px rgba(147, 51, 234, 0.2)"
                                }}
                                transition="all 0.3s ease"
                                position="relative"
                                overflow="hidden"
                            >
                                {/* Animated Background */}
                                <Box
                                    position="absolute"
                                    top={0}
                                    left={0}
                                    right={0}
                                    h="4px"
                                    bgGradient="linear(90deg, purple.500, pink.500, purple.500)"
                                    backgroundSize="200% 100%"
                                    animation="gradient 3s ease infinite"
                                    sx={{
                                        '@keyframes gradient': {
                                            '0%': { backgroundPosition: '0% 50%' },
                                            '50%': { backgroundPosition: '100% 50%' },
                                            '100%': { backgroundPosition: '0% 50%' }
                                        }
                                    }}
                                />

                                <VStack spacing={6}>
                                    <Box
                                        p={4}
                                        bgGradient="linear(135deg, purple.500, pink.600)"
                                        borderRadius="2xl"
                                        boxShadow="0 10px 30px rgba(147, 51, 234, 0.4)"
                                        _hover={{
                                            transform: "scale(1.1)",
                                            boxShadow: "0 15px 40px rgba(147, 51, 234, 0.6)"
                                        }}
                                        transition="all 0.3s ease"
                                    >
                                        <Trophy size={48} color="white" />
                                    </Box>
                                    <VStack spacing={3}>
                                        <Heading fontSize="2xl" fontWeight="bold" color="white">
                                            No Completed Tournaments Yet
                                        </Heading>
                                        <Text color="gray.300" fontSize="lg" maxW="md">
                                            Completed tournaments will appear here once they finish.
                                        </Text>
                                    </VStack>
                                </VStack>
                            </Box>
                        ) : (
                            <SimpleGrid columns={columns} spacing={8}>
                                {enhancedCompletedTournaments.map((tournament) => (
                                    <TournamentCard
                                        key={tournament.id}
                                        tournament={tournament}
                                        onLoadDetails={loadTournamentDetails}
                                        onRetryTournament={retryTournament}
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