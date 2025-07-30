import React from 'react';
import {
    Box,
    VStack,
    HStack,
    Text,
    Badge,
    Card,
    CardBody,
    Progress,
    Tooltip,
    useColorModeValue,
    CardHeader,
    Heading
} from '@chakra-ui/react';
import { TournamentSession } from '../services/tournamentService';

interface Game {
    id: string;
    players: string[];
    winner?: string;
    status: string;
}

interface TournamentBracketProps {
    tournament: TournamentSession;
    currentPlayerAddress?: string;
}

export const TournamentBracket: React.FC<TournamentBracketProps> = ({
    tournament,
    currentPlayerAddress
}) => {
    const bgColor = useColorModeValue('gray.700', 'gray.800');
    const borderColor = useColorModeValue('gray.600', 'gray.700');
    const textColor = useColorModeValue('gray.100', 'white');

    if (!tournament.brackets) {
        return (
            <Card bg={bgColor} border="1px solid" borderColor={borderColor}>
                <CardBody>
                    <Text color={textColor} textAlign="center">
                        Tournament brackets will be generated when players join
                    </Text>
                </CardBody>
            </Card>
        );
    }

    const progress = getTournamentProgress(tournament);

    return (
        <VStack spacing={4} align="stretch">
            {/* Tournament Progress */}
            <Card bg={bgColor} border="1px solid" borderColor={borderColor}>
                <CardBody>
                    <VStack spacing={3}>
                        <HStack justify="space-between" w="full">
                            <Text color={textColor} fontWeight="bold">
                                Tournament Progress
                            </Text>
                            <Badge colorScheme="blue">
                                Round {progress.currentRound + 1} of {progress.totalRounds}
                            </Badge>
                        </HStack>
                        <Progress
                            value={(progress.completedGames / progress.totalGames) * 100}
                            colorScheme="blue"
                            size="lg"
                            borderRadius="md"
                        />
                        <Text color="gray.400" fontSize="sm">
                            {progress.completedGames} of {progress.totalGames} games completed
                        </Text>
                    </VStack>
                </CardBody>
            </Card>

            {/* Tournament Brackets */}
            <Card bg={bgColor} border="1px solid" borderColor={borderColor}>
                <CardHeader>
                    <Heading size="md" color={textColor}>Tournament Bracket</Heading>
                </CardHeader>
                <CardBody>
                    <VStack spacing={6} align="stretch">
                        <HStack spacing={8} align="start" overflowX="auto">
                            {tournament.brackets.map((round: Game[], roundIndex: number) => (
                                <VStack key={roundIndex} spacing={4} minW="200px">
                                    <Text color="gray.300" fontWeight="semibold">
                                        Round {roundIndex + 1}
                                    </Text>

                                    <VStack spacing={3} align="stretch">
                                        {round.map((game: Game, gameIndex: number) => (
                                            <GameCard
                                                key={gameIndex}
                                                game={game}
                                                roundIndex={roundIndex}
                                                gameIndex={gameIndex}
                                                currentPlayerAddress={currentPlayerAddress}
                                                isCurrentRound={roundIndex === tournament.current_round}
                                            />
                                        ))}
                                    </VStack>
                                </VStack>
                            ))}
                        </HStack>
                    </VStack>
                </CardBody>
            </Card>
        </VStack>
    );
};

interface GameCardProps {
    game: Game;
    roundIndex: number;
    gameIndex: number;
    currentPlayerAddress?: string;
    isCurrentRound: boolean;
}

