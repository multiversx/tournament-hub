import { Outlet, Link as RouterLink } from 'react-router-dom';
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
import { Trophy, Users, Calendar, Plus, Gamepad2 } from 'lucide-react';
import { PageWrapper } from 'wrappers';
import { useTournamentStats } from '../../hooks/useTournamentStats';
import { UpcomingTournaments } from '../../components/UpcomingTournaments';

export const Home = () => {
  const isMobile = useBreakpointValue({ base: true, md: false });
  const { totalTournaments, joiningTournaments, readyToStartTournaments, activeTournaments, completedTournaments, loading, error } = useTournamentStats();

  return (
    <PageWrapper>
      <Container maxW="6xl" py={2} h="full" overflow="hidden">
        <VStack spacing={4} align="stretch" h="full">
          {/* Hero Section */}
          <Box textAlign={{ base: 'center', md: 'left' }} position="relative" flex="1">
            <VStack spacing={4} align={{ base: 'center', md: 'start' }} h="full">
              <VStack spacing={2} align={{ base: 'center', md: 'start' }}>
                <Heading
                  size="3xl"
                  bgGradient="linear(to-r, blue.400, purple.500, pink.400)"
                  bgClip="text"
                  fontWeight="extrabold"
                  letterSpacing="-0.02em"
                  lineHeight="1.1"
                >
                  Tournament Hub
                </Heading>
                <Text
                  fontSize="lg"
                  color="gray.300"
                  maxW="2xl"
                  fontWeight="medium"
                  lineHeight="1.4"
                >
                  Join competitive tournaments, compete with players worldwide, and win prizes on the MultiversX blockchain.
                </Text>
                <Text
                  fontSize="md"
                  color="gray.400"
                  fontWeight="normal"
                >
                  Connect your wallet to get started.
                </Text>
              </VStack>

              {/* Enhanced Stats */}
              <Box
                w="full"
                maxW="2xl"
                p={4}
                bg="gray.800"
                borderRadius="xl"
                border="1px solid"
                borderColor="gray.700"
                _hover={{ borderColor: "gray.600" }}
                transition="all 0.3s"
              >
                <VStack spacing={3}>
                  <Text fontSize="xs" color="gray.400" fontWeight="medium" textTransform="uppercase" letterSpacing="0.05em">
                    Tournament Statistics
                  </Text>
                  <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4} w="full">
                    <VStack spacing={2}>
                      {loading ? (
                        <Skeleton height="40px" width="60px" borderRadius="lg" />
                      ) : error ? (
                        <Text fontSize="3xl" fontWeight="bold" color="red.400">-</Text>
                      ) : (
                        <Text fontSize="3xl" fontWeight="bold" color="yellow.400">
                          {joiningTournaments}
                        </Text>
                      )}
                      <Text fontSize="sm" color="gray.400" fontWeight="medium">Joining</Text>
                    </VStack>
                    <VStack spacing={2}>
                      {loading ? (
                        <Skeleton height="40px" width="60px" borderRadius="lg" />
                      ) : error ? (
                        <Text fontSize="3xl" fontWeight="bold" color="red.400">-</Text>
                      ) : (
                        <Text fontSize="3xl" fontWeight="bold" color="blue.400">
                          {readyToStartTournaments}
                        </Text>
                      )}
                      <Text fontSize="sm" color="gray.400" fontWeight="medium">Ready to Start</Text>
                    </VStack>
                    <VStack spacing={2}>
                      {loading ? (
                        <Skeleton height="40px" width="60px" borderRadius="lg" />
                      ) : error ? (
                        <Text fontSize="3xl" fontWeight="bold" color="red.400">-</Text>
                      ) : (
                        <Text fontSize="3xl" fontWeight="bold" color="green.400">
                          {activeTournaments}
                        </Text>
                      )}
                      <Text fontSize="sm" color="gray.400" fontWeight="medium">Playing</Text>
                    </VStack>
                    <VStack spacing={2}>
                      {loading ? (
                        <Skeleton height="40px" width="60px" borderRadius="lg" />
                      ) : error ? (
                        <Text fontSize="3xl" fontWeight="bold" color="red.400">-</Text>
                      ) : (
                        <Text fontSize="3xl" fontWeight="bold" color="purple.400">
                          {completedTournaments}
                        </Text>
                      )}
                      <Text fontSize="sm" color="gray.400" fontWeight="medium">Completed</Text>
                    </VStack>
                  </SimpleGrid>
                </VStack>
              </Box>

              {error && (
                <Text fontSize="sm" color="red.400" textAlign={{ base: 'center', md: 'left' }}>
                  Failed to load tournament statistics. Please try refreshing the page.
                </Text>
              )}

              {/* Enhanced Action Buttons */}
              <HStack spacing={3} flexWrap="wrap" justify={{ base: 'center', md: 'start' }}>
                <Button
                  as={RouterLink}
                  to="/tournaments"
                  leftIcon={<Trophy size={18} />}
                  colorScheme="blue"
                  size="md"
                  px={6}
                  py={4}
                  fontSize="md"
                  fontWeight="semibold"
                  bgGradient="linear(to-r, blue.500, blue.600)"
                  _hover={{
                    bgGradient: "linear(to-r, blue.600, blue.700)",
                    transform: 'translateY(-1px)',
                    boxShadow: 'lg'
                  }}
                  _active={{ transform: 'translateY(0)' }}
                >
                  View Tournaments
                </Button>
                <Button
                  as={RouterLink}
                  to="/tournaments/create"
                  leftIcon={<Plus size={18} />}
                  colorScheme="green"
                  size="md"
                  px={6}
                  py={4}
                  fontSize="md"
                  fontWeight="semibold"
                  bgGradient="linear(to-r, green.500, green.600)"
                  _hover={{
                    bgGradient: "linear(to-r, green.600, green.700)",
                    transform: 'translateY(-1px)',
                    boxShadow: 'lg'
                  }}
                  _active={{ transform: 'translateY(0)' }}
                >
                  Create Tournament
                </Button>
              </HStack>
            </VStack>
          </Box>

          {/* Available Tournaments Preview */}
          {(joiningTournaments + readyToStartTournaments + activeTournaments + completedTournaments) > 0 && (
            <Box>
              <HStack spacing={2} mb={3}>
                <Box p={1.5} bg="yellow.500" borderRadius="md">
                  <Gamepad2 size={16} color="white" />
                </Box>
                <VStack spacing={0} align="start">
                  <Heading size="md">Available Tournaments</Heading>
                  <Text color="gray.400" fontSize="xs">
                    {joiningTournaments + readyToStartTournaments + activeTournaments + completedTournaments} tournaments to view and join
                  </Text>
                </VStack>
              </HStack>
            </Box>
          )}

          {/* Enhanced Features Grid */}
          <VStack spacing={4} align="stretch" flex="1">
            <VStack spacing={1} align="center">
              <Heading size="xl" textAlign="center" fontWeight="bold">
                Why Choose Tournament Hub?
              </Heading>
              <Text color="gray.400" textAlign="center" maxW="2xl" fontSize="sm">
                Experience the future of competitive gaming on the blockchain
              </Text>
            </VStack>

            <SimpleGrid columns={{ base: 1, md: 3 }} spacing={6} flex="1">
              <Box
                p={6}
                bg="gray.800"
                borderRadius="2xl"
                border="1px solid"
                borderColor="gray.700"
                position="relative"
                overflow="hidden"
                _hover={{
                  borderColor: "blue.500",
                  transform: "translateY(-3px)",
                  boxShadow: "xl"
                }}
                transition="all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
              >
                <VStack spacing={4} align="center">
                  <Box
                    p={3}
                    bgGradient="linear(to-br, blue.500, blue.600)"
                    borderRadius="xl"
                    boxShadow="lg"
                  >
                    <Trophy size={24} color="white" />
                  </Box>
                  <VStack spacing={3} align="center">
                    <Heading size="lg" textAlign="center" fontWeight="semibold">
                      Competitive Gaming
                    </Heading>
                    <Text color="gray.400" textAlign="center" lineHeight="1.5" fontSize="sm">
                      Join tournaments with players from around the world and compete for prizes on the blockchain.
                    </Text>
                  </VStack>
                </VStack>
              </Box>

              <Box
                p={6}
                bg="gray.800"
                borderRadius="2xl"
                border="1px solid"
                borderColor="gray.700"
                position="relative"
                overflow="hidden"
                _hover={{
                  borderColor: "green.500",
                  transform: "translateY(-3px)",
                  boxShadow: "xl"
                }}
                transition="all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
              >
                <VStack spacing={4} align="center">
                  <Box
                    p={3}
                    bgGradient="linear(to-br, green.500, green.600)"
                    borderRadius="xl"
                    boxShadow="lg"
                  >
                    <Users size={24} color="white" />
                  </Box>
                  <VStack spacing={3} align="center">
                    <Heading size="lg" textAlign="center" fontWeight="semibold">
                      Community Driven
                    </Heading>
                    <Text color="gray.400" textAlign="center" lineHeight="1.5" fontSize="sm">
                      Create and manage your own tournaments or join existing ones. Build your gaming community.
                    </Text>
                  </VStack>
                </VStack>
              </Box>

              <Box
                p={6}
                bg="gray.800"
                borderRadius="2xl"
                border="1px solid"
                borderColor="gray.700"
                position="relative"
                overflow="hidden"
                _hover={{
                  borderColor: "purple.500",
                  transform: "translateY(-3px)",
                  boxShadow: "xl"
                }}
                transition="all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
              >
                <VStack spacing={4} align="center">
                  <Box
                    p={3}
                    bgGradient="linear(to-br, purple.500, purple.600)"
                    borderRadius="xl"
                    boxShadow="lg"
                  >
                    <Calendar size={24} color="white" />
                  </Box>
                  <VStack spacing={3} align="center">
                    <Heading size="lg" textAlign="center" fontWeight="semibold">
                      Flexible Scheduling
                    </Heading>
                    <Text color="gray.400" textAlign="center" lineHeight="1.5" fontSize="sm">
                      Play immediately without waiting for deadlines. Start tournaments when you're ready.
                    </Text>
                  </VStack>
                </VStack>
              </Box>
            </SimpleGrid>
          </VStack>

          <Outlet />
        </VStack>
      </Container>


    </PageWrapper>
  );
};
