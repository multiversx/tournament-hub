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
import { EnhancedButton, PrimaryButton, SuccessButton, DangerButton } from '../components/EnhancedButton';
import { useTransactionButton } from '../hooks/useButtonState';
import { useTransactionButtonState } from '../hooks/useTransactionButtonState';
import { useGamingNotifications } from '../hooks/useGamingNotifications';
import { Users, Award, Calendar, Play, Trophy, CopyIcon, Clock, Coins, RefreshCw, Share2 } from 'lucide-react';
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
    const [error, setError] = useState<string | null>(null);
    const toast = useToast();
    const {
        showTransactionSuccess,
        showTransactionError,
        showGameStarted,
        showTournamentJoined,
        showWarning,
        showSuccess,
        showError,
        showInfo
    } = useGamingNotifications();
    const { address: playerAddress } = useGetAccount();
    const navigate = useNavigate();
    const { joinTournament } = useJoinTournamentTransaction();
    const [tournamentSession, setTournamentSession] = useState<TournamentSession | null>(null);
    const [lastJoinSeenAt, setLastJoinSeenAt] = useState<number>(0);

    // Add start game transaction hook
    const { startGame } = useStartGameTransaction();

    // Enhanced button state management with blockchain confirmation
    const joinButtonState = useTransactionButtonState({
        successMessage: 'Successfully joined the tournament! You are now a participant.',
        errorMessage: 'Failed to join tournament. Please try again.',
        waitForConfirmation: true,
        tournamentId: parseInt(id || '0'),
        onSuccess: async () => {
            showTournamentJoined(tournament?.name || 'this tournament');
            // Trigger immediate cache invalidation and refetch
            try {
                const { invalidateCacheByEvent, invalidateCacheByKey } = await import('../helpers');
                const tournamentId = parseInt(id || '0');
                console.log('DEBUG: Invalidating caches for tournament', tournamentId);
                invalidateCacheByKey(`tournament_details_${tournamentId}`);
                invalidateCacheByKey(`basic_${tournamentId}`);
                invalidateCacheByEvent('tournament_joined');
                invalidateCacheByEvent('tournament_updated');
                console.log('DEBUG: Cache invalidated for immediate refresh');
                await fetchTournamentFresh();
                console.log('DEBUG: Fresh tournament data fetched');
            } catch (error) {
                console.error('handleJoinTournament: Error invalidating cache:', error);
            }
        },
    });

    const startGameButtonState = useTransactionButtonState({
        successMessage: 'Transaction confirmed! Game started successfully!',
        errorMessage: 'Failed to start game. Please try again.',
        waitForConfirmation: true,
        tournamentId: parseInt(id || '0'),
        onSuccess: async () => {
            showGameStarted('Game Started!');
            // Navigate to game session after successful start
            if (tournament) {
                try {
                    console.log('Starting game session for tournament:', tournament.id, 'game type:', tournament.game_id, 'players:', tournament.participants);
                    const gameSession = await startGameSession(tournament.id.toString(), Number(tournament.game_id), tournament.participants);
                    console.log('Game session response:', gameSession);

                    // Backend returns session_id, not id
                    const sessionId = gameSession.session_id || gameSession.id;
                    if (!sessionId) {
                        throw new Error('No session ID returned from backend');
                    }

                    console.log('Navigating to game session:', sessionId);
                    // Additional safety check - user should be logged in at this point
                    if (playerAddress) {
                        // Navigate to the correct game route based on game type
                        const gameType = getGameName(Number(tournament.game_id));
                        if (gameType === 'Chess') {
                            navigate(`/game/chess/${tournament.id}`);
                        } else if (gameType === 'Connect Four') {
                            navigate(`/game/connectfour/${tournament.id}`);
                        } else if (gameType === 'Tic Tac Toe') {
                            navigate(`/game/tictactoe/${tournament.id}`);
                        } else if (gameType === 'Battleship') {
                            navigate(`/game/battleship/${tournament.id}`);
                        } else if (gameType === 'Color Rush') {
                            navigate(`/game/colorrush/${tournament.id}`);
                        } else {
                            navigate(`/game/cryptobubbles/${tournament.id}`);
                        }
                    } else {
                        console.warn('User not logged in when trying to navigate to game session');
                        showWarning('Login Required', 'Please connect your wallet to access the game session.');
                    }
                } catch (error) {
                    console.error('Error starting game session:', error);
                    showTransactionError(
                        'Game Session Failed',
                        `Failed to start game session: ${error instanceof Error ? error.message : 'Unknown error'}`
                    );
                }
            }
        },
    });


    useEffect(() => {
        async function fetchTournament() {
            setLoading(true);
            setError(null);
            try {
                if (!id) throw new Error('No tournament id');

                // Check if the requested tournament ID actually exists
                try {
                    const { getActiveTournamentIds } = await import('../helpers');
                    const allTournamentIds = await getActiveTournamentIds();

                    // Check if the requested tournament ID actually exists
                    const requestedId = BigInt(id);
                    const idExists = allTournamentIds.some(existingId => existingId === requestedId);

                    if (!idExists && allTournamentIds.length > 0) {
                        // Redirect to the most recent tournament
                        const mostRecentId = allTournamentIds[0].toString();
                        window.location.href = `/tournaments/${mostRecentId}`;
                        return;
                    } else if (!idExists && allTournamentIds.length === 0) {
                        // Redirect to tournaments list if no tournaments exist
                        window.location.href = '/tournaments';
                        return;
                    }
                } catch (error) {
                    console.error('Error checking tournament existence:', error);
                }

                // Try to get tournament details from contract first with retry
                let details = null;
                let retryCount = 0;
                const maxRetries = 3;

                while (!details && retryCount < maxRetries) {
                    details = await getTournamentDetailsFromContract(BigInt(id));

                    if (!details && retryCount < maxRetries - 1) {
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    }
                    retryCount++;
                }

                if (!details) {
                    // Fallback: try to get from backend API
                    try {
                        const response = await fetch(`${process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000'}/tournament/${id}`);
                        if (response.ok) {
                            const backendData = await response.json();
                            // Convert backend data to expected format
                            details = {
                                id: BigInt(id),
                                game_id: backendData.game_id || 1,
                                name: backendData.name || `Tournament ${id}`,
                                creator: backendData.creator || 'Unknown',
                                participants: backendData.participants || [],
                                entry_fee: backendData.entry_fee || '0',
                                status: backendData.status || 0,
                                max_players: backendData.max_players || 2,
                                min_players: backendData.min_players || 2,
                            };
                        } else {
                            throw new Error('Tournament not found in backend either');
                        }
                    } catch (backendError) {
                        console.error('Backend fallback failed:', backendError);
                        throw new Error('Tournament not found');
                    }
                }

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
                            showInfo(
                                'New Player Joined!',
                                `${addr.slice(0, 8)}...${addr.slice(-6)} joined your tournament`
                            );
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
                    showGameStarted('Game Starting!');
                }
            } catch { /* ignore */ }
        }, 1500);
        return () => { mounted = false; clearInterval(interval); };
    }, [id, tournament, playerAddress, toast]);

    const handleJoinTournament = async () => {
        if (!playerAddress) {
            showWarning('Wallet Not Connected', 'Please connect your wallet first');
            return;
        }

        await joinButtonState.execute(async () => {
            await joinTournament({
                tournamentId: parseInt(id || '0'),
                entryFee: tournament.entry_fee.toString()
            });
        });
    };

    const handleStartGame = async () => {
        if (!playerAddress) {
            showWarning('Wallet Not Connected', 'Please connect your wallet first');
            return;
        }

        await startGameButtonState.execute(async () => {
            await startGame({
                tournamentId: parseInt(id || '0'),
                gameId: Number(tournament.game_id),
                participants: tournament.participants,
            });
        });
    };

    const columns = useBreakpointValue({ base: 1, md: 2 });

    if (loading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" h="96">
                <VStack spacing={4}>
                    <Spinner size="xl" color="blue.500" />
                    <Text>Loading tournament details...</Text>
                    <Text fontSize="sm" color="gray.500" textAlign="center">
                        This may take a few moments as we verify the tournament on the blockchain...
                    </Text>
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
        if (joinButtonState.isConfirming) return 'Waiting for confirmation...';
        return 'Join Tournament';
    };

    const getStartButtonText = () => {
        if (startGameButtonState.isConfirming) return 'Waiting for confirmation...';
        return 'Start Game';
    };

    const handleShareTournament = async () => {
        const tournamentUrl = window.location.href;
        const shareText = `Join my tournament "${tournament.name}" on Tournament Hub! Entry fee: ${tournament.entry_fee_egld} EGLD. ${tournamentUrl}`;

        if (navigator.share) {
            try {
                await navigator.share({
                    title: `Tournament: ${tournament.name}`,
                    text: shareText,
                    url: tournamentUrl,
                });
            } catch (error) {
                // User cancelled sharing
                console.log('Share cancelled');
            }
        } else {
            // Fallback: copy to clipboard
            try {
                await navigator.clipboard.writeText(shareText);
                showSuccess('Link Copied!', 'Tournament link copied to clipboard');
            } catch (error) {
                console.error('Failed to copy to clipboard:', error);
                showError('Copy Failed', 'Please copy the URL manually from the address bar');
            }
        }
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
                            <SuccessButton
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
                                status={startGameButtonState.status}
                                loadingText="Waiting for confirmation..."
                                successText="Game Started!"
                                errorText="Start Failed"
                                enableShimmer={startGameButtonState.isLoading || startGameButtonState.isConfirming}
                            >
                                {getStartButtonText()}
                            </SuccessButton>
                        ) : (tournament.status === 'ReadyToStart' && isParticipant && isCreator && !hasEnoughPlayers) ? (
                            <VStack spacing={3}>
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
                                    leftIcon={<Users size={20} />}
                                >
                                    Waiting for opponents... ({tournament.current_players}/{minPlayersRequired})
                                </Button>
                                <HStack spacing={3} justify="center">
                                    <Text fontSize="sm" color="gray.400" textAlign="center">
                                        💡 Share this tournament to invite players!
                                    </Text>
                                    <Button
                                        size="sm"
                                        colorScheme="blue"
                                        variant="outline"
                                        leftIcon={<Share2 size={14} />}
                                        onClick={handleShareTournament}
                                        _hover={{
                                            bg: "blue.50",
                                            transform: "translateY(-1px)"
                                        }}
                                        transition="all 0.2s"
                                    >
                                        Share
                                    </Button>
                                </HStack>
                            </VStack>
                        ) : (
                            <PrimaryButton
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
                                status={joinButtonState.status}
                                loadingText="Waiting for confirmation..."
                                successText="Joined Successfully!"
                                errorText="Join Failed"
                                isDisabled={!canJoin}
                                enableShimmer={joinButtonState.isLoading || joinButtonState.isConfirming}
                                tooltip={!canJoin ? "Cannot join this tournament" : undefined}
                            >
                                {getJoinButtonText()}
                            </PrimaryButton>
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
                                        showSuccess('Tournament Refreshed', 'Fetched latest data from blockchain');
                                    } catch (error) {
                                        console.error('Error refreshing tournament:', error);
                                        showError('Refresh Failed', 'Failed to fetch fresh data');
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
                                        // Check if user is logged in before navigating to game
                                        if (!playerAddress) {
                                            showWarning(
                                                'Login Required',
                                                'Please connect your wallet to watch or participate in games. Only logged-in users can access game sessions.'
                                            );
                                            return;
                                        }

                                        // Navigate to the game session
                                        const gameType = getGameName(Number(tournament.game_id));
                                        if (gameType === 'Chess') {
                                            navigate(`/game/chess/${id}`);
                                        } else if (gameType === 'Connect Four') {
                                            navigate(`/game/connectfour/${id}`);
                                        } else if (gameType === 'Tic Tac Toe') {
                                            navigate(`/game/tictactoe/${id}`);
                                        } else if (gameType === 'Battleship') {
                                            navigate(`/game/battleship/${id}`);
                                        } else if (gameType === 'Color Rush') {
                                            navigate(`/game/colorrush/${id}`);
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
                                                showSuccess('Hash Copied!', 'Transaction hash copied to clipboard');
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
                        <SuccessButton
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
                            onClick={handleStartGame}
                            status={startGameButtonState.status}
                            loadingText="Waiting for confirmation..."
                            successText="Game Started!"
                            errorText="Start Failed"
                            enableShimmer={startGameButtonState.isLoading || startGameButtonState.isConfirming}
                            leftIcon={<Play size={20} />}
                        >
                            {getStartButtonText()}
                        </SuccessButton>
                    ) : (
                        <Box textAlign="center" mt={6}>
                            {/* Enhanced waiting message for creators */}
                            {isCreator ? (
                                <VStack spacing={4}>
                                    <Box
                                        p={6}
                                        bgGradient="linear(135deg, purple.500, pink.600)"
                                        borderRadius="xl"
                                        border="1px solid"
                                        borderColor="purple.400"
                                        boxShadow="0 8px 25px rgba(147, 51, 234, 0.3)"
                                    >
                                        <VStack spacing={3}>
                                            <Box
                                                display="flex"
                                                alignItems="center"
                                                justifyContent="center"
                                                w={12}
                                                h={12}
                                                borderRadius="full"
                                                bg="whiteAlpha.200"
                                                animation="pulse 2s infinite"
                                            >
                                                <Users size={24} color="white" />
                                            </Box>
                                            <Text fontSize="lg" fontWeight="bold" color="white">
                                                Waiting for Players to Join
                                            </Text>
                                            <Text fontSize="sm" color="whiteAlpha.800" textAlign="center">
                                                You need {minPlayersRequired - tournament.current_players} more player{minPlayersRequired - tournament.current_players !== 1 ? 's' : ''} to start the tournament
                                            </Text>
                                            <HStack spacing={2} justify="center">
                                                <Badge colorScheme="purple" variant="solid" px={3} py={1} borderRadius="full">
                                                    {tournament.current_players}/{minPlayersRequired} Players
                                                </Badge>
                                                <Badge colorScheme="blue" variant="outline" px={3} py={1} borderRadius="full" borderColor="whiteAlpha.300" color="whiteAlpha.800">
                                                    {tournament.entry_fee_egld} EGLD Entry
                                                </Badge>
                                            </HStack>
                                            <Button
                                                size="sm"
                                                bg="white"
                                                color="purple.600"
                                                variant="solid"
                                                leftIcon={<Share2 size={16} />}
                                                onClick={handleShareTournament}
                                                _hover={{
                                                    bg: "whiteAlpha.900",
                                                    transform: "translateY(-1px)",
                                                    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)"
                                                }}
                                                _active={{
                                                    transform: "translateY(0px)"
                                                }}
                                                transition="all 0.2s"
                                                fontWeight="semibold"
                                                boxShadow="0 2px 8px rgba(0, 0, 0, 0.2)"
                                            >
                                                Share Tournament
                                            </Button>
                                        </VStack>
                                    </Box>

                                    {/* Tips for creators */}
                                    <Box
                                        p={4}
                                        bg="gray.800"
                                        borderRadius="lg"
                                        border="1px solid"
                                        borderColor="gray.700"
                                        maxW="md"
                                        mx="auto"
                                    >
                                        <Text fontSize="sm" color="gray.300" textAlign="center" mb={2}>
                                            💡 <strong>Tips to attract players:</strong>
                                        </Text>
                                        <VStack spacing={1} align="start" fontSize="xs" color="gray.400">
                                            <Text>• Share the tournament link with friends</Text>
                                            <Text>• Lower the entry fee if no one joins quickly</Text>
                                            <Text>• Check the Tournaments page to see if others are looking for games</Text>
                                        </VStack>
                                    </Box>
                                </VStack>
                            ) : (
                                <Text color="gray.400" textAlign="center" mt={4}>
                                    Waiting for opponents... ({tournament.current_players}/{minPlayersRequired})
                                </Text>
                            )}
                        </Box>
                    )
                )}
            </VStack>
        </Box>
    );
};

export default TournamentDetails;