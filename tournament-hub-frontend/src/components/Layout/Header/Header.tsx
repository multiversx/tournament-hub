import { useNavigate } from 'react-router-dom';
import { Box, Text, HStack, VStack } from '@chakra-ui/react';
import { Button, MxLink } from 'components';
import { useEffect } from 'react';

import { getAccountProvider, useGetIsLoggedIn, useGetNetworkConfig, DECIMALS, DIGITS, FormatAmountController } from 'lib';
import { RouteNamesEnum } from 'localConstants';
import { NotificationsButton } from './components/NotificationsButton';
import { useRefreshAccountInfo } from '../../../hooks/useRefreshAccountInfo';

export const Header = () => {
  const isLoggedIn = useGetIsLoggedIn();
  const { address, account } = useRefreshAccountInfo();
  const { network } = useGetNetworkConfig();
  const navigate = useNavigate();
  const provider = getAccountProvider();

  // Refresh account info periodically to update balance
  useEffect(() => {
    if (!isLoggedIn) return;

    const refreshAccountInfo = async () => {
      try {
        // Try to refresh the account info by dispatching a custom event
        // This will trigger a re-render of components that listen to this event
        window.dispatchEvent(new CustomEvent('refreshAccountInfo'));
      } catch (error) {
        console.error('Failed to refresh account info:', error);
      }
    };

    // Refresh every 5 seconds
    const interval = setInterval(refreshAccountInfo, 5000);

    return () => clearInterval(interval);
  }, [isLoggedIn]);

  const handleLogout = async () => {
    await provider.logout();
    navigate(RouteNamesEnum.home);
  };

  const { isValid, valueDecimal, valueInteger, label } =
    FormatAmountController.getData({
      digits: DIGITS,
      decimals: DECIMALS,
      egldLabel: network.egldLabel,
      input: account.balance
    });

  return (
    <Box
      as="header"
      display="flex"
      flexDirection="row"
      alignItems="center"
      justifyContent="space-between"
      pl={6}
      pr={6}
      pt={6}
      pb={4}
      borderBottom="1px solid"
      borderColor="gray.700"
      bg="gray.900"
      position="sticky"
      top={0}
      zIndex={10}
      backdropFilter="blur(10px)"
    >
      <MxLink
        className='flex items-center justify-between hover:no-underline'
        to={RouteNamesEnum.home}
      >
        <HStack spacing={3}>
          <Box
            p={2}
            bgGradient="linear(to-br, blue.500, purple.600)"
            borderRadius="lg"
            boxShadow="md"
          >
            <Text fontSize="xl">🏆</Text>
          </Box>
          <VStack spacing={0} align="start">
            <Text fontSize="2xl" fontWeight="bold" bgGradient="linear(to-r, blue.400, purple.400)" bgClip="text">
              Tournament Hub
            </Text>
            <Text fontSize="xs" color="gray.500" fontWeight="medium">
              MultiversX Gaming Platform
            </Text>
          </VStack>
        </HStack>
      </MxLink>

      <Box as="nav" h="full" w={{ base: 'full', sm: 'auto' }} fontSize="sm" position={{ base: 'static', sm: 'relative' }} left={{ sm: 'auto' }} top={{ sm: 'auto' }} display={{ base: 'block', sm: 'flex' }} flexDirection={{ sm: 'row' }} justifyContent={{ sm: 'end' }} bg={{ sm: 'transparent' }}>
        <HStack justify="end" spacing={6} alignItems="center">
          {/* Navigation Links */}
          <HStack spacing={6} display={{ base: 'none', md: 'flex' }}>
            <MxLink to="/tournaments" className="text-gray-300 hover:text-blue-400 transition-colors font-medium">
              Tournaments
            </MxLink>
            <MxLink to="/tournaments/create" className="text-gray-300 hover:text-green-400 transition-colors font-medium">
              Create
            </MxLink>
            <MxLink to="/dashboard" className="text-gray-300 hover:text-purple-400 transition-colors font-medium">
              Dashboard
            </MxLink>
          </HStack>

          <HStack spacing={1} alignItems="center">
            <Box w={2} h={2} borderRadius="full" bg="green.500" />
            <Text color="gray.400" fontSize="sm">{network.name}</Text>
          </HStack>

          {isLoggedIn && (
            <>
              <VStack spacing={1} align="end">
                <Text
                  fontFamily="mono"
                  fontSize="xs"
                  bg="gray.800"
                  color="gray.300"
                  borderRadius="lg"
                  px={3}
                  py={1}
                  border="1px solid"
                  borderColor="gray.700"
                  fontWeight="medium"
                >
                  {address?.slice(0, 8)}...{address?.slice(-6)}
                </Text>
                <Text
                  fontFamily="mono"
                  fontSize="xs"
                  bg="blue.900"
                  color="blue.300"
                  borderRadius="lg"
                  px={3}
                  py={1}
                  border="1px solid"
                  borderColor="blue.700"
                  fontWeight="semibold"
                >
                  {isValid ? `${valueInteger}.${valueDecimal} ${label}` : '...'}
                </Text>
              </VStack>
              <NotificationsButton />
              <Button
                onClick={handleLogout}
                className="inline-block rounded-lg px-3 py-2 text-center hover:no-underline my-0 text-red-400 hover:bg-red-600 hover:text-white mx-0 transition-colors"
              >
                Logout
              </Button>
            </>
          )}

          {!isLoggedIn && (
            <Button
              onClick={() => {
                navigate(RouteNamesEnum.unlock);
              }}
              className="inline-block rounded-lg px-4 py-2 text-center hover:no-underline my-0 text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 hover:transform hover:-translate-y-0.5 hover:shadow-lg mx-0 transition-all font-semibold"
            >
              Connect Wallet
            </Button>
          )}
        </HStack>
      </Box>
    </Box>
  );
};
