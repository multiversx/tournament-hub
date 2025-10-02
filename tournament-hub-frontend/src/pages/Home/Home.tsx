import { Outlet, Link as RouterLink } from 'react-router-dom';
import { useEffect } from 'react';
import {
  Box,
  Heading,
  Text,
  Button,
  VStack,
  HStack,
  SimpleGrid,
  useBreakpointValue,
  Stat,
  StatLabel,
  StatNumber,
  StatGroup,
  Container,
  Spinner,
  Skeleton,
} from '@chakra-ui/react';
import { Trophy, Users, Calendar, Plus, Gamepad2, Coins, Gem } from 'lucide-react';
import { PageWrapper } from 'wrappers';
import { useTournamentStats } from '../../hooks/useTournamentStatsEventBased';
import { useEnhancedTournamentStats } from '../../hooks/useEnhancedTournamentStats';
import { UpcomingTournaments } from '../../components/UpcomingTournaments';
import { useWallet } from '../../contexts/WalletContext';
import { triggerBlockchainEventPolling, resetBlockchainEventTimestamp } from '../../services/BlockchainEventService';
import { SkeletonLoader, StatCardSkeleton } from '../../components/SkeletonLoader';
import { ProgressiveLoader, StatLoader } from '../../components/ProgressiveLoader';
import { ErrorRetry } from '../../components/ErrorRetry';

export const Home = () => {
  const isMobile = useBreakpointValue({ base: true, md: false });
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

  // Debug logging
  console.log('Home component - Prize values:', { maxPrizeWon, totalPrizeDistributed });
  const { isConnected } = useWallet();

  // Listen for tournament creation events to refresh stats
  useEffect(() => {
    const handleTournamentCreated = (event: CustomEvent) => {
      console.log('Home page: Tournament created event received, refreshing stats...', event.detail);
      if (refreshStats) {
        refreshStats();
      }
    };

    window.addEventListener('tournament_created', handleTournamentCreated as EventListener);

    return () => {
      window.removeEventListener('tournament_created', handleTournamentCreated as EventListener);
    };
  }, [refreshStats]);

  // Add active polling like the Tournaments page to ensure updates
  useEffect(() => {
    let mounted = true;
    let lastSeenTs = 0;
    let pollInterval = 3000; // Poll every 3 seconds for stats updates

    const pollForUpdates = async () => {
      if (!mounted) return;

      try {
        // Import the notifier function
        const { getRecentNotifierEvents } = await import('../../helpers');
        const events = await getRecentNotifierEvents();

        if (!mounted || events.length === 0) {
          return;
        }

        // Process only new events
        const newEvents = events.filter(e => e.ts > lastSeenTs);
        if (newEvents.length === 0) {
          return;
        }

        lastSeenTs = Math.max(lastSeenTs, ...newEvents.map(e => e.ts));

        // Check for tournament-related events
        const tournamentEvents = newEvents.filter(e =>
          e.identifier === 'tournamentCreated' ||
          e.identifier === 'playerJoined' ||
          e.identifier === 'tournamentStarted' ||
          e.identifier === 'tournamentCompleted'
        );

        if (tournamentEvents.length > 0) {
          console.log('Home page: New tournament events detected, refreshing stats...', tournamentEvents);
          if (refreshStats) {
            refreshStats();
          }
        }
      } catch (error) {
        console.error('Home page: Error polling for updates:', error);
      }
    };

    // Start polling
    const interval = setInterval(pollForUpdates, pollInterval);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [refreshStats]);

  // Refresh stats when page becomes visible (user switches back to tab)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && refreshStats) {
        console.log('Home page: Page became visible, refreshing stats...');
        refreshStats();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [refreshStats]);

  const handleTestEvent = () => {
    console.log('Testing event system...');
    window.dispatchEvent(new CustomEvent('tournament_created', {
      detail: {
        event: 'tournament_created',
        timestamp: Date.now(),
        source: 'manual_test'
      }
    }));
  };

  const handleSimulateTournamentCreation = () => {
    console.log('Simulating tournament creation event...');
    // Simulate the exact same event that should be dispatched during tournament creation
    window.dispatchEvent(new CustomEvent('tournament_created', {
      detail: {
        event: 'tournament_created',
        timestamp: Date.now(),
        source: 'tournament_creation_immediate',
        sessionId: 'test-session-123'
      }
    }));
  };

  const handlePollBlockchainEvents = () => {
    console.log('Manually polling blockchain events...');
    triggerBlockchainEventPolling();
  };

  const handleResetTimestamp = () => {
    console.log('Resetting blockchain event timestamp...');
    resetBlockchainEventTimestamp();
  };

  const handleTestNotifierEndpoint = async () => {
    console.log('Testing notifier endpoint...');
    try {
      const response = await fetch('/api/notifier/recent');
      console.log('Notifier response status:', response.status);
      console.log('Notifier response headers:', response.headers);

      if (response.ok) {
        const data = await response.json();
        console.log('Notifier data:', data);
      } else {
        console.error('Notifier endpoint error:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Notifier endpoint test failed:', error);
    }
  };

  const handleInjectTestEvent = async () => {
    console.log('Injecting test event to backend...');
    try {
      const url = '/api/notifier/inject-event';
      console.log('POST request to:', url);
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          identifier: 'tournamentCreated',
          tournament_id: 35, // Use a realistic tournament ID
          game_id: 1,
          player: 'erd1test...'
        })
      });

      console.log('Inject response status:', response.status, response.statusText);
      if (response.ok) {
        const data = await response.json();
        console.log('Test event injected:', data);
        // Now poll for the event
        setTimeout(() => {
          console.log('Polling for injected event...');
          triggerBlockchainEventPolling();
        }, 1000);
      } else {
        console.error('Failed to inject test event:', response.status, response.statusText);
        const errorText = await response.text();
        console.error('Error response:', errorText);
      }
    } catch (error) {
      console.error('Error injecting test event:', error);
    }
  };

  const handleSimulateBlockchainEvent = () => {
    console.log('Simulating blockchain event from notifier...');
    // Simulate the exact event structure that should come from the backend notifier
    const mockEvent = {
      identifier: 'tournamentCreated',
      tournament_id: 999,
      ts: Date.now(),
      game_id: 1,
      player: 'erd1test...'
    };

    // Dispatch the event as if it came from the blockchain event service
    window.dispatchEvent(new CustomEvent('tournament_created', {
      detail: {
        event: 'tournament_created',
        blockchainEvent: mockEvent,
        timestamp: Date.now(),
        source: 'blockchain_event_service'
      }
    }));
  };

  return (
    <PageWrapper>
      <Container maxW="6xl" py={8}>
        <VStack spacing={8} align="stretch">
          {/* Cool Hero Section with Gradient Background */}
          <Box
            textAlign={{ base: 'center', md: 'left' }}
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
            <VStack spacing={6} align={{ base: 'center', md: 'start' }}>
              <VStack spacing={3} align={{ base: 'center', md: 'start' }}>
                <Box position="relative">
                  <Heading
                    size="3xl"
                    bgGradient="linear(135deg, blue.400, purple.500, pink.400, blue.400)"
                    bgClip="text"
                    fontWeight="extrabold"
                    letterSpacing="-0.02em"
                    lineHeight="1.1"
                    position="relative"
                    _before={{
                      content: '""',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      background: 'linear(135deg, blue.400, purple.500, pink.400, blue.400)',
                      filter: 'blur(20px)',
                      opacity: 0.3,
                      zIndex: -1
                    }}
                  >
                    Tournament Hub
                  </Heading>
                </Box>
                <Text
                  fontSize="lg"
                  color="gray.300"
                  maxW="2xl"
                  fontWeight="medium"
                  lineHeight="1.4"
                >
                  Join competitive tournaments, compete with players worldwide, and win prizes on the MultiversX blockchain.
                </Text>
                {!isConnected && (
                  <Text
                    fontSize="md"
                    color="gray.400"
                    fontWeight="normal"
                  >
                    Connect your wallet to get started.
                  </Text>
                )}
                {isConnected && (
                  <Text
                    fontSize="md"
                    color="green.400"
                    fontWeight="normal"
                  >
                    Welcome! Your wallet is connected and ready to play.
                  </Text>
                )}
              </VStack>

              {/* Cool Stats Section with Gradients */}
              <Box
                w="full"
                maxW="4xl"
                p={6}
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

                <VStack spacing={4} w="full" position="relative">
                  <HStack spacing={3} align="center" justify="center" w="full">
                    <Box
                      p={2}
                      bgGradient="linear(135deg, blue.500, purple.600)"
                      borderRadius="xl"
                      boxShadow="0 8px 20px rgba(59, 130, 246, 0.3)"
                    >
                      <Trophy size={20} color="white" />
                    </Box>
                    <Text fontSize="sm" color="blue.300" fontWeight="bold" textTransform="uppercase" letterSpacing="0.05em">
                      Tournament Statistics
                    </Text>
                  </HStack>


                  {statsError ? (
                    <ErrorRetry
                      error={statsError}
                      onRetry={refreshStats}
                      isRetrying={statsRefreshing}
                      variant="inline"
                      title="Failed to Load Tournament Statistics"
                    />
                  ) : statsLoading && !hasCachedData ? (
                    <SkeletonLoader variant="stat-card" count={4} />
                  ) : (
                    <>
                      <SimpleGrid columns={{ base: 2, md: 3, lg: 4 }} spacing={{ base: 6, md: 6, lg: 8 }} w="full">
                        <ProgressiveLoader isLoading={false} delay={0} animation="scale">
                          <VStack spacing={3}>
                            <Box
                              p={3}
                              w="88px"
                              h="88px"
                              display="flex"
                              alignItems="center"
                              justifyContent="center"
                              bgGradient="linear(135deg, yellow.500, orange.600)"
                              borderRadius="xl"
                              boxShadow="0 8px 20px rgba(250, 204, 21, 0.3)"
                              border={statsError ? "2px solid" : "none"}
                              borderColor={statsError ? "orange.400" : "transparent"}
                              _hover={{
                                transform: "scale(1.05)",
                                boxShadow: "0 12px 25px rgba(250, 204, 21, 0.4)"
                              }}
                              transition="all 0.3s ease"
                              position="relative"
                            >
                              <StatLoader
                                value={joiningTournaments}
                                isLoading={statsLoading}
                                delay={0}
                                color="white"
                                fontSize="3xl"
                                fontWeight="bold"
                              />
                            </Box>
                            <Text fontSize="sm" color="yellow.300" fontWeight="semibold">Joining</Text>
                          </VStack>
                        </ProgressiveLoader>

                        <ProgressiveLoader isLoading={false} delay={100} animation="scale">
                          <VStack spacing={3}>
                            <Box
                              p={3}
                              w="88px"
                              h="88px"
                              display="flex"
                              alignItems="center"
                              justifyContent="center"
                              bgGradient="linear(135deg, blue.500, blue.600)"
                              borderRadius="xl"
                              boxShadow="0 8px 20px rgba(59, 130, 246, 0.3)"
                              border={statsError ? "2px solid" : "none"}
                              borderColor={statsError ? "orange.400" : "transparent"}
                              _hover={{
                                transform: "scale(1.05)",
                                boxShadow: "0 12px 25px rgba(59, 130, 246, 0.4)"
                              }}
                              transition="all 0.3s ease"
                              position="relative"
                            >
                              <StatLoader
                                value={readyToStartTournaments}
                                isLoading={statsLoading}
                                delay={100}
                                color="white"
                                fontSize="3xl"
                                fontWeight="bold"
                              />
                            </Box>
                            <Text fontSize="sm" color="blue.300" fontWeight="semibold">Ready to Start</Text>
                          </VStack>
                        </ProgressiveLoader>

                        <ProgressiveLoader isLoading={false} delay={200} animation="scale">
                          <VStack spacing={3}>
                            <Box
                              p={3}
                              w="88px"
                              h="88px"
                              display="flex"
                              alignItems="center"
                              justifyContent="center"
                              bgGradient="linear(135deg, green.500, green.600)"
                              borderRadius="xl"
                              boxShadow="0 8px 20px rgba(34, 197, 94, 0.3)"
                              border={statsError ? "2px solid" : "none"}
                              borderColor={statsError ? "orange.400" : "transparent"}
                              _hover={{
                                transform: "scale(1.05)",
                                boxShadow: "0 12px 25px rgba(34, 197, 94, 0.4)"
                              }}
                              transition="all 0.3s ease"
                              position="relative"
                            >
                              <StatLoader
                                value={activeTournaments}
                                isLoading={statsLoading}
                                delay={200}
                                color="white"
                                fontSize="3xl"
                                fontWeight="bold"
                              />
                            </Box>
                            <Text fontSize="sm" color="green.300" fontWeight="semibold">Playing</Text>
                          </VStack>
                        </ProgressiveLoader>

                        <ProgressiveLoader isLoading={false} delay={300} animation="scale">
                          <VStack spacing={3}>
                            <Box
                              p={3}
                              w="88px"
                              h="88px"
                              display="flex"
                              alignItems="center"
                              justifyContent="center"
                              bgGradient="linear(135deg, purple.500, pink.600)"
                              borderRadius="xl"
                              boxShadow="0 8px 20px rgba(147, 51, 234, 0.3)"
                              border={statsError ? "2px solid" : "none"}
                              borderColor={statsError ? "orange.400" : "transparent"}
                              _hover={{
                                transform: "scale(1.05)",
                                boxShadow: "0 12px 25px rgba(147, 51, 234, 0.4)"
                              }}
                              transition="all 0.3s ease"
                              position="relative"
                            >
                              <StatLoader
                                value={completedTournaments}
                                isLoading={statsLoading}
                                delay={300}
                                color="white"
                                fontSize="3xl"
                                fontWeight="bold"
                              />
                            </Box>
                            <Text fontSize="sm" color="purple.300" fontWeight="semibold">Completed</Text>
                          </VStack>
                        </ProgressiveLoader>

                      </SimpleGrid>

                      {/* Prize Statistics Row - Separate grid for better spacing */}
                      <SimpleGrid columns={{ base: 2, lg: 2 }} spacing={{ base: 6, lg: 12 }} w="full" mt={6}>
                        <VStack spacing={3}>
                          <Box
                            p={3}
                            w="88px"
                            h="88px"
                            display="flex"
                            alignItems="center"
                            justifyContent="center"
                            bgGradient="linear(135deg, #00D4AA, #00B894)"
                            borderRadius="xl"
                            boxShadow="0 8px 20px rgba(0, 212, 170, 0.3)"
                            border={statsError ? "2px solid" : "none"}
                            borderColor={statsError ? "orange.400" : "transparent"}
                            _hover={{
                              transform: "scale(1.05)",
                              boxShadow: "0 12px 25px rgba(0, 212, 170, 0.4)"
                            }}
                            transition="all 0.3s ease"
                            position="relative"
                          >
                            <VStack spacing={1}>
                              <Box>
                                {statsLoading ? (
                                  <Text
                                    color="white"
                                    fontSize="3xl"
                                    fontWeight="bold"
                                    opacity={0.6}
                                    filter="blur(1px)"
                                  >
                                    ---
                                  </Text>
                                ) : (
                                  <Text
                                    color="white"
                                    fontSize="3xl"
                                    fontWeight="bold"
                                    dangerouslySetInnerHTML={{
                                      __html: (() => {
                                        const integer = Math.floor(maxPrizeWon);
                                        const decimal = Math.round((maxPrizeWon - integer) * 100);
                                        return `${integer}<sup style="font-size: 0.6em; vertical-align: super;">${decimal}</sup>`;
                                      })()
                                    }}
                                  />
                                )}
                              </Box>
                              <Text fontSize="xs" color="rgba(255,255,255,0.7)" fontWeight="medium">
                                EGLD
                              </Text>
                            </VStack>
                          </Box>
                          <Text fontSize="sm" color="#00D4AA" fontWeight="semibold">Max Prize</Text>
                          {maxPrizeWon === 0 && (
                            <Text fontSize="xs" color="gray.400" textAlign="center">
                              No prizes won yet
                            </Text>
                          )}
                        </VStack>

                        <VStack spacing={3}>
                          <Box
                            p={3}
                            w="88px"
                            h="88px"
                            display="flex"
                            alignItems="center"
                            justifyContent="center"
                            bgGradient="linear(135deg, #00D4AA, #00A085)"
                            borderRadius="xl"
                            boxShadow="0 8px 20px rgba(0, 212, 170, 0.3)"
                            border={statsError ? "2px solid" : "none"}
                            borderColor={statsError ? "orange.400" : "transparent"}
                            _hover={{
                              transform: "scale(1.05)",
                              boxShadow: "0 12px 25px rgba(0, 212, 170, 0.4)"
                            }}
                            transition="all 0.3s ease"
                            position="relative"
                          >
                            <VStack spacing={1}>
                              <Box>
                                {statsLoading ? (
                                  <Text
                                    color="white"
                                    fontSize="3xl"
                                    fontWeight="bold"
                                    opacity={0.6}
                                    filter="blur(1px)"
                                  >
                                    ---
                                  </Text>
                                ) : (
                                  <Text
                                    color="white"
                                    fontSize="3xl"
                                    fontWeight="bold"
                                    dangerouslySetInnerHTML={{
                                      __html: (() => {
                                        const integer = Math.floor(totalPrizeDistributed);
                                        const decimal = Math.round((totalPrizeDistributed - integer) * 100);
                                        return `${integer}<sup style="font-size: 0.6em; vertical-align: super;">${decimal}</sup>`;
                                      })()
                                    }}
                                  />
                                )}
                              </Box>
                              <Text fontSize="xs" color="rgba(255,255,255,0.7)" fontWeight="medium">
                                EGLD
                              </Text>
                            </VStack>
                          </Box>
                          <Text fontSize="sm" color="#00D4AA" fontWeight="semibold" textAlign="center">Total Prize Distribution</Text>
                          {totalPrizeDistributed === 0 && (
                            <Text fontSize="xs" color="gray.400" textAlign="center">
                              No prizes distributed yet
                            </Text>
                          )}
                        </VStack>
                      </SimpleGrid>
                    </>
                  )}

                  {(statsError || statsRefreshing) && (
                    <HStack spacing={3} mt={2} justify="center">
                      {statsRefreshing && (
                        <HStack spacing={2}>
                          <Spinner size="xs" color="blue.400" />
                          <Text fontSize="xs" color="blue.400" textAlign="center">
                            {hasCachedData ? 'Using cached data, refreshing...' : 'Updating...'}
                          </Text>
                        </HStack>
                      )}
                      {statsError && (
                        <>
                          <Text fontSize="xs" color="orange.400" textAlign="center">
                            Stats may be outdated
                          </Text>
                          <Button
                            size="xs"
                            colorScheme="orange"
                            variant="ghost"
                            onClick={refreshStats}
                            leftIcon={<Trophy size={14} />}
                          >
                            Refresh
                          </Button>
                        </>
                      )}
                    </HStack>
                  )}

                  {/* Debug button for prize stats */}
                  <HStack justify="center" mt={4}>
                    <Button
                      size="sm"
                      colorScheme="blue"
                      variant="outline"
                      onClick={refreshStats}
                      leftIcon={<Trophy size={14} />}
                    >
                      Force Refresh Stats
                    </Button>
                    <Button
                      size="sm"
                      colorScheme="red"
                      variant="outline"
                      onClick={() => {
                        localStorage.clear();
                        window.location.reload();
                      }}
                      leftIcon={<Trophy size={14} />}
                    >
                      Clear Cache & Reload
                    </Button>
                  </HStack>

                  {/* Cool Action Buttons with Enhanced Gradients */}
                  <HStack spacing={4} flexWrap="wrap" justify="center" w="full">
                    <Button
                      as={RouterLink}
                      to="/tournaments"
                      leftIcon={<Trophy size={18} />}
                      size="lg"
                      px={8}
                      py={6}
                      fontSize="lg"
                      fontWeight="bold"
                      bgGradient="linear(135deg, blue.500, purple.600, blue.700)"
                      color="white"
                      borderRadius="xl"
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
                      <Text>View Tournaments</Text>
                    </Button>

                    <Button
                      as={RouterLink}
                      to="/tournaments/create"
                      leftIcon={<Plus size={18} />}
                      size="lg"
                      px={8}
                      py={6}
                      fontSize="lg"
                      fontWeight="bold"
                      bgGradient="linear(135deg, green.500, emerald.600, green.700)"
                      color="white"
                      borderRadius="xl"
                      boxShadow="0 10px 30px rgba(34, 197, 94, 0.4)"
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
                </VStack>
              </Box>


              {/* Cool Features Grid */}
              <VStack spacing={6} align="center">
                <VStack spacing={3} align="center">
                  <Box position="relative">
                    <Heading
                      size="xl"
                      textAlign="center"
                      fontWeight="bold"
                      bgGradient="linear(135deg, blue.400, purple.500, pink.400)"
                      bgClip="text"
                    >
                      Why Choose Tournament Hub?
                    </Heading>
                  </Box>
                  <Text color="gray.400" textAlign="center" maxW="2xl" fontSize="md" fontWeight="medium">
                    Experience the future of competitive gaming on the blockchain
                  </Text>
                </VStack>

                <SimpleGrid columns={{ base: 1, md: 3 }} spacing={8} justifyItems="center">
                  <Box
                    p={8}
                    bgGradient="linear(135deg, gray.800, gray.900)"
                    borderRadius="2xl"
                    border="2px solid"
                    borderColor="gray.600"
                    position="relative"
                    overflow="hidden"
                    w="full"
                    maxW="sm"
                    _hover={{
                      borderColor: "blue.400",
                      transform: "translateY(-5px)",
                      boxShadow: "0 25px 50px rgba(59, 130, 246, 0.3)"
                    }}
                    transition="all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
                  >
                    {/* Animated Background */}
                    <Box
                      position="absolute"
                      top={0}
                      left={0}
                      right={0}
                      h="4px"
                      bgGradient="linear(90deg, blue.500, blue.600, blue.500)"
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

                    <VStack spacing={6} align="center">
                      <Box
                        p={4}
                        bgGradient="linear(135deg, blue.500, blue.600)"
                        borderRadius="2xl"
                        boxShadow="0 10px 30px rgba(59, 130, 246, 0.4)"
                        _hover={{
                          transform: "scale(1.1)",
                          boxShadow: "0 15px 40px rgba(59, 130, 246, 0.6)"
                        }}
                        transition="all 0.3s ease"
                      >
                        <Trophy size={28} color="white" />
                      </Box>
                      <VStack spacing={4} align="center">
                        <Heading size="lg" textAlign="center" fontWeight="bold" color="white">
                          Competitive Gaming
                        </Heading>
                        <Text color="gray.300" textAlign="center" lineHeight="1.6" fontSize="md">
                          Join tournaments with players from around the world and compete for prizes on the blockchain.
                        </Text>
                      </VStack>
                    </VStack>
                  </Box>

                  <Box
                    p={8}
                    bgGradient="linear(135deg, gray.800, gray.900)"
                    borderRadius="2xl"
                    border="2px solid"
                    borderColor="gray.600"
                    position="relative"
                    overflow="hidden"
                    w="full"
                    maxW="sm"
                    _hover={{
                      borderColor: "green.400",
                      transform: "translateY(-5px)",
                      boxShadow: "0 25px 50px rgba(34, 197, 94, 0.3)"
                    }}
                    transition="all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
                  >
                    {/* Animated Background */}
                    <Box
                      position="absolute"
                      top={0}
                      left={0}
                      right={0}
                      h="4px"
                      bgGradient="linear(90deg, green.500, green.600, green.500)"
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

                    <VStack spacing={6} align="center">
                      <Box
                        p={4}
                        bgGradient="linear(135deg, green.500, green.600)"
                        borderRadius="2xl"
                        boxShadow="0 10px 30px rgba(34, 197, 94, 0.4)"
                        _hover={{
                          transform: "scale(1.1)",
                          boxShadow: "0 15px 40px rgba(34, 197, 94, 0.6)"
                        }}
                        transition="all 0.3s ease"
                      >
                        <Users size={28} color="white" />
                      </Box>
                      <VStack spacing={4} align="center">
                        <Heading size="lg" textAlign="center" fontWeight="bold" color="white">
                          Community Driven
                        </Heading>
                        <Text color="gray.300" textAlign="center" lineHeight="1.6" fontSize="md">
                          Create and manage your own tournaments or join existing ones. Build your gaming community.
                        </Text>
                      </VStack>
                    </VStack>
                  </Box>

                  <Box
                    p={8}
                    bgGradient="linear(135deg, gray.800, gray.900)"
                    borderRadius="2xl"
                    border="2px solid"
                    borderColor="gray.600"
                    position="relative"
                    overflow="hidden"
                    w="full"
                    maxW="sm"
                    _hover={{
                      borderColor: "purple.400",
                      transform: "translateY(-5px)",
                      boxShadow: "0 25px 50px rgba(147, 51, 234, 0.3)"
                    }}
                    transition="all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
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

                    <VStack spacing={6} align="center">
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
                        <Calendar size={28} color="white" />
                      </Box>
                      <VStack spacing={4} align="center">
                        <Heading size="lg" textAlign="center" fontWeight="bold" color="white">
                          Flexible Scheduling
                        </Heading>
                        <Text color="gray.300" textAlign="center" lineHeight="1.6" fontSize="md">
                          Play immediately and start tournaments when you're ready.
                        </Text>
                      </VStack>
                    </VStack>
                  </Box>
                </SimpleGrid>
              </VStack>

              {/* Debug: Event System Test */}
              <Box p={4} border="1px solid" borderColor="gray.600" borderRadius="lg" bg="gray.800">
                <VStack spacing={3}>
                  <Text fontSize="sm" color="gray.400">Debug: Event System Test</Text>
                  <HStack spacing={2} wrap="wrap">
                    <Button size="sm" onClick={handleTestEvent} colorScheme="purple">
                      Test Event
                    </Button>
                    <Button size="sm" onClick={handleSimulateTournamentCreation} colorScheme="orange">
                      Simulate Creation
                    </Button>
                    <Button size="sm" onClick={handlePollBlockchainEvents} colorScheme="green">
                      Poll Blockchain
                    </Button>
                    <Button size="sm" onClick={handleTestNotifierEndpoint} colorScheme="red">
                      Test Notifier
                    </Button>
                    <Button size="sm" onClick={handleInjectTestEvent} colorScheme="yellow">
                      Inject Event
                    </Button>
                    <Button size="sm" onClick={handleResetTimestamp} colorScheme="gray">
                      Reset Timestamp
                    </Button>
                    <Button size="sm" onClick={handleSimulateBlockchainEvent} colorScheme="teal">
                      Simulate Blockchain
                    </Button>
                    {refreshStats && (
                      <Button size="sm" onClick={refreshStats} colorScheme="blue">
                        Manual Refresh
                      </Button>
                    )}
                  </HStack>
                  <Text fontSize="xs" color="gray.500">
                    Total: {totalTournaments} | Active: {activeTournaments} | Completed: {completedTournaments}
                  </Text>
                </VStack>
              </Box>

            </VStack>
          </Box>

          <Outlet />
        </VStack>
      </Container>
    </PageWrapper>
  );
};
