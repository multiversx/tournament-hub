import React from 'react';
import { Button, HStack, Text, Box } from '@chakra-ui/react';
import { useWallet } from '../../contexts/WalletContext';

export const WalletConnect: React.FC = () => {
    const { isConnected, address, connect, disconnect, isLoading } = useWallet();

    const formatAddress = (addr: string) => {
        return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
    };

    if (isConnected && address) {
        return (
            <HStack spacing={2}>
                <Box
                    w={2}
                    h={2}
                    borderRadius="full"
                    bg="green.500"
                />
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
                    {formatAddress(address)}
                </Text>
                <Button
                    onClick={disconnect}
                    size="sm"
                    variant="outline"
                    colorScheme="red"
                >
                    Disconnect
                </Button>
            </HStack>
        );
    }

    return (
        <Button
            onClick={connect}
            isLoading={isLoading}
            colorScheme="blue"
            size="sm"
        >
            Connect Wallet
        </Button>
    );
}; 