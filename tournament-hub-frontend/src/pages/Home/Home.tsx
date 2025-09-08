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
      <Container maxW="7xl" py={10}>
        <VStack spacing={12} align="stretch">
          {/* Hero Section */}
          <Box textAlign={{ base: 'center', md: 'left' }}>
            <VStack spacing={6} align={{ base: 'center', md: 'start' }}>
              <Heading size="2xl" bgGradient="linear(to-r, blue.400, purple.400)" bgClip="text">
                Tournament Hub
              </Heading>
              <Text fontSize="xl" color="gray.300" maxW="2xl">
                Join competitive tournaments, compete with players worldwide, and win prizes on the MultiversX blockchain.
                <br />
                <Text as="span" fontSize="md" color="gray.500">
                  Connect your wallet to get started.
                </Text>
              </Text>

              {/* Stats */}
              <StatGroup maxW="lg" w="full">
                <Stat>
                  {loading ? (
                    <Skeleton height="32px" width="40px" />
                  ) : error ? (
                    <StatNumber color="red.400">-</StatNumber>
                  ) : (
                    <StatNumber color="yellow.400">{joiningTournaments}</StatNumber>
                  )}
                  <StatLabel color="gray.400">Joining</StatLabel>
                </Stat>
                <Stat>
                  {loading ? (
                    <Skeleton height="32px" width="40px" />
                  ) : error ? (
                    <StatNumber color="red.400">-</StatNumber>
                  ) : (
                    <StatNumber color="blue.400">{readyToStartTournaments}</StatNumber>
                  )}
                  <StatLabel color="gray.400">Ready to Start</StatLabel>
                </Stat>
                <Stat>
                  {loading ? (
                    <Skeleton height="32px" width="40px" />
                  ) : error ? (
                    <StatNumber color="red.400">-</StatNumber>
                  ) : (
                    <StatNumber color="green.400">{activeTournaments}</StatNumber>
                  )}
                  <StatLabel color="gray.400">Active</StatLabel>
                </Stat>
                <Stat>
                  {loading ? (
                    <Skeleton height="32px" width="40px" />
                  ) : error ? (
                    <StatNumber color="red.400">-</StatNumber>
                  ) : (
                    <StatNumber color="purple.400">{completedTournaments}</StatNumber>
                  )}
                  <StatLabel color="gray.400">Completed</StatLabel>
                </Stat>
              </StatGroup>

              {error && (
                <Text fontSize="sm" color="red.400" textAlign={{ base: 'center', md: 'left' }}>
                  Failed to load tournament statistics. Please try refreshing the page.
                </Text>
              )}

              {/* Action Buttons */}
              <HStack spacing={4} flexWrap="wrap" justify={{ base: 'center', md: 'start' }}>
                <Button
                  as={RouterLink}
                  to="/tournaments"
                  leftIcon={<Trophy size={20} />}
                  colorScheme="blue"
                  size="lg"
                  borderRadius="xl"
                  _hover={{ transform: 'translateY(-2px)', boxShadow: 'lg' }}
                >
                  View Tournaments
                </Button>
                <Button
                  as={RouterLink}
                  to="/tournaments/create"
                  leftIcon={<Plus size={20} />}
                  colorScheme="green"
                  size="lg"
                  borderRadius="xl"
                  _hover={{ transform: 'translateY(-2px)', boxShadow: 'lg' }}
                >
                  Create Tournament
                </Button>
              </HStack>
            </VStack>
          </Box>

          {/* Available Tournaments Preview */}
          {(joiningTournaments + readyToStartTournaments + activeTournaments + completedTournaments) > 0 && (
            <Box>
              <HStack spacing={3} mb={6}>
                <Box p={2} bg="yellow.500" borderRadius="lg">
                  <Gamepad2 size={20} color="white" />
                </Box>
                <VStack spacing={0} align="start">
                  <Heading size="lg">Available Tournaments</Heading>
                  <Text color="gray.400" fontSize="sm">
                    {joiningTournaments + readyToStartTournaments + activeTournaments + completedTournaments} tournaments to view and join
                  </Text>
                </VStack>
              </HStack>
            </Box>
          )}

          {/* Features Grid */}
          <SimpleGrid columns={{ base: 1, md: 3 }} spacing={8}>
            <Box p={6} bg="gray.800" borderRadius="xl" border="1px solid" borderColor="gray.700">
              <VStack spacing={4} align="center">
                <Box p={3} bg="blue.500" borderRadius="full">
                  <Trophy size={24} color="white" />
                </Box>
                <Heading size="md">Competitive Gaming</Heading>
                <Text color="gray.400" textAlign="center">
                  Join tournaments with players from around the world and compete for prizes.
                </Text>
              </VStack>
            </Box>

            <Box p={6} bg="gray.800" borderRadius="xl" border="1px solid" borderColor="gray.700">
              <VStack spacing={4} align="center">
                <Box p={3} bg="green.500" borderRadius="full">
                  <Users size={24} color="white" />
                </Box>
                <Heading size="md">Community Driven</Heading>
                <Text color="gray.400" textAlign="center">
                  Create and manage your own tournaments or join existing ones.
                </Text>
              </VStack>
            </Box>

            <Box p={6} bg="gray.800" borderRadius="xl" border="1px solid" borderColor="gray.700">
              <VStack spacing={4} align="center">
                <Box p={3} bg="purple.500" borderRadius="full">
                  <Calendar size={24} color="white" />
                </Box>
                <Heading size="md">Flexible Scheduling</Heading>
                <Text color="gray.400" textAlign="center">
                  Play immediately without waiting for deadlines.
                </Text>
              </VStack>
            </Box>
          </SimpleGrid>

          <Outlet />
        </VStack>
      </Container>


    </PageWrapper>
  );
};
