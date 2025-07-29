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
} from '@chakra-ui/react';
import { Users, Award, Calendar, Plus, Search, Filter, ChevronDown, ChevronUp, Trophy, Clock, Copy } from 'lucide-react';
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

function formatEgld(biguint: bigint) {
    return (Number(biguint) / 1e18).toFixed(2);
}

export const Tournaments = () => {
    const [tournaments, setTournaments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [showFilters, setShowFilters] = useState(false);
    const { isOpen, onOpen, onClose } = useDisclosure();

    const toast = useToast();
    const bgColor = useColorModeValue('gray.800', 'gray.900');
    const borderColor = useColorModeValue('gray.700', 'gray.600');

    useEffect(() => {
        const fetchTournaments = async () => {
            setLoading(true);
            setError(null);
            try {
                // Try to get active tournament IDs from smart contract
                let tournamentIds = await getActiveTournamentIds();

                // If no tournaments found via contract query, try events
                if (tournamentIds.length === 0) {
                    const eventTournaments = await getTournamentsFromBlockchain();
                    tournamentIds = eventTournaments.filter((t): t is NonNullable<typeof t> => t !== null).map(t => BigInt(t.id || 0)).filter(id => id > 0n);
                }

                if (tournamentIds.length === 0) {
                    tournamentIds = await findTournamentsByTesting();
                }

                if (tournamentIds.length === 0) {
                    setTournaments([]);
                    setLoading(false);
                    return;
                }

                // Fetch details for each tournament
                const tournamentPromises = tournamentIds.map(async (id) => {
                    try {
                        const details = await getTournamentDetailsFromContract(id);
                        let gameConfig = null;
                        if (details && details.game_id) {
                            gameConfig = await getGameConfig(details.game_id);
                        }
                        let prizePool = null;
                        try {
                            prizePool = await getPrizePoolFromContract(id);
                        } catch (e) {
                            prizePool = null;
                        }
                        let resultTxHash = null;
                        try {
                            resultTxHash = await getSubmitResultsTransactionHash(id);
                        } catch (e) {
                            resultTxHash = null;
                        }
                        if (details) {
                            return {
                                id,
                                name: `Tournament #${id}`,
                                status: details.status,
                                players: details.participants || [],
                                description: `Game ID: ${details.game_id}`,
                                creator: details.creator,
                                final_podium: details.final_podium || [],
                                gameConfig,
                                prizePool,
                                resultTxHash
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

    // Filter tournaments based on search term and status
    const filteredTournaments = tournaments.filter(tournament => {
        const matchesSearch = tournament.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            tournament.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
            tournament.creator.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesStatus = statusFilter === 'all' ||
            (statusFilter === 'active' && tournament.status !== 2) ||
            (statusFilter === 'completed' && tournament.status === 2) ||
            tournament.status.toString() === statusFilter;

        return matchesSearch && matchesStatus;
    });

    // Separate active and completed tournaments
    const activeTournaments = filteredTournaments.filter(t => t.status !== 2);
    const completedTournaments = filteredTournaments.filter(t => t.status === 2);

    const TournamentCard = ({ tournament }: { tournament: any }) => (
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
                <HStack color="gray.400" fontSize="sm">
                    <Users size={16} />
                    <Text>{tournament.players.length} players</Text>
                </HStack>

                <HStack color="gray.400" fontSize="sm">
                    <Award size={16} />
                    <Text>Prize Pool: {tournament.prizePool !== null ? (Number(tournament.prizePool) / 1e18).toFixed(2) + ' EGLD' : '-'}</Text>
                </HStack>

                <HStack color="gray.400" fontSize="sm" justify="space-between" w="full">
                    <Text>Creator: {tournament.creator ?
                        `${tournament.creator.slice(0, 8)}...${tournament.creator.slice(-6)}` :
                        'N/A'
                    }</Text>
                    <IconButton
                        aria-label="Copy creator address"
                        icon={<Copy size={14} color="#3182CE" />}
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
                </HStack>

                {tournament.status === 2 && tournament.final_podium.length > 0 && (
                    <VStack color="gray.400" fontSize="sm" align="start" spacing={2}>
                        <HStack>
                            <Trophy size={16} />
                            <Text>
                                Winner: {tournament.final_podium[0] ?
                                    `${tournament.final_podium[0].slice(0, 8)}...${tournament.final_podium[0].slice(-6)}` :
                                    'N/A'
                                }
                            </Text>
                        </HStack>
                        <HStack>
                            <Text fontSize="xs">Result TX:</Text>
                            <Text fontSize="xs" fontFamily="mono">
                                {tournament.resultTxHash ?
                                    `${tournament.resultTxHash.slice(0, 8)}...${tournament.resultTxHash.slice(-6)}` :
                                    'Pending...'
                                }
                            </Text>
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

    if (loading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" h="96">
                <SimpleGrid columns={columns} spacing={8} w="full">
                    {[...Array(6)].map((_, i) => (
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
                </HStack>

                {activeTournaments.length === 0 ? (
                    <VStack justify="center" align="center" h="48" spacing={4}>
                        <Clock size={24} color="#3182CE" />
                        <Text color="gray.400" textAlign="center">
                            No active tournaments found. Create one to get started!
                        </Text>
                    </VStack>
                ) : (
                    <SimpleGrid columns={columns} spacing={8}>
                        {activeTournaments.map((tournament) => (
                            <TournamentCard key={tournament.id} tournament={tournament} />
                        ))}
                    </SimpleGrid>
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
                                    <TournamentCard key={tournament.id} tournament={tournament} />
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