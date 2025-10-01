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
import { Users, Award, Calendar, Play, Trophy, CopyIcon, Clock, Coins, RefreshCw } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    startTournamentSession,
    startGameSession,
    TournamentSession,
    GAME_CONFIGS
} from '../services/tournamentService';
import { getTournamentDetailsFromContract, getTournamentDetailsFromContractFresh, getGameConfig, getPrizePoolFromContract, getRecentJoins, getRecentGameStart } from '../helpers';
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
    const [lastJoinSeenAt, setLastJoinSeenAt] = useState<number>(0);

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
                if (details.status === 4) { // Completed status
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
                    prize_pool: prizePool ? (Number(prizePool) / 1e18).toFixed(4) + ' EGLD' : '-',
                    status: ['Joining', 'ReadyToStart', 'Active', 'ProcessingResults', 'Completed'][details.status] || 'unknown',
                    current_players: details.participants.length,
                    description: details.name || getGameName(Number(details.game_id)),
                    resultTxHash,
                    entry_fee_egld: weiToEgld(details.entry_fee.toString()),
                });
            } catch (err: any) {
                setError(err.message || 'Failed to fetch tournament');
            } finally {
                setLoading(false);
            }
        }
        fetchTournament();
    }, [id]);

    // Fresh fetch function that bypasses all caching
    const fetchTournamentFresh = async () => {
        setLoading(true);
        setError(null);
        try {
            console.log('fetchTournamentFresh: Fetching fresh tournament data...');
            if (!id) throw new Error('No tournament id');

            // Use fresh data fetching that bypasses all caches
            let details = await getTournamentDetailsFromContractFresh(BigInt(id));
            if (!details) throw new Error('Tournament not found');

            console.log('fetchTournamentFresh: Fresh details:', details);

            const gameConfig = await getGameConfig(details.game_id);
            const prizePool = await getPrizePoolFromContract(BigInt(id));

            // Fetch transaction hash for completed tournaments
            let resultTxHash = null;
            if (details.status === 4) { // Completed status
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
                prize_pool: prizePool ? (Number(prizePool) / 1e18).toFixed(4) + ' EGLD' : '-',
                status: ['Joining', 'ReadyToStart', 'Active', 'ProcessingResults', 'Completed'][details.status] || 'unknown',
                current_players: details.participants.length,
                description: details.name || getGameName(Number(details.game_id)),
                resultTxHash,
                entry_fee_egld: weiToEgld(details.entry_fee.toString()),
            });
            console.log('fetchTournamentFresh: Tournament updated with fresh data');
        } catch (err: any) {
            console.error('Error fetching fresh tournament:', err);
            setError(err.message || 'Failed to load tournament details');
        } finally {
            setLoading(false);
        }
    };

    // Periodically refresh participants/status to reflect joins and game start without reload
    useEffect(() => {
        if (!id) return;
        let mounted = true;
        const interval = setInterval(async () => {
            try {
                const latest = await getTournamentDetailsFromContractFresh(BigInt(id));
                if (!mounted || !latest) return;
                setTournament((prev: any) => {
                    if (!prev) return prev;
                    const changed = (
                        JSON.stringify(prev.participants) !== JSON.stringify(latest.participants) ||
                        Number(prev.statusIndex) !== Number(latest.status)
                    );
                    if (!changed) return prev;
                    return {
                        ...prev,
                        participants: latest.participants,
                        current_players: latest.participants.length,
                        statusIndex: latest.status,
                        status: ['Joining', 'ReadyToStart', 'Active', 'ProcessingResults', 'Completed'][latest.status] || prev.status
                    };
                });
            } catch { }
        }, 1000);
        return () => { mounted = false; clearInterval(interval); };
    }, [id]);

    // Listen for tournament results submission to refresh immediately
    useEffect(() => {
        const handleResultsSubmitted = () => {
            // Refresh tournament details when results are submitted
            fetchTournamentFresh();
        };

        window.addEventListener('tournamentResultsSubmitted', handleResultsSubmitted);

        return () => {
            window.removeEventListener('tournamentResultsSubmitted', handleResultsSubmitted);
        };
    }, [id]);

    // Notify creator when a player joins (poll recent joins)
    useEffect(() => {
        if (!id || !tournament) return;
        if (!playerAddress || playerAddress !== tournament.creator) return; // only creator
        let mounted = true;
        let prevCount = 0;
        const interval = setInterval(async () => {
            try {
                const joins = await getRecentJoins(id);
                if (!mounted || !Array.isArray(joins)) return;
                if (joins.length > prevCount) {
                    // Fetch latest participants and diff to be robust against encoding differences
                    const latest = await getTournamentDetailsFromContractFresh(BigInt(id));
                    if (latest && Array.isArray(latest.participants)) {
                        const prevSet = new Set<string>(tournament.participants);
                        const newOnes = latest.participants.filter((p: string) => !prevSet.has(p));
                        newOnes.forEach((addr: string) => {
                            if (!addr || addr === tournament.creator) return;
                            toast({
                                title: 'New player joined',
                                description: `${addr.slice(0, 8)}...${addr.slice(-6)} joined your tournament`,
                                status: 'info',
                                duration: 4000,
                                isClosable: true,
                            });
                        });
                        setTournament({ ...tournament, participants: latest.participants, current_players: latest.participants.length });
                    }
                    prevCount = joins.length;
                }
            } catch { /* ignore */ }
        }, 1500);
        return () => { mounted = false; clearInterval(interval); };
    }, [id, tournament, playerAddress, toast]);

    // Notify non-creator participants when the creator starts the game
    useEffect(() => {
        if (!id || !tournament) return;
        if (!playerAddress || playerAddress === tournament.creator) return; // only notify others
        if (!tournament.participants.includes(playerAddress)) return; // only participants
        let mounted = true;
        let lastNotified = 0;
        const interval = setInterval(async () => {
            try {
                const { started, ts } = await getRecentGameStart(id);
                if (!mounted) return;
                if (started && ts > lastNotified) {
                    lastNotified = ts;
                    toast({
                        title: 'Game starting',
                        description: 'The creator started the game. Get ready!',
                        status: 'success',
                        duration: 4000,
                        isClosable: true,
                    });
                }
            } catch { /* ignore */ }
        }, 1500);
        return () => { mounted = false; clearInterval(interval); };
    }, [id, tournament, playerAddress, toast]);

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

            // Trigger immediate cache invalidation and refetch
            try {
                const { invalidateCacheByEvent, invalidateCacheByKey } = await import('../helpers');

                // Invalidate specific tournament details cache
                const tournamentId = parseInt(id || '0');
                console.log('DEBUG: Invalidating caches for tournament', tournamentId);
                invalidateCacheByKey(`tournament_details_${tournamentId}`);
                invalidateCacheByKey(`basic_${tournamentId}`);

                // Invalidate general tournament events
                invalidateCacheByEvent('tournament_joined');
                invalidateCacheByEvent('tournament_updated');

                console.log('DEBUG: Cache invalidated for immediate refresh');

                // Force refetch tournament details with fresh data
                console.log('DEBUG: Fetching fresh tournament data...');
                await fetchTournamentFresh();
                console.log('DEBUG: Fresh tournament data fetched');
            } catch (error) {
                console.error('handleJoinTournament: Error invalidating cache:', error);
            }

            toast({
                title: 'Success!',
                description: 'You have joined the tournament successfully! Please wait to be matched.',
                status: 'success',
                duration: 5000,
                isClosable: true,
            });
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

    // Debug logging for address comparison
    if (playerAddress && tournament.participants) {
        console.log('DEBUG: Address comparison for tournament', id);
        console.log('DEBUG: Current player address:', playerAddress);
        console.log('DEBUG: Tournament participants:', tournament.participants);
        console.log('DEBUG: Is participant:', isParticipant);
        console.log('DEBUG: Is creator:', isCreator);
        console.log('DEBUG: Tournament creator:', tournament.creator);
    }
    const canJoin = (tournament.status === 'Joining' || tournament.status === 'ReadyToStart') &&
        tournament.current_players < tournament.max_players &&
        !isParticipant &&
        !!playerAddress; // Ensure wallet is connected

    // Show Start Game button if tournament is ready to start and user is a participant
    const minPlayersRequired = Number((tournament as any).min_players ?? 2);
    const hasEnoughPlayers = Number(tournament.current_players) >= minPlayersRequired;
    const canStartGame = tournament.status === 'ReadyToStart' &&
        isParticipant &&
        isCreator && // Only creator can start the game
        !!playerAddress && hasEnoughPlayers;

    const getJoinButtonText = () => {
        if (!playerAddress) return 'Connect Wallet to Join';
        if (isParticipant) {
            return isCreator ? 'You Created This Tournament' : 'Already Joined';
        }
        return 'Join Tournament';
    };

    return (
        <Box maxW="7xl" mx="auto" py={10} px={4}>
            <VStack spacing={8} align="stretch">
                {/* Cool Header with Gradient */}
                <Box
                    textAlign="center"
                    position="relative"
                    bgGradient="radial(circle at 20% 50%, rgba(59, 130, 246, 0.1) 0%, transparent 50%), radial(circle at 80% 20%, rgba(147, 51, 234, 0.1) 0%, transparent 50%), radial(circle at 40% 80%, rgba(236, 72, 153, 0.1) 0%, transparent 50%)"
                    borderRadius="2xl"
                    p={8}
                    border="1px solid"
                    borderColor="gray.700"
                    _hover={{
                        borderColor: "blue.400",
                        boxShadow: "0 20px 40px rgba(59, 130, 246, 0.1)"
                    }}
                    transition="all 0.3s ease"
                >
                    <HStack justify="space-between" align="start" mb={4}>
                        <VStack align="start" spacing={2}>
                            <Heading
                                size="xl"
                                bgGradient="linear(135deg, blue.400, purple.500, pink.400, blue.400)"
                                bgClip="text"
                                fontWeight="bold"
                            >
                                {tournament.name || `Tournament #${id}`}
                            </Heading>
                            <Badge
                                bgGradient="linear(135deg, blue.500, purple.600)"
                                color="white"
                                fontSize="md"
                                px={3}
                                py={1}
                                borderRadius="xl"
                                boxShadow="0 4px 15px rgba(59, 130, 246, 0.3)"
                            >
                                {tournament.status}
                            </Badge>
                        </VStack>
                        {canStartGame ? (
                            <Button
                                leftIcon={<Play size={20} />}
                                size="lg"
                                bgGradient="linear(135deg, green.500, emerald.600, green.700)"
                                color="white"
                                borderRadius="xl"
                                boxShadow="0 8px 25px rgba(34, 197, 94, 0.4)"
                                _hover={{
                                    bgGradient: "linear(135deg, green.600, emerald.700, green.800)",
                                    transform: "translateY(-2px)",
                                    boxShadow: "0 12px 30px rgba(34, 197, 94, 0.6)"
                                }}
                                _active={{
                                    transform: "translateY(0px)",
                                    boxShadow: "0 6px 20px rgba(34, 197, 94, 0.5)"
                                }}
                                transition="all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
                                onClick={handleStartGame}
                                isLoading={startingGame}
                                loadingText="Starting Game..."
                            >
                                Start Game
                            </Button>
                        ) : (tournament.status === 'ReadyToStart' && isParticipant && isCreator && !hasEnoughPlayers) ? (
                            <Button
                                size="lg"
                                bgGradient="linear(135deg, green.500, emerald.600, green.700)"
                                color="white"
                                borderRadius="xl"
                                boxShadow="0 8px 25px rgba(34, 197, 94, 0.4)"
                                _hover={{
                                    bgGradient: "linear(135deg, green.600, emerald.700, green.800)",
                                    transform: "translateY(-2px)",
                                    boxShadow: "0 12px 30px rgba(34, 197, 94, 0.6)"
                                }}
                                _active={{
                                    transform: "translateY(0px)",
                                    boxShadow: "0 6px 20px rgba(34, 197, 94, 0.5)"
                                }}
                                transition="all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
                                isDisabled
                                opacity={0.7}
                            >
                                Waiting for opponents...
                            </Button>
                        ) : (
                            <Button
                                leftIcon={<Play size={20} />}
                                size="lg"
                                bgGradient={isParticipant ? "linear(135deg, purple.500, pink.600, purple.700)" : "linear(135deg, blue.500, cyan.600, blue.700)"}
                                color="white"
                                borderRadius="xl"
                                boxShadow={isParticipant ? "0 8px 25px rgba(147, 51, 234, 0.4)" : "0 8px 25px rgba(59, 130, 246, 0.4)"}
                                _hover={{
                                    bgGradient: isParticipant ? "linear(135deg, purple.600, pink.700, purple.800)" : "linear(135deg, blue.600, cyan.700, blue.800)",
                                    transform: "translateY(-2px)",
                                    boxShadow: isParticipant ? "0 12px 30px rgba(147, 51, 234, 0.6)" : "0 12px 30px rgba(59, 130, 246, 0.6)"
                                }}
                                _active={{
                                    transform: "translateY(0px)",
                                    boxShadow: isParticipant ? "0 6px 20px rgba(147, 51, 234, 0.5)" : "0 6px 20px rgba(59, 130, 246, 0.5)"
                                }}
                                transition="all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
                                onClick={handleJoinTournament}
                                isLoading={joining}
                                loadingText="Joining..."
                                isDisabled={!canJoin}
                            >
                                {getJoinButtonText()}
                            </Button>
                        )}
                    </HStack>
                </Box>

                {/* Tournament Information Card */}
                <Card bg="gray.800" border="1px solid" borderColor="gray.700" maxW="600px" mx="auto">
                    <CardHeader>
                        <HStack justify="space-between" align="center">
                            <Heading size="md" color="white" fontWeight="bold">Tournament Information</Heading>
                            <Button
                                size="sm"
                                colorScheme="blue"
                                variant="outline"
                                leftIcon={<RefreshCw size={16} />}
                                onClick={async () => {
                                    try {
                                        await fetchTournamentFresh();
                                        toast({
                                            title: 'Tournament refreshed',
                                            description: 'Fetched latest data from blockchain',
                                            status: 'success',
                                            duration: 2000,
                                            isClosable: true,
                                        });
                                    } catch (error) {
                                        console.error('Error refreshing tournament:', error);
                                        toast({
                                            title: 'Refresh failed',
                                            description: 'Failed to fetch fresh data',
                                            status: 'error',
                                            duration: 3000,
                                            isClosable: true,
                                        });
                                    }
                                }}
                                _hover={{
                                    bg: "blue.600",
                                    transform: "translateY(-1px)",
                                }}
                                transition="all 0.2s"
                            >
                                Refresh
                            </Button>
                        </HStack>
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
                                    {(parseFloat(tournament.entry_fee_egld.replace(',', '.')) * tournament.max_players).toFixed(4)} EGLD
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
                        </VStack>
                    </CardBody>
                </Card>

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
                                    size="lg"
                                    bgGradient="linear(135deg, teal.300, mint.400, teal.500)"
                                    color="white"
                                    borderRadius="xl"
                                    boxShadow="0 8px 25px rgba(45, 212, 191, 0.4)"
                                    _hover={{
                                        bgGradient: "linear(135deg, teal.400, mint.500, teal.600)",
                                        transform: "translateY(-2px)",
                                        boxShadow: "0 12px 30px rgba(45, 212, 191, 0.6)"
                                    }}
                                    _active={{
                                        transform: "translateY(0px)",
                                        boxShadow: "0 6px 20px rgba(45, 212, 191, 0.5)"
                                    }}
                                    transition="all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
                                    onClick={() => {
                                        // Navigate to the game session
                                        const gameType = getGameName(Number(tournament.game_id));
                                        if (gameType === 'Chess') {
                                            navigate(`/game/chess/${id}`);
                                        } else if (gameType === 'Connect Four') {
                                            navigate(`/game/connectfour/${id}`);
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

                {/* Start Game or Waiting message while in Joining status */}
                {isParticipant && tournament.status === 'Joining' && (
                    hasEnoughPlayers ? (
                        <Button
                            size="md"
                            mt={4}
                            bgGradient="linear(135deg, green.500, emerald.600, green.700)"
                            color="white"
                            borderRadius="xl"
                            boxShadow="0 8px 25px rgba(34, 197, 94, 0.4)"
                            _hover={{
                                bgGradient: "linear(135deg, green.600, emerald.700, green.800)",
                                transform: "translateY(-2px)",
                                boxShadow: "0 12px 30px rgba(34, 197, 94, 0.6)"
                            }}
                            _active={{
                                transform: "translateY(0px)",
                                boxShadow: "0 6px 20px rgba(34, 197, 94, 0.5)"
                            }}
                            transition="all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
                            isLoading={startingGame}
                            loadingText="Starting Game..."
                            onClick={handleStartGame}
                        >
                            Start Game
                        </Button>
                    ) : (
                        <Text color="gray.400" textAlign="center" mt={4}>
                            Waiting for opponents... ({tournament.current_players}/{minPlayersRequired})
                        </Text>
                    )
                )}
            </VStack>
        </Box>
    );
};

export default TournamentDetails;