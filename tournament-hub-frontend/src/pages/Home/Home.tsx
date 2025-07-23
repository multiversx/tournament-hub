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
} from '@chakra-ui/react';
import { Trophy, Users, Calendar, Plus } from 'lucide-react';
import { PageWrapper } from 'wrappers';

export const Home = () => {
  const isMobile = useBreakpointValue({ base: true, md: false });

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
              <StatGroup maxW="md" w="full">
                <Stat>
                  <StatNumber color="blue.400">6</StatNumber>
                  <StatLabel color="gray.400">Total Tournaments</StatLabel>
                </Stat>
                <Stat>
                  <StatNumber color="green.400">1</StatNumber>
                  <StatLabel color="gray.400">Active Tournaments</StatLabel>
                </Stat>
                <Stat>
                  <StatNumber color="yellow.400">5</StatNumber>
                  <StatLabel color="gray.400">Upcoming Tournaments</StatLabel>
                </Stat>
              </StatGroup>

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
                  Set your own deadlines and play at your own pace.
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
