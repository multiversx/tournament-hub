import React from 'react';
import { Box, Button, VStack, HStack, Text, Heading } from '@chakra-ui/react';
import { useGamingNotifications } from '../hooks/useGamingNotifications';

export const NotificationDemo: React.FC = () => {
    const {
        showSuccess,
        showError,
        showWarning,
        showInfo,
        showAchievement,
        showLevelUp,
        showVictory,
        showDefeat,
        showTransactionSuccess,
        showTransactionError,
        showGameStarted,
        showTournamentJoined,
        showTournamentCreated,
    } = useGamingNotifications();

    return (
        <Box p={8} bg="gray.900" minH="100vh">
            <VStack spacing={6} align="stretch" maxW="600px" mx="auto">
                <Heading color="white" textAlign="center" mb={8}>
                    🎮 Gaming Notification Styles
                </Heading>

                <Text color="gray.300" textAlign="center" mb={6}>
                    Click any button to see the different notification styles in action!
                </Text>

                <VStack spacing={4} align="stretch">
                    <Heading size="md" color="white">Basic Notifications</Heading>
                    <HStack spacing={3} wrap="wrap">
                        <Button onClick={() => showSuccess('Success!', 'Operation completed successfully')} colorScheme="green">
                            Success
                        </Button>
                        <Button onClick={() => showError('Error!', 'Something went wrong')} colorScheme="red">
                            Error
                        </Button>
                        <Button onClick={() => showWarning('Warning!', 'Please be careful')} colorScheme="yellow">
                            Warning
                        </Button>
                        <Button onClick={() => showInfo('Info', 'Here is some information')} colorScheme="blue">
                            Info
                        </Button>
                    </HStack>

                    <Heading size="md" color="white" mt={6}>Gaming Notifications</Heading>
                    <HStack spacing={3} wrap="wrap">
                        <Button onClick={() => showAchievement('Achievement Unlocked!', 'You completed your first tournament')} colorScheme="purple">
                            Achievement
                        </Button>
                        <Button onClick={() => showLevelUp('Level Up!', 'You reached level 5')} colorScheme="cyan">
                            Level Up
                        </Button>
                        <Button onClick={() => showVictory('Victory!', 'You won the tournament!')} colorScheme="yellow">
                            Victory
                        </Button>
                        <Button onClick={() => showDefeat('Defeat', 'Better luck next time')} colorScheme="gray">
                            Defeat
                        </Button>
                    </HStack>

                    <Heading size="md" color="white" mt={6}>Transaction Notifications</Heading>
                    <HStack spacing={3} wrap="wrap">
                        <Button onClick={() => showTransactionSuccess('Tournament Created')} colorScheme="green">
                            Transaction Success
                        </Button>
                        <Button onClick={() => showTransactionError('Join Failed', 'Insufficient funds')} colorScheme="red">
                            Transaction Error
                        </Button>
                    </HStack>

                    <Heading size="md" color="white" mt={6}>Game Notifications</Heading>
                    <HStack spacing={3} wrap="wrap">
                        <Button onClick={() => showGameStarted('Battleship')} colorScheme="blue">
                            Game Started
                        </Button>
                        <Button onClick={() => showTournamentJoined('Epic Chess Tournament')} colorScheme="purple">
                            Tournament Joined
                        </Button>
                        <Button onClick={() => showTournamentCreated('Weekly TicTacToe')} colorScheme="green">
                            Tournament Created
                        </Button>
                    </HStack>
                </VStack>

                <Box mt={8} p={4} bg="gray.800" borderRadius="md" border="1px solid" borderColor="gray.600">
                    <Text color="gray.300" fontSize="sm">
                        💡 <strong>Features:</strong> Animated borders, progress bars, sound effects,
                        vibration, auto-dismiss, hover effects, and gaming-themed styling!
                    </Text>
                </Box>
            </VStack>
        </Box>
    );
};
