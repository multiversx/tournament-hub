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
    Progress,
} from '@chakra-ui/react';
import { Users, Award, Calendar, Play, Trophy, CopyIcon, Clock, Coins } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    startTournamentSession,
    startGameSession,
    TournamentSession,
    GAME_CONFIGS
} from '../services/tournamentService';
import { getTournamentDetailsFromContract, getGameConfig, getPrizePoolFromContract } from '../helpers';
import { getSubmitResultsTransactionHash } from '../helpers';
import { weiToEgld } from '../utils/contractUtils';
import { useGetAccount } from 'lib';
import { useJoinTournamentTransaction } from 'hooks/transactions';
import { Tooltip } from '@chakra-ui/react';
import { TournamentBracket } from '../components/TournamentBracket';
import { useStartGameTransaction } from 'hooks/transactions';

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

function getGameName(gameId: number): string {
    const gameConfig = GAME_CONFIGS[gameId as keyof typeof GAME_CONFIGS];
    return gameConfig ? gameConfig.name : `Game ID: ${gameId}`;
}

function formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const days = Math.floor(hours / 24);

    if (days > 0) {
        return `${days} day${days > 1 ? 's' : ''}`;
    } else if (hours > 0) {
        return `${hours} hour${hours > 1 ? 's' : ''}`;
    } else {
        return `${Math.floor(seconds / 60)} minute${Math.floor(seconds / 60) > 1 ? 's' : ''}`;
    }
}

function getTimeRemaining(createdAt: number, duration: number): { remaining: number; percentage: number } {
    // createdAt is in seconds, so we need to convert current time to seconds
    const now = Math.floor(Date.now() / 1000);
    const endTime = createdAt + duration;
    const remaining = Math.max(0, endTime - now);
    const percentage = Math.max(0, Math.min(100, ((endTime - now) / duration) * 100));
    return { remaining, percentage };
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
    const [startingGame, setStartingGame] = useState(false);
    const [tournamentSession, setTournamentSession] = useState<TournamentSession | null>(null);
    const [timeRemaining, setTimeRemaining] = useState<{ remaining: number; percentage: number }>({ remaining: 0, percentage: 100 });

    // Add start game transaction hook
    const { startGame } = useStartGameTransaction();

    useEffect(() => {
        async function fetchTournament() {
            setLoading(true);
            setError(null);
            try {
                if (!id) throw new Error('No tournament id');

                // Try to get tournament details from contract first
                let details = await getTournamentDetailsFromContract(BigInt(id));
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

                // Calculate time remaining
                const timeInfo = getTimeRemaining(Number(details.created_at), Number(details.duration));

                setTournament({
                    ...details,
                    gameConfig,
                    prize_pool: prizePool ? (Number(prizePool) / 1e18).toFixed(4) + ' EGLD' : '-',
                    status: ['Joining', 'ReadyToStart', 'Active', 'ProcessingResults', 'Completed'][details.status] || 'unknown',
                    current_players: details.participants.length,
                    description: details.name || getGameName(Number(details.game_id)),
                    resultTxHash,
                    entry_fee_egld: weiToEgld(details.entry_fee.toString()),
                });
                setTimeRemaining(timeInfo);
            } catch (err: any) {
                setError(err.message || 'Failed to fetch tournament');
            } finally {
                setLoading(false);
            }
        }
        fetchTournament();
    }, [id]);

    // Update time remaining every minute
    useEffect(() => {
        if (!tournament) return;

        const interval = setInterval(() => {
            const timeInfo = getTimeRemaining(Number(tournament.created_at), Number(tournament.duration));
            setTimeRemaining(timeInfo);
        }, 60000); // Update every minute

        return () => clearInterval(interval);
    }, [tournament]);

    const handleJoinTournament = async () => {
        if (!playerAddress) {
            toast({
                title: 'Wallet not connected',
                description: 'Please connect your wallet first',
                status: 'warning',
                duration: 3000,
                isClosable: true,
            });
            return;
        }

        setJoining(true);
        try {
            await joinTournament({
                tournamentId: parseInt(id || '0'),
                entryFee: tournament.entry_fee.toString()
            });

            // Start tournament session on backend
            try {
                const session = await startTournamentSession(parseInt(id || '0'), Number(tournament.game_id));
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

    const handleStartGame = async () => {
        if (!playerAddress) {
            toast({
                title: 'Wallet not connected',
                description: 'Please connect your wallet first',
                status: 'warning',
                duration: 3000,
                isClosable: true,
            });
            return;
        }

        setStartingGame(true);
        try {
            await startGame({
                tournamentId: parseInt(id || '0'),
                gameId: Number(tournament.game_id),
                participants: tournament.participants,
            });

            toast({
                title: 'Success!',
                description: 'Game started successfully!',
                status: 'success',
                duration: 5000,
                isClosable: true,
            });

            // Refetch tournament details to show updated status
            if (typeof window !== 'undefined') {
                window.location.reload();
            }
        } catch (err) {
            console.error('Error starting game:', err);
            toast({
                title: 'Error',
                description: 'Failed to start game. Please try again.',
                status: 'error',
                duration: 5000,
                isClosable: true,
            });
        } finally {
            setStartingGame(false);
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
    const isParticipant = playerAddress ? tournament.participants.includes(playerAddress) : false;
    const isCreator = playerAddress === tournament.creator;
    const canJoin = (tournament.status === 'Joining' || tournament.status === 'ReadyToStart') &&
        tournament.current_players < tournament.max_players &&
        !isParticipant &&
        !!playerAddress && // Ensure wallet is connected
        timeRemaining.remaining > 0; // Ensure tournament is still open

    // Show Start Game button if tournament is ready to start and user is a participant
    const canStartGame = tournament.status === 'ReadyToStart' &&
        isParticipant &&
        isCreator && // Only creator can start the game
        !!playerAddress;

    const getJoinButtonText = () => {
        if (!playerAddress) return 'Connect Wallet to Join';
        if (isParticipant) {
            return isCreator ? 'You Created This Tournament' : 'Already Joined';
        }
        if (timeRemaining.remaining <= 0) return 'Registration Closed';
        return 'Join Tournament';
    };

    return (
        <Box maxW="7xl" mx="auto" py={10} px={4}>
            <VStack spacing={8} align="stretch">
                {/* Header */}
                <Box>
                    <HStack justify="space-between" align="start" mb={4}>
                        <VStack align="start" spacing={2}>
                            <Heading size="xl">{tournament.name || `Tournament #${id}`}</Heading>
                            <Badge colorScheme={statusColors[tournament.status] || 'gray'} fontSize="md" px={3} py={1} borderRadius="md">
                                {tournament.status}
                            </Badge>
                        </VStack>
                        {canStartGame ? (
                            <Button
                                leftIcon={<Play size={20} />}
                                colorScheme="green"
                                size="lg"
                                onClick={handleStartGame}
                                isLoading={startingGame}
                                loadingText="Starting Game..."
                            >
                                Start Game
                            </Button>
                        ) : (
                            <Button
                                leftIcon={<Play size={20} />}
                                colorScheme="blue"
                                size="lg"
                                onClick={handleJoinTournament}
                                isLoading={joining}
                                loadingText="Joining..."
                                isDisabled={!canJoin}
                            >
                                {getJoinButtonText()}
                            </Button>
                        )}
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
                                    <Text color="gray.300" fontWeight="bold">Current Prize Pool:</Text>
                                    <Text color="gray.100">{tournament.prize_pool}</Text>
                                </HStack>
                                <HStack justify="space-between">
                                    <Text color="gray.300" fontWeight="bold">Max Prize Pool:</Text>
                                    <Text color="gray.100">
                                        {(parseFloat(tournament.entry_fee_egld) * tournament.max_players).toFixed(4)} EGLD
                                    </Text>
                                </HStack>
                                <HStack justify="space-between">
                                    <Text color="gray.300" fontWeight="bold">Entry Fee:</Text>
                                    <Text color="gray.100">{tournament.entry_fee_egld} EGLD</Text>
                                </HStack>
                                <HStack justify="space-between">
                                    <Text color="gray.300" fontWeight="bold">Players:</Text>
                                    <Text color="gray.100">{tournament.current_players}/{tournament.max_players}</Text>
                                </HStack>
                                <HStack justify="space-between">
                                    <Text color="gray.300" fontWeight="bold">Creator:</Text>
                                    <Text color="blue.400" fontWeight="bold" fontSize="sm">{shortenAddress(tournament.creator)}</Text>
                                </HStack>
                                <HStack justify="space-between">
                                    <Text color="gray.300" fontWeight="bold">Duration:</Text>
                                    <Text color="gray.100">{formatDuration(Number(tournament.duration))}</Text>
                                </HStack>
                            </VStack>
                        </CardBody>
                    </Card>

                    {/* Registration Status Card */}
                    <Card bg="gray.800" border="1px solid" borderColor="gray.700">
                        <CardHeader>
                            <Heading size="md" color="white" fontWeight="bold">Registration Status</Heading>
                        </CardHeader>
                        <CardBody>
                            <VStack spacing={4} align="stretch">
                                {timeRemaining.remaining > 0 ? (
                                    <>
                                        <HStack justify="space-between">
                                            <Text color="gray.300" fontWeight="bold">Time Remaining:</Text>
                                            <Text color="gray.100">{formatDuration(timeRemaining.remaining)}</Text>
                                        </HStack>
                                        <Progress
                                            value={timeRemaining.percentage}
                                            colorScheme="blue"
                                            size="sm"
                                            borderRadius="md"
                                        />
                                        <Text color="gray.400" fontSize="sm" textAlign="center">
                                            Registration closes in {formatDuration(timeRemaining.remaining)}
                                        </Text>
                                    </>
                                ) : (
                                    <Text color="red.400" fontWeight="bold" textAlign="center">
                                        Registration Period Has Ended
                                    </Text>
                                )}
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
                            Participants ({tournament.participants.length})
                        </Heading>
                    </CardHeader>
                    <CardBody py={2} px={3}>
                        <VStack spacing={2} align="stretch">
                            {tournament.participants.map((player: string, index: number) => (
                                <HStack
                                    key={player}
                                    p={2}
                                    bg={playerAddress === player ? "blue.900" : "gray.700"}
                                    borderRadius="md"
                                    justify="space-between"
                                    boxShadow={playerAddress === player ? "0 0 0 2px #3182ce" : undefined}
                                >
                                    <HStack spacing={2}>
                                        <Badge
                                            colorScheme={player === tournament.creator ? "purple" : "blue"}
                                            borderRadius="full"
                                            px={2}
                                            fontSize="xs"
                                        >
                                            {player === tournament.creator ? "Creator" : index + 1}
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

                {/* Game Interface for Active Tournaments */}
                {tournament.status === 'Active' && (
                    <Card bg="gray.800" border="1px solid" borderColor="gray.700" maxW="800px" mx="auto">
                        <CardHeader>
                            <Heading size="md" color="white" fontWeight="bold">
                                Game Session
                            </Heading>
                        </CardHeader>
                        <CardBody>
                            <VStack spacing={4} align="stretch">
                                <Text color="gray.300" textAlign="center">
                                    Tournament is now active! The game should be starting...
                                </Text>
                                <Button
                                    colorScheme="green"
                                    size="lg"
                                    onClick={() => {
                                        // Navigate to the game session
                                        const gameType = getGameName(Number(tournament.game_id));
                                        if (gameType === 'Chess') {
                                            navigate(`/game/chess/${id}`);
                                        } else if (gameType === 'Tic Tac Toe') {
                                            navigate(`/game/tictactoe/${id}`);
                                        } else {
                                            navigate(`/game/cryptobubbles/${id}`);
                                        }
                                    }}
                                >
                                    Launch Game
                                </Button>
                            </VStack>
                        </CardBody>
                    </Card>
                )}

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
                {isParticipant && tournament.participants.length >= 1 && tournament.status === 'Joining' && (
                    <Button
                        colorScheme="green"
                        size="md"
                        mt={4}
                        isLoading={startingGame}
                        loadingText="Starting Game..."
                        onClick={handleStartGame}
                    >
                        Start Game
                    </Button>
                )}
            </VStack>
        </Box>
    );
};

export default TournamentDetails;