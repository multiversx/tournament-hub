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
    IconButton,
} from '@chakra-ui/react';
import { Users, Award, Calendar, Play, Trophy, CopyIcon } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    startTournamentSession,
    startGameSession,
    TournamentSession,
    GAME_CONFIGS
} from '../services/tournamentService';
import { getTournamentDetailsFromContract, getGameConfig, getPrizePoolFromContract } from '../helpers';
import { getTournamentFeeFromContract, getSubmitResultsTransactionHash } from '../helpers';
import { egldToWei } from '../utils/contractUtils';
import { TicTacToeGame } from '../components';
import { useGetAccount } from 'lib';
import { useJoinTournamentTransaction } from 'hooks/transactions';
import { Tooltip } from '@chakra-ui/react';
import { TournamentBracket } from '../components/TournamentBracket';

const statusColors: Record<string, string> = {
    Joining: 'yellow',
    ProcessingResults: 'blue',
    Completed: 'gray',
};

// Utility to shorten addresses
function shortenAddress(addr: string, start = 6, end = 6) {
    if (!addr) return '';
    return addr.length > start + end ? `${addr.slice(0, start)}...${addr.slice(-end)}` : addr;
}

export const TournamentDetails = () => {
    const { id } = useParams();
    const [tournament, setTournament] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [joining, setJoining] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const toast = useToast();
    const { address: playerAddress } = useGetAccount();
    const navigate = useNavigate();
    const { joinTournament } = useJoinTournamentTransaction();
    const [tournamentFeeWei, setTournamentFeeWei] = useState('0');
    const [tournamentFeeEGLD, setTournamentFeeEGLD] = useState('0');
    const [startingGame, setStartingGame] = useState(false);
    const [tournamentSession, setTournamentSession] = useState<TournamentSession | null>(null);

    useEffect(() => {
        async function fetchTournament() {
            setLoading(true);
            setError(null);
            try {
                if (!id) throw new Error('No tournament id');
                const details = await getTournamentDetailsFromContract(BigInt(id));
                if (!details) throw new Error('Tournament not found');
                const gameConfig = await getGameConfig(details.game_id);
                const prizePool = await getPrizePoolFromContract(BigInt(id));

                // Fetch transaction hash for completed tournaments
                let resultTxHash = null;
                if (details.status === 2) { // Completed status
                    try {
                        resultTxHash = await getSubmitResultsTransactionHash(BigInt(id));
                    } catch (e) {
                        console.error('Error fetching transaction hash:', e);
                        resultTxHash = null;
                    }
                }

                setTournament({
                    ...details,
                    gameConfig,
                    prize_pool: prizePool ? (Number(prizePool) / 1e18).toFixed(2) + ' EGLD' : '-',
                    name: `Tournament #${id}`,
                    status: ['Joining', 'ProcessingResults', 'Completed'][details.status] || 'unknown',
                    current_players: details.participants.length,
                    max_players: 2, // Force max_players to 2 for now
                    description: `Game ID: ${details.game_id}`,
                    players: details.participants,
                    resultTxHash,
                });
                // Fetch global tournament fee
                const feeWei = await getTournamentFeeFromContract();
                setTournamentFeeWei(feeWei);
                setTournamentFeeEGLD((Number(feeWei) / 1e18).toFixed(4));
            } catch (err: any) {
                setError(err.message || 'Failed to fetch tournament');
            } finally {
                setLoading(false);
            }
        }
        fetchTournament();
    }, [id]);

    const handleJoinTournament = async () => {
        setJoining(true);
        try {
            await joinTournament({
                tournamentId: parseInt(id || '0'),
                entryFee: tournamentFeeWei
            });

            // Start tournament session on backend
            try {
                const session = await startTournamentSession(parseInt(id || '0'), playerAddress);
                setTournamentSession(session);
            } catch (sessionError) {
                console.error('Error starting tournament session:', sessionError);
                // Continue anyway - session can be started later
            }

            toast({
                title: 'Success!',
                description: 'You have joined the tournament successfully! Please wait to be matched.',
                status: 'success',
                duration: 5000,
                isClosable: true,
            });
            // Refetch tournament details to show updated participant list
            if (typeof window !== 'undefined') {
                window.location.reload();
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

    // Only show Join Tournament button if user is not already a participant
    const isParticipant = playerAddress ? tournament.players.includes(playerAddress) : false;
    const canJoin = tournament.status === 'Joining' &&
        tournament.current_players < tournament.max_players &&
        !isParticipant &&
        !!playerAddress; // Ensure wallet is connected

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
                            isDisabled={!canJoin}
                        >
                            {!playerAddress ? 'Connect Wallet to Join' :
                                isParticipant ? 'Already Joined' : 'Join Tournament'}
                        </Button>
                    </HStack>
                    <Text color="gray.300" fontSize="lg" lineHeight="tall">
                        {tournament.description}
                    </Text>
                </Box>

                <SimpleGrid columns={columns} spacing={8}>
                    {/* Tournament Information Card */}
                    <Card bg="gray.800" border="1px solid" borderColor="gray.700">
                        <CardHeader>
                            <Heading size="md" color="white" fontWeight="bold">Tournament Information</Heading>
                        </CardHeader>
                        <CardBody>
                            <VStack spacing={4} align="stretch">
                                <HStack justify="space-between">
                                    <Text color="gray.300" fontWeight="bold">Prize Pool:</Text>
                                    <Text color="gray.100">{tournament.prize_pool}</Text>
                                </HStack>
                                <HStack justify="space-between">
                                    <Text color="gray.300" fontWeight="bold">Entry Fee:</Text>
                                    <Text color="gray.100">{tournamentFeeEGLD} EGLD</Text>
                                </HStack>
                                <HStack justify="space-between">
                                    <Text color="gray.300" fontWeight="bold">Players:</Text>
                                    <Text color="gray.100">{tournament.current_players}/{tournament.max_players}</Text>
                                </HStack>
                                <HStack justify="space-between">
                                    <Text color="gray.300" fontWeight="bold">Creator:</Text>
                                    <Text color="blue.400" fontWeight="bold" fontSize="sm">{tournament.creator}</Text>
                                </HStack>
                            </VStack>
                        </CardBody>
                    </Card>


                </SimpleGrid>

                {/* Participants List - Compact UI */}
                <Card
                    bg="gray.800"
                    border="1px solid"
                    borderColor="gray.700"
                    maxW="400px"
                    mx="auto"
                >
                    <CardHeader pb={2}>
                        <Heading size="md" color="white" fontWeight="bold">
                            Participants ({tournament.players.length})
                        </Heading>
                    </CardHeader>
                    <CardBody py={2} px={3}>
                        <VStack spacing={2} align="stretch">
                            {tournament.players.map((player: string, index: number) => (
                                <HStack
                                    key={player}
                                    p={2}
                                    bg={playerAddress === player ? "blue.900" : "gray.700"}
                                    borderRadius="md"
                                    justify="space-between"
                                    boxShadow={playerAddress === player ? "0 0 0 2px #3182ce" : undefined}
                                >
                                    <HStack spacing={2}>
                                        <Badge colorScheme="blue" borderRadius="full" px={2} fontSize="xs">
                                            {index + 1}
                                        </Badge>
                                        <Text
                                            fontWeight={playerAddress === player ? "bold" : "medium"}
                                            color={playerAddress === player ? "blue.300" : "blue.400"}
                                            fontSize="xs"
                                            isTruncated
                                            maxW="120px"
                                        >
                                            {shortenAddress(player)}
                                        </Text>
                                    </HStack>
                                    <Tooltip label="Copy address" hasArrow>
                                        <IconButton
                                            aria-label="Copy address"
                                            icon={<CopyIcon />}
                                            size="xs"
                                            variant="ghost"
                                            colorScheme="blue"
                                            onClick={() => navigator.clipboard.writeText(player)}
                                        />
                                    </Tooltip>
                                </HStack>
                            ))}
                        </VStack>
                    </CardBody>
                </Card>

                {/* Winner and Transaction Hash for Completed Tournaments */}
                {tournament.status === 'Completed' && tournament.final_podium && tournament.final_podium.length > 0 && (
                    <Card bg="gray.800" border="1px solid" borderColor="gray.700" maxW="400px" mx="auto">
                        <CardHeader pb={2}>
                            <Heading size="md" color="white" fontWeight="bold">
                                Tournament Results
                            </Heading>
                        </CardHeader>
                        <CardBody py={2} px={3}>
                            <VStack spacing={3} align="stretch">
                                <HStack color="gray.300" fontSize="sm">
                                    <Trophy size={16} />
                                    <Text fontWeight="bold">Winner:</Text>
                                    <Text color="yellow.300" fontWeight="bold">
                                        {tournament.final_podium[0] ?
                                            `${tournament.final_podium[0].slice(0, 8)}...${tournament.final_podium[0].slice(-6)}` :
                                            'N/A'
                                        }
                                    </Text>
                                </HStack>
                                <HStack color="gray.300" fontSize="sm">
                                    <Text fontWeight="bold">Result TX:</Text>
                                    <Text fontSize="xs" fontFamily="mono" color="gray.400">
                                        {tournament.resultTxHash ?
                                            `${tournament.resultTxHash.slice(0, 8)}...${tournament.resultTxHash.slice(-6)}` :
                                            'Pending...'
                                        }
                                    </Text>
                                    {tournament.resultTxHash && (
                                        <IconButton
                                            aria-label="Copy transaction hash"
                                            icon={<CopyIcon />}
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
                        </CardBody>
                    </Card>
                )}

                {/* Tournament Bracket */}
                {tournamentSession && (
                    <TournamentBracket
                        tournament={tournamentSession}
                        currentPlayerAddress={playerAddress}
                    />
                )}

                {/* Start Game Button for Participants */}
                {isParticipant && tournament.players.length === tournament.max_players && tournament.status !== 'Completed' && (
                    <Button
                        colorScheme="green"
                        size="md"
                        mt={4}
                        isLoading={startingGame}
                        loadingText="Starting Game..."
                        onClick={async () => {
                            setStartingGame(true);
                            try {
                                const res = await startGameSession(Number(id), playerAddress);
                                if (res.sessionId) {
                                    navigate(`/game/${res.sessionId}`);
                                } else {
                                    toast({
                                        title: 'Error',
                                        description: 'Could not start game session.',
                                        status: 'error',
                                        duration: 5000,
                                        isClosable: true,
                                    });
                                }
                            } catch (err) {
                                console.error('Error starting game:', err);
                                toast({
                                    title: 'Error',
                                    description: 'Could not start game session.',
                                    status: 'error',
                                    duration: 5000,
                                    isClosable: true,
                                });
                            } finally {
                                setStartingGame(false);
                            }
                        }}
                    >
                        Start Game
                    </Button>
                )}

                {/* Example usage of TicTacToeGame */}
                {/* Remove or comment out the TicTacToeGame component here */}
            </VStack>
        </Box>
    );
};

export default TournamentDetails; 