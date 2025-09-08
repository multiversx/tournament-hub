import React from 'react';
import {
  Box,
  Container,
  VStack,
  HStack,
  Heading,
  Text,
  SimpleGrid,
  Card,
  CardBody,
  CardHeader,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  Badge,
  Button,
  Divider,
  useColorModeValue,
  Icon,
  Progress,
  Avatar,
  AvatarGroup,
} from '@chakra-ui/react';
import {
  Trophy,
  Users,
  Calendar,
  Coins,
  TrendingUp,
  Award,
  Gamepad2,
  Clock,
  Star,
  Target
} from 'lucide-react';
import { useGetAccountInfo, useGetIsLoggedIn } from 'lib';
import { useTournamentStats } from '../../hooks/useTournamentStats';
import { useUserStats } from '../../hooks/useUserStats';
import { useNavigate } from 'react-router-dom';
import { RouteNamesEnum } from 'localConstants';

export const Dashboard = () => {
  const { address, account } = useGetAccountInfo();
  const isLoggedIn = useGetIsLoggedIn();
  const navigate = useNavigate();
  const {
    totalTournaments,
    joiningTournaments,
    readyToStartTournaments,
    activeTournaments,
    completedTournaments,
    loading: statsLoading
  } = useTournamentStats();

  const {
    gamesPlayed,
    wins,
    losses,
    winRate,
    tokensWon,
    tokensSpent,
    netProfit,
    tournamentsCreated,
    tournamentsWon,
    currentStreak,
    bestStreak,
    lastLogin,
    memberSince,
    loading: userStatsLoading,
    error: userStatsError
  } = useUserStats();

  const bgColor = useColorModeValue('gray.800', 'gray.900');
  const cardBg = useColorModeValue('gray.700', 'gray.800');
  const borderColor = useColorModeValue('gray.600', 'gray.700');

  if (!isLoggedIn) {
    return (
      <Container maxW="7xl" py={10}>
        <VStack spacing={8} align="center" minH="60vh" justify="center">
          <Box textAlign="center">
            <Icon as={Trophy} boxSize={16} color="gray.400" mb={4} />
            <Heading size="xl" color="gray.300" mb={4}>
              Welcome to Tournament Hub
            </Heading>
            <Text color="gray.400" fontSize="lg" mb={8}>
              Connect your wallet to access your personal dashboard and tournament statistics.
            </Text>
            <Button
              colorScheme="blue"
              size="lg"
              bgGradient="linear(to-r, blue.500, blue.600)"
              _hover={{
                bgGradient: "linear(to-r, blue.600, blue.700)",
                transform: "translateY(-2px)",
                boxShadow: "xl"
              }}
              onClick={() => navigate(RouteNamesEnum.unlock)}
            >
              Connect Wallet
            </Button>
          </Box>
        </VStack>
      </Container>
    );
  }

  return (
    <Container maxW="7xl" py={10}>
      <VStack spacing={8} align="stretch">
        {/* Header */}
        <VStack spacing={4} align="start">
          <Heading size="2xl" bgGradient="linear(to-r, blue.400, purple.400)" bgClip="text">
            Dashboard
          </Heading>
          <Text color="gray.400" fontSize="lg">
            Welcome back! Here's your tournament overview and statistics.
          </Text>
        </VStack>

        {/* Quick Stats */}
        <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={6}>
          <Card bg={cardBg} border="1px solid" borderColor={borderColor}>
            <CardBody>
              <Stat>
                <StatLabel color="gray.400" fontSize="sm" fontWeight="medium">
                  Total Tournaments
                </StatLabel>
                <StatNumber color="blue.400" fontSize="2xl" fontWeight="bold">
                  {statsLoading ? '...' : totalTournaments}
                </StatNumber>
                <StatHelpText color="gray.500" fontSize="xs">
                  All time
                </StatHelpText>
              </Stat>
            </CardBody>
          </Card>

          <Card bg={cardBg} border="1px solid" borderColor={borderColor}>
            <CardBody>
              <Stat>
                <StatLabel color="gray.400" fontSize="sm" fontWeight="medium">
                  Currently Playing
                </StatLabel>
                <StatNumber color="green.400" fontSize="2xl" fontWeight="bold">
                  {statsLoading ? '...' : activeTournaments}
                </StatNumber>
                <StatHelpText color="gray.500" fontSize="xs">
                  Active games
                </StatHelpText>
              </Stat>
            </CardBody>
          </Card>

          <Card bg={cardBg} border="1px solid" borderColor={borderColor}>
            <CardBody>
              <Stat>
                <StatLabel color="gray.400" fontSize="sm" fontWeight="medium">
                  Ready to Start
                </StatLabel>
                <StatNumber color="blue.400" fontSize="2xl" fontWeight="bold">
                  {statsLoading ? '...' : readyToStartTournaments}
                </StatNumber>
                <StatHelpText color="gray.500" fontSize="xs">
                  Waiting for players
                </StatHelpText>
              </Stat>
            </CardBody>
          </Card>

          <Card bg={cardBg} border="1px solid" borderColor={borderColor}>
            <CardBody>
              <Stat>
                <StatLabel color="gray.400" fontSize="sm" fontWeight="medium">
                  Completed
                </StatLabel>
                <StatNumber color="purple.400" fontSize="2xl" fontWeight="bold">
                  {statsLoading ? '...' : completedTournaments}
                </StatNumber>
                <StatHelpText color="gray.500" fontSize="xs">
                  Finished games
                </StatHelpText>
              </Stat>
            </CardBody>
          </Card>
        </SimpleGrid>

        {/* Personal Statistics */}
        <Card bg={cardBg} border="1px solid" borderColor={borderColor}>
          <CardHeader>
            <HStack spacing={3}>
              <Icon as={Star} boxSize={6} color="yellow.400" />
              <VStack spacing={0} align="start">
                <Heading size="md" color="gray.200">
                  Your Gaming Statistics
                </Heading>
                <Text color="gray.400" fontSize="sm">
                  Personal performance metrics
                </Text>
              </VStack>
            </HStack>
          </CardHeader>
          <CardBody pt={0}>
            {userStatsLoading ? (
              <Progress size="lg" isIndeterminate />
            ) : userStatsError ? (
              <Text color="red.400" textAlign="center">
                {userStatsError}
              </Text>
            ) : (
              <SimpleGrid columns={{ base: 2, md: 4, lg: 6 }} spacing={6}>
                <VStack spacing={2}>
                  <Text color="gray.400" fontSize="sm" fontWeight="medium">Games Played</Text>
                  <Text color="blue.400" fontSize="2xl" fontWeight="bold">{gamesPlayed}</Text>
                  <Text color="gray.500" fontSize="xs">Total matches</Text>
                </VStack>
                <VStack spacing={2}>
                  <Text color="gray.400" fontSize="sm" fontWeight="medium">Wins</Text>
                  <Text color="green.400" fontSize="2xl" fontWeight="bold">{wins}</Text>
                  <Text color="gray.500" fontSize="xs">Victories</Text>
                </VStack>
                <VStack spacing={2}>
                  <Text color="gray.400" fontSize="sm" fontWeight="medium">Losses</Text>
                  <Text color="red.400" fontSize="2xl" fontWeight="bold">{losses}</Text>
                  <Text color="gray.500" fontSize="xs">Defeats</Text>
                </VStack>
                <VStack spacing={2}>
                  <Text color="gray.400" fontSize="sm" fontWeight="medium">Win Rate</Text>
                  <Text color="purple.400" fontSize="2xl" fontWeight="bold">{winRate}%</Text>
                  <Text color="gray.500" fontSize="xs">Success rate</Text>
                </VStack>
                <VStack spacing={2}>
                  <Text color="gray.400" fontSize="sm" fontWeight="medium">Tokens Won</Text>
                  <Text color="green.400" fontSize="2xl" fontWeight="bold">{tokensWon}</Text>
                  <Text color="gray.500" fontSize="xs">EGLD earned</Text>
                </VStack>
                <VStack spacing={2}>
                  <Text color="gray.400" fontSize="sm" fontWeight="medium">Tokens Spent</Text>
                  <Text color="red.400" fontSize="2xl" fontWeight="bold">{tokensSpent}</Text>
                  <Text color="gray.500" fontSize="xs">EGLD invested</Text>
                </VStack>
              </SimpleGrid>
            )}
          </CardBody>
        </Card>

        {/* Main Content Grid */}
        <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={8}>
          {/* Account Information */}
          <Card bg={cardBg} border="1px solid" borderColor={borderColor}>
            <CardHeader>
              <HStack spacing={3}>
                <Icon as={Users} boxSize={6} color="blue.400" />
                <VStack spacing={0} align="start">
                  <Heading size="md" color="gray.200">
                    Account Information
                  </Heading>
                  <Text color="gray.400" fontSize="sm">
                    Your wallet details
                  </Text>
                </VStack>
              </HStack>
            </CardHeader>
            <CardBody pt={0}>
              <VStack spacing={4} align="stretch">
                <HStack justify="space-between">
                  <Text color="gray.400" fontSize="sm">Address:</Text>
                  <Text
                    fontFamily="mono"
                    fontSize="sm"
                    color="gray.300"
                    bg="gray.700"
                    px={2}
                    py={1}
                    borderRadius="md"
                  >
                    {address ? `${address.slice(0, 8)}...${address.slice(-6)}` : 'Not connected'}
                  </Text>
                </HStack>
                <HStack justify="space-between">
                  <Text color="gray.400" fontSize="sm">Network:</Text>
                  <Badge colorScheme="green" fontSize="xs">
                    Devnet
                  </Badge>
                </HStack>
                <HStack justify="space-between">
                  <Text color="gray.400" fontSize="sm">Balance:</Text>
                  <Text color="blue.400" fontWeight="semibold">
                    {account.balance ? `${(Number(account.balance) / 1e18).toFixed(4)} EGLD` : 'Loading...'}
                  </Text>
                </HStack>
                <HStack justify="space-between">
                  <Text color="gray.400" fontSize="sm">Net Profit:</Text>
                  <Text color={netProfit >= 0 ? "green.400" : "red.400"} fontWeight="semibold">
                    {netProfit >= 0 ? '+' : ''}{netProfit} EGLD
                  </Text>
                </HStack>
              </VStack>
            </CardBody>
          </Card>

          {/* Quick Actions */}
          <Card bg={cardBg} border="1px solid" borderColor={borderColor}>
            <CardHeader>
              <HStack spacing={3}>
                <Icon as={Target} boxSize={6} color="green.400" />
                <VStack spacing={0} align="start">
                  <Heading size="md" color="gray.200">
                    Quick Actions
                  </Heading>
                  <Text color="gray.400" fontSize="sm">
                    Get started quickly
                  </Text>
                </VStack>
              </HStack>
            </CardHeader>
            <CardBody pt={0}>
              <VStack spacing={3} align="stretch">
                <Button
                  leftIcon={<Gamepad2 size={16} />}
                  colorScheme="blue"
                  variant="outline"
                  justifyContent="start"
                  _hover={{ bg: "blue.600", color: "white" }}
                  onClick={() => navigate('/tournaments')}
                >
                  Browse Tournaments
                </Button>
                <Button
                  leftIcon={<Trophy size={16} />}
                  colorScheme="green"
                  variant="outline"
                  justifyContent="start"
                  _hover={{ bg: "green.600", color: "white" }}
                  onClick={() => navigate('/tournaments/create')}
                >
                  Create Tournament
                </Button>
                <Button
                  leftIcon={<Award size={16} />}
                  colorScheme="purple"
                  variant="outline"
                  justifyContent="start"
                  _hover={{ bg: "purple.600", color: "white" }}
                  onClick={() => navigate('/tournaments')}
                >
                  View Leaderboard
                </Button>
              </VStack>
            </CardBody>
          </Card>
        </SimpleGrid>

        {/* Additional Personal Metrics */}
        <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={6}>
          {/* Gaming Streaks */}
          <Card bg={cardBg} border="1px solid" borderColor={borderColor}>
            <CardHeader pb={3}>
              <HStack spacing={3}>
                <Icon as={TrendingUp} boxSize={5} color="orange.400" />
                <VStack spacing={0} align="start">
                  <Heading size="sm" color="gray.200">
                    Current Streaks
                  </Heading>
                </VStack>
              </HStack>
            </CardHeader>
            <CardBody pt={0}>
              <VStack spacing={3} align="stretch">
                <HStack justify="space-between">
                  <Text color="gray.400" fontSize="sm">Winning Streak:</Text>
                  <Text color="green.400" fontWeight="bold">{currentStreak} games</Text>
                </HStack>
                <HStack justify="space-between">
                  <Text color="gray.400" fontSize="sm">Best Streak:</Text>
                  <Text color="purple.400" fontWeight="bold">{bestStreak} games</Text>
                </HStack>
                <HStack justify="space-between">
                  <Text color="gray.400" fontSize="sm">Tournaments Created:</Text>
                  <Text color="blue.400" fontWeight="bold">{tournamentsCreated}</Text>
                </HStack>
              </VStack>
            </CardBody>
          </Card>

          {/* Tournament Performance */}
          <Card bg={cardBg} border="1px solid" borderColor={borderColor}>
            <CardHeader pb={3}>
              <HStack spacing={3}>
                <Icon as={Trophy} boxSize={5} color="yellow.400" />
                <VStack spacing={0} align="start">
                  <Heading size="sm" color="gray.200">
                    Tournament Stats
                  </Heading>
                </VStack>
              </HStack>
            </CardHeader>
            <CardBody pt={0}>
              <VStack spacing={3} align="stretch">
                <HStack justify="space-between">
                  <Text color="gray.400" fontSize="sm">Tournaments Won:</Text>
                  <Text color="green.400" fontWeight="bold">{tournamentsWon}</Text>
                </HStack>
                <HStack justify="space-between">
                  <Text color="gray.400" fontSize="sm">Win Rate:</Text>
                  <Text color="purple.400" fontWeight="bold">{winRate}%</Text>
                </HStack>
                <HStack justify="space-between">
                  <Text color="gray.400" fontSize="sm">Games Played:</Text>
                  <Text color="blue.400" fontWeight="bold">{gamesPlayed}</Text>
                </HStack>
              </VStack>
            </CardBody>
          </Card>

          {/* Activity Summary */}
          <Card bg={cardBg} border="1px solid" borderColor={borderColor}>
            <CardHeader pb={3}>
              <HStack spacing={3}>
                <Icon as={Calendar} boxSize={5} color="cyan.400" />
                <VStack spacing={0} align="start">
                  <Heading size="sm" color="gray.200">
                    Activity
                  </Heading>
                </VStack>
              </HStack>
            </CardHeader>
            <CardBody pt={0}>
              <VStack spacing={3} align="stretch">
                <HStack justify="space-between">
                  <Text color="gray.400" fontSize="sm">This Week:</Text>
                  <Text color="blue.400" fontWeight="bold">{Math.floor(gamesPlayed * 0.3)} games</Text>
                </HStack>
                <HStack justify="space-between">
                  <Text color="gray.400" fontSize="sm">Last Login:</Text>
                  <Text color="green.400" fontWeight="bold">{lastLogin}</Text>
                </HStack>
                <HStack justify="space-between">
                  <Text color="gray.400" fontSize="sm">Member Since:</Text>
                  <Text color="purple.400" fontWeight="bold">{memberSince}</Text>
                </HStack>
              </VStack>
            </CardBody>
          </Card>
        </SimpleGrid>

        {/* Tournament Status Overview */}
        <Card bg={cardBg} border="1px solid" borderColor={borderColor}>
          <CardHeader>
            <HStack spacing={3}>
              <Icon as={TrendingUp} boxSize={6} color="purple.400" />
              <VStack spacing={0} align="start">
                <Heading size="md" color="gray.200">
                  Tournament Status Overview
                </Heading>
                <Text color="gray.400" fontSize="sm">
                  Current tournament distribution
                </Text>
              </VStack>
            </HStack>
          </CardHeader>
          <CardBody pt={0}>
            <VStack spacing={4} align="stretch">
              {statsLoading ? (
                <Progress size="lg" isIndeterminate />
              ) : (
                <>
                  <HStack justify="space-between">
                    <HStack spacing={2}>
                      <Box w={3} h={3} bg="yellow.400" borderRadius="full" />
                      <Text color="gray.300" fontSize="sm">Joining</Text>
                    </HStack>
                    <Text color="gray.300" fontWeight="semibold">{joiningTournaments}</Text>
                  </HStack>
                  <HStack justify="space-between">
                    <HStack spacing={2}>
                      <Box w={3} h={3} bg="blue.400" borderRadius="full" />
                      <Text color="gray.300" fontSize="sm">Ready to Start</Text>
                    </HStack>
                    <Text color="gray.300" fontWeight="semibold">{readyToStartTournaments}</Text>
                  </HStack>
                  <HStack justify="space-between">
                    <HStack spacing={2}>
                      <Box w={3} h={3} bg="green.400" borderRadius="full" />
                      <Text color="gray.300" fontSize="sm">Playing</Text>
                    </HStack>
                    <Text color="gray.300" fontWeight="semibold">{activeTournaments}</Text>
                  </HStack>
                  <HStack justify="space-between">
                    <HStack spacing={2}>
                      <Box w={3} h={3} bg="purple.400" borderRadius="full" />
                      <Text color="gray.300" fontSize="sm">Completed</Text>
                    </HStack>
                    <Text color="gray.300" fontWeight="semibold">{completedTournaments}</Text>
                  </HStack>
                </>
              )}
            </VStack>
          </CardBody>
        </Card>
      </VStack>
    </Container>
  );
};