const GameCard: React.FC<GameCardProps> = ({
    game,
    roundIndex,
    gameIndex,
    currentPlayerAddress,
    isCurrentRound
}) => {
    const bgColor = useColorModeValue('gray.700', 'gray.800');
    const borderColor = useColorModeValue('gray.600', 'gray.700');
    const textColor = useColorModeValue('gray.100', 'white');

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'waiting': return 'yellow';
            case 'playing': return 'blue';
            case 'completed': return 'green';
            case 'bye': return 'purple';
            default: return 'gray';
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case 'waiting': return 'Waiting';
            case 'playing': return 'Playing';
            case 'completed': return 'Completed';
            case 'bye': return 'Bye';
            default: return 'Unknown';
        }
    };

    const isPlayerInGame = currentPlayerAddress && game.players.includes(currentPlayerAddress);
    const isCurrentGame = isCurrentRound && game.status === 'playing';

    return (
        <Card
            bg={bgColor}
            border="1px solid"
            borderColor={isPlayerInGame ? 'blue.500' : borderColor}
            borderWidth={isPlayerInGame ? '2px' : '1px'}
            boxShadow={isCurrentGame ? '0 0 10px rgba(66, 153, 225, 0.3)' : 'none'}
        >
            <CardBody p={3}>
                <VStack spacing={2} align="stretch">
                    {/* Game Status */}
                    <HStack justify="space-between">
                        <Text color="gray.400" fontSize="xs">
                            Game {gameIndex + 1}
                        </Text>
                        <Badge colorScheme={getStatusColor(game.status)} size="sm">
                            {getStatusText(game.status)}
                        </Badge>
                    </HStack>

                    {/* Players */}
                    <VStack spacing={1} align="stretch">
                        {game.players.map((player: string, playerIndex: number) => (
                            <PlayerDisplay
                                key={playerIndex}
                                player={player}
                                isWinner={game.winner === player}
                                isCurrentPlayer={currentPlayerAddress === player}
                                isBye={game.status === 'bye' && playerIndex === 0}
                            />
                        ))}
                    </VStack>

                    {/* Winner Display */}
                    {game.winner && game.status === 'completed' && (
                        <Box
                            bg="green.900"
                            p={2}
                            borderRadius="md"
                            border="1px solid"
                            borderColor="green.600"
                        >
                            <Text color="green.300" fontSize="xs" fontWeight="bold" textAlign="center">
                                Winner: {shortenAddress(game.winner)}
                            </Text>
                        </Box>
                    )}
                </VStack>
            </CardBody>
        </Card>
    );
};

interface PlayerDisplayProps {
    player: string;
    isWinner: boolean;
    isCurrentPlayer: boolean;
    isBye: boolean;
}

const PlayerDisplay: React.FC<PlayerDisplayProps> = ({
    player,
    isWinner,
    isCurrentPlayer,
    isBye
}) => {
    const bgColor = useColorModeValue('gray.600', 'gray.700');
    const textColor = useColorModeValue('gray.100', 'white');

    let playerBg = bgColor;
    let playerColor = textColor;

    if (isWinner) {
        playerBg = 'green.700';
        playerColor = 'green.100';
    } else if (isCurrentPlayer) {
        playerBg = 'blue.700';
        playerColor = 'blue.100';
    } else if (isBye) {
        playerBg = 'purple.700';
        playerColor = 'purple.100';
    }

    return (
        <Box
            bg={playerBg}
            p={2}
            borderRadius="md"
            border="1px solid"
            borderColor={isWinner ? 'green.500' : isCurrentPlayer ? 'blue.500' : 'transparent'}
        >
            <HStack justify="space-between">
                <Text color={playerColor} fontSize="xs" fontWeight={isCurrentPlayer ? 'bold' : 'normal'}>
                    {isBye ? 'Bye' : shortenAddress(player)}
                </Text>
                {isWinner && (
                    <Badge colorScheme="green" size="xs">
                        Winner
                    </Badge>
                )}
                {isCurrentPlayer && (
                    <Badge colorScheme="blue" size="xs">
                        You
                    </Badge>
                )}
            </HStack>
        </Box>
    );
};

function shortenAddress(address: string, start = 6, end = 6): string {
    if (!address) return '';
    if (address.length <= start + end) return address;
    return `${address.slice(0, start)}...${address.slice(-end)}`;
}

function getTournamentProgress(tournament: TournamentSession): {
    currentRound: number;
    totalRounds: number;
    completedGames: number;
    totalGames: number;
} {
    if (!tournament.brackets) {
        return { currentRound: 0, totalRounds: 0, completedGames: 0, totalGames: 0 };
    }

    const totalRounds = tournament.brackets.length;
    const currentRound = tournament.current_round;

    let completedGames = 0;
    let totalGames = 0;

    tournament.brackets.forEach((round: Game[]) => {
        round.forEach((game: Game) => {
            totalGames++;
            if (game.status === 'completed') {
                completedGames++;
            }
        });
    });

    return { currentRound, totalRounds, completedGames, totalGames };
} 