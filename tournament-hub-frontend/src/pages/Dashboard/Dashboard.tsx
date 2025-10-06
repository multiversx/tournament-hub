import React, { useState } from 'react';
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
  Target,
  RefreshCw
} from 'lucide-react';
import { useGetAccountInfo, useGetIsLoggedIn } from 'lib';
import { useSimpleTournamentStats, useSimpleUserStats, testApiConnectivity } from '../../hooks/useSimpleDashboard';
import { useEnhancedTournamentStats } from '../../hooks/useEnhancedTournamentStats';
import { useNavigate } from 'react-router-dom';
import { RouteNamesEnum } from 'localConstants';
import { SkeletonLoader, StatCardSkeleton, UserStatsSkeleton } from '../../components/SkeletonLoader';
import { ProgressiveLoader, StatLoader } from '../../components/ProgressiveLoader';
import { ErrorRetry, DataLoadError } from '../../components/ErrorRetry';
import { WalletConnectionModal } from '../../components/WalletConnectionModal';
import { useWallet } from '../../contexts/WalletContext';

export const Dashboard = () => {
  const { address, account } = useGetAccountInfo();
  const isLoggedIn = useGetIsLoggedIn();
  const navigate = useNavigate();
  const { isConnected } = useWallet();
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  // Use enhanced stats hook with caching and better loading states
  const {
    totalTournaments,
    joiningTournaments,
    readyToStartTournaments,
    activeTournaments,
    completedTournaments,
    maxPrizeWon,
    totalPrizeDistributed,
    loading: statsLoading,
    refreshing: statsRefreshing,
    error: statsError,
    lastUpdated,
    hasCachedData,
    refreshStats
  } = useEnhancedTournamentStats();

  const {
    gamesPlayed,
    wins: tournamentWins,
    losses,
    winRate,
    tokensWon,
    tokensSpent,
    netProfit,
    tournamentsCreated,
    tournamentsWon,
    currentStreak,
    bestStreak,
    loading: userStatsLoading,
    error: userStatsError
  } = useSimpleUserStats();

  const bgColor = useColorModeValue('gray.800', 'gray.900');
  const cardBg = useColorModeValue('gray.700', 'gray.800');
  const borderColor = useColorModeValue('gray.600', 'gray.700');

  const handleTestApi = async () => {
    console.log('Test API button clicked!');
    try {
      const result = await testApiConnectivity();
      console.log('Test API result:', result);
    } catch (error) {
      console.error('Test API error:', error);
    }
  };

  // Handle create tournament button click
  const handleCreateTournament = () => {
    if (isConnected) {
      navigate('/tournaments/create');
    } else {
      setIsWalletModalOpen(true);
    }
  };

  // Handle wallet connection
  const handleWalletConnect = () => {
    // Close the modal first, then navigate to the unlock page to connect wallet
    setIsWalletModalOpen(false);
    navigate('/unlock');
  };

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
        <HStack justify="space-between" align="start">
          <VStack spacing={4} align="start">
            <Heading size="2xl" bgGradient="linear(to-r, blue.400, purple.400)" bgClip="text">
              Dashboard
            </Heading>
            <Text color="gray.400" fontSize="lg">
              Welcome back! Here's your tournament overview and statistics.
            </Text>
          </VStack>
          <VStack spacing={2} align="end">
            <Button
              onClick={refreshStats}
              isLoading={statsRefreshing}
              loadingText="Refreshing..."
              colorScheme="blue"
              variant="outline"
              leftIcon={<RefreshCw size={16} />}
              size="sm"
            >
              Refresh Stats
            </Button>
            {lastUpdated && (
              <Text fontSize="xs" color="gray.500">
                {hasCachedData && statsRefreshing ? 'Using cached data, refreshing...' : `Updated ${lastUpdated.toLocaleTimeString()}`}
              </Text>
            )}
          </VStack>
        </HStack>

        {/* Quick Stats */}
        {statsError ? (
          <ErrorRetry
            error={statsError}
            onRetry={refreshStats}
            isRetrying={statsRefreshing}
            variant="inline"
            title="Failed to Load Tournament Statistics"
          />
        ) : statsLoading && !hasCachedData ? (
          <StatCardSkeleton count={4} />
        ) : (
          <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={6}>
            <ProgressiveLoader isLoading={false} delay={0} animation="scale">
              <Card bg={cardBg} border="1px solid" borderColor={borderColor}>
                <CardBody>
                  <Stat>
                    <StatLabel color="gray.400" fontSize="sm" fontWeight="medium">
                      Total Tournaments
                    </StatLabel>
                    <StatLoader
                      value={totalTournaments}
                      isLoading={statsLoading}
                      delay={0}
                      color="blue.400"
                      fontSize="2xl"
                      fontWeight="bold"
                    />
                    <StatHelpText color="gray.500" fontSize="xs">
                      All time
                    </StatHelpText>
                  </Stat>
                </CardBody>
              </Card>
            </ProgressiveLoader>

            <ProgressiveLoader isLoading={false} delay={100} animation="scale">
              <Card bg={cardBg} border="1px solid" borderColor={borderColor}>
                <CardBody>
                  <Stat>
                    <StatLabel color="gray.400" fontSize="sm" fontWeight="medium">
                      Currently Playing
                    </StatLabel>
                    <StatLoader
                      value={activeTournaments}
                      isLoading={statsLoading}
                      delay={100}
                      color="green.400"
                      fontSize="2xl"
                      fontWeight="bold"
                    />
                    <StatHelpText color="gray.500" fontSize="xs">
                      Active games
                    </StatHelpText>
                  </Stat>
                </CardBody>
              </Card>
            </ProgressiveLoader>

            <ProgressiveLoader isLoading={false} delay={200} animation="scale">
              <Card bg={cardBg} border="1px solid" borderColor={borderColor}>
                <CardBody>
                  <Stat>
                    <StatLabel color="gray.400" fontSize="sm" fontWeight="medium">
                      Ready to Start
                    </StatLabel>
                    <StatLoader
                      value={readyToStartTournaments}
                      isLoading={statsLoading}
                      delay={200}
                      color="blue.400"
                      fontSize="2xl"
                      fontWeight="bold"
                    />
                    <StatHelpText color="gray.500" fontSize="xs">
                      Waiting for players
                    </StatHelpText>
                  </Stat>
                </CardBody>
              </Card>
            </ProgressiveLoader>

            <ProgressiveLoader isLoading={false} delay={300} animation="scale">
              <Card bg={cardBg} border="1px solid" borderColor={borderColor}>
                <CardBody>
                  <Stat>
                    <StatLabel color="gray.400" fontSize="sm" fontWeight="medium">
                      Completed
                    </StatLabel>
                    <StatLoader
                      value={completedTournaments}
                      isLoading={statsLoading}
                      delay={300}
                      color="purple.400"
                      fontSize="2xl"
                      fontWeight="bold"
                    />
                    <StatHelpText color="gray.500" fontSize="xs">
                      Finished games
                    </StatHelpText>
                  </Stat>
                </CardBody>
              </Card>
            </ProgressiveLoader>
          </SimpleGrid>
        )}

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
            {userStatsError ? (
              <ErrorRetry
                error={userStatsError}
                onRetry={() => window.location.reload()} // Simple refresh for user stats
                variant="inline"
                title="Failed to Load User Statistics"
              />
            ) : userStatsLoading ? (
              <UserStatsSkeleton count={6} />
            ) : (
              <SimpleGrid columns={{ base: 2, md: 4, lg: 6 }} spacing={6}>
                <ProgressiveLoader isLoading={false} delay={0} animation="fade">
                  <VStack spacing={2}>
                    <Text color="gray.400" fontSize="sm" fontWeight="medium">Games Played</Text>
                    <StatLoader
                      value={gamesPlayed}
                      isLoading={userStatsLoading}
                      delay={0}
                      color="blue.400"
                      fontSize="2xl"
                      fontWeight="bold"
                    />
                    <Text color="gray.500" fontSize="xs">Total matches</Text>
                  </VStack>
                </ProgressiveLoader>
                <ProgressiveLoader isLoading={false} delay={100} animation="fade">
                  <VStack spacing={2}>
                    <Text color="gray.400" fontSize="sm" fontWeight="medium">Wins</Text>
                    <StatLoader
                      value={tournamentWins}
                      isLoading={userStatsLoading}
                      delay={100}
                      color="green.400"
                      fontSize="2xl"
                      fontWeight="bold"
                    />
                    <Text color="gray.500" fontSize="xs">Tournament Victories</Text>
                  </VStack>
                </ProgressiveLoader>
                <ProgressiveLoader isLoading={false} delay={200} animation="fade">
                  <VStack spacing={2}>
                    <Text color="gray.400" fontSize="sm" fontWeight="medium">Losses</Text>
                    <StatLoader
                      value={losses}
                      isLoading={userStatsLoading}
                      delay={200}
                      color="red.400"
                      fontSize="2xl"
                      fontWeight="bold"
                    />
                    <Text color="gray.500" fontSize="xs">Defeats</Text>
                  </VStack>
                </ProgressiveLoader>
                <ProgressiveLoader isLoading={false} delay={300} animation="fade">
                  <VStack spacing={2}>
                    <Text color="gray.400" fontSize="sm" fontWeight="medium">Win Rate</Text>
                    <StatLoader
                      value={winRate}
                      isLoading={userStatsLoading}
                      delay={300}
                      suffix="%"
                      color="purple.400"
                      fontSize="2xl"
                      fontWeight="bold"
                    />
                    <Text color="gray.500" fontSize="xs">Success rate</Text>
                  </VStack>
                </ProgressiveLoader>
                <ProgressiveLoader isLoading={false} delay={400} animation="fade">
                  <VStack spacing={2}>
                    <Text color="gray.400" fontSize="sm" fontWeight="medium">Tokens Won</Text>
                    <StatLoader
                      value={tokensWon}
                      isLoading={userStatsLoading}
                      delay={400}
                      color="green.400"
                      fontSize="2xl"
                      fontWeight="bold"
                    />
                    <Text color="gray.500" fontSize="xs">EGLD earned</Text>
                  </VStack>
                </ProgressiveLoader>
                <ProgressiveLoader isLoading={false} delay={500} animation="fade">
                  <VStack spacing={2}>
                    <Text color="gray.400" fontSize="sm" fontWeight="medium">Tokens Spent</Text>
                    <StatLoader
                      value={tokensSpent}
                      isLoading={userStatsLoading}
                      delay={500}
                      color="red.400"
                      fontSize="2xl"
                      fontWeight="bold"
                    />
                    <Text color="gray.500" fontSize="xs">EGLD invested</Text>
                  </VStack>
                </ProgressiveLoader>
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
                  onClick={handleCreateTournament}
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
                <Button
                  leftIcon={<Target size={16} />}
                  colorScheme="orange"
                  variant="outline"
                  justifyContent="start"
                  _hover={{ bg: "orange.600", color: "white" }}
                  onClick={handleTestApi}
                >
                  Test API Connection
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
                <HStack justify="space-between">
                  <Text color="gray.400" fontSize="sm">This Week:</Text>
                  <Text color="cyan.400" fontWeight="bold">{Math.floor(gamesPlayed * 0.3)} games</Text>
                </HStack>
              </VStack>
            </CardBody>
          </Card>

          {/* Performance Summary */}
          <Card bg={cardBg} border="1px solid" borderColor={borderColor}>
            <CardHeader pb={3}>
              <HStack spacing={3}>
                <Icon as={TrendingUp} boxSize={5} color="green.400" />
                <VStack spacing={0} align="start">
                  <Heading size="sm" color="gray.200">
                    Performance
                  </Heading>
                </VStack>
              </HStack>
            </CardHeader>
            <CardBody pt={0}>
              <VStack spacing={3} align="stretch">
                <HStack justify="space-between">
                  <Text color="gray.400" fontSize="sm">Total Wins:</Text>
                  <Text color="green.400" fontWeight="bold">{tournamentWins}</Text>
                </HStack>
                <HStack justify="space-between">
                  <Text color="gray.400" fontSize="sm">Total Losses:</Text>
                  <Text color="red.400" fontWeight="bold">{losses}</Text>
                </HStack>
                <HStack justify="space-between">
                  <Text color="gray.400" fontSize="sm">Win Streak:</Text>
                  <Text color="purple.400" fontWeight="bold">{currentStreak} games</Text>
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

      {/* Wallet Connection Modal */}
      <WalletConnectionModal
        isOpen={isWalletModalOpen}
        onClose={() => setIsWalletModalOpen(false)}
        onConnect={handleWalletConnect}
      />
    </Container>
  );
};
