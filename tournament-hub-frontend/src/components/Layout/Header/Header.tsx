import { useNavigate } from 'react-router-dom';
import { Box, Text, HStack, VStack } from '@chakra-ui/react';
import { Button, MxLink } from 'components';
import { environment } from 'config';
import { getAccountProvider, useGetIsLoggedIn, useGetAccountInfo, useGetNetworkConfig, DECIMALS, DIGITS, FormatAmountController } from 'lib';
import { RouteNamesEnum } from 'localConstants';
import { NotificationsButton } from './components/NotificationsButton';

export const Header = () => {
  const isLoggedIn = useGetIsLoggedIn();
  const { address, account } = useGetAccountInfo();
  const { network } = useGetNetworkConfig();
  const navigate = useNavigate();
  const provider = getAccountProvider();

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
    <Box as="header" display="flex" flexDirection="row" alignItems="center" justifyContent="space-between" pl={6} pr={6} pt={6}>
      <MxLink
        className='flex items-center justify-between'
        to={RouteNamesEnum.home}
      >
        <Text fontSize="2xl" fontWeight="bold" color="blue.400">Tournament Hub</Text>
      </MxLink>

      <Box as="nav" h="full" w={{ base: 'full', sm: 'auto' }} fontSize="sm" position={{ base: 'static', sm: 'relative' }} left={{ sm: 'auto' }} top={{ sm: 'auto' }} display={{ base: 'block', sm: 'flex' }} flexDirection={{ sm: 'row' }} justifyContent={{ sm: 'end' }} bg={{ sm: 'transparent' }}>
        <HStack justify="end" spacing={2} alignItems="center">
          <HStack spacing={1} alignItems="center">
            <Box w={2} h={2} borderRadius="full" bg="green.500" />
            <Text color="gray.400">{environment}</Text>
          </HStack>

          {isLoggedIn && (
            <>
              <Text
                fontFamily="mono"
                fontSize="xs"
                bg="gray.800"
                color="gray.300"
                borderRadius="md"
                px={2}
                py={1}
                border="1px solid"
                borderColor="gray.700"
              >
                {address}
              </Text>
              <Text
                fontFamily="mono"
                fontSize="xs"
                bg="gray.800"
                color="gray.300"
                borderRadius="md"
                px={2}
                py={1}
                border="1px solid"
                borderColor="gray.700"
              >
                Balance: {isValid ? `${valueInteger}.${valueDecimal} ${label}` : '...'}
              </Text>
              <NotificationsButton />
              <Button
                onClick={handleLogout}
                className="inline-block rounded-lg px-3 py-2 text-center hover:no-underline my-0 text-gray-400 hover:bg-gray-800 mx-0"
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
            >
              Connect
            </Button>
          )}
        </HStack>
      </Box>
    </Box>
  );
};
