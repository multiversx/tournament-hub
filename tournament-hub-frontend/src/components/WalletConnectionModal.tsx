import React from 'react';
import {
    Modal,
    ModalOverlay,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
    ModalCloseButton,
    Button,
    VStack,
    Text,
    Box,
    Icon,
    HStack,
    Divider,
    useColorModeValue,
} from '@chakra-ui/react';
import { Wallet, AlertCircle, ArrowRight } from 'lucide-react';
import { useWallet } from '../contexts/WalletContext';

interface WalletConnectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConnect: () => void;
}

export const WalletConnectionModal: React.FC<WalletConnectionModalProps> = ({
    isOpen,
    onClose,
    onConnect,
}) => {
    const { isConnected } = useWallet();
    const bgGradient = useColorModeValue(
        'linear(135deg, gray.50, gray.100)',
        'linear(135deg, gray.800, gray.900)'
    );
    const borderColor = useColorModeValue('gray.200', 'gray.600');
    const textColor = useColorModeValue('gray.700', 'gray.300');
    const iconBg = useColorModeValue('blue.100', 'blue.900');

    const handleConnect = () => {
        onConnect();
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} isCentered size="md">
            <ModalOverlay
                bg="blackAlpha.600"
                backdropFilter="blur(10px)"
            />
            <ModalContent
                bgGradient={bgGradient}
                borderRadius="2xl"
                border="2px solid"
                borderColor={borderColor}
                boxShadow="0 25px 50px rgba(0,0,0,0.3)"
                _hover={{
                    boxShadow: "0 30px 60px rgba(0,0,0,0.4)"
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

                <ModalHeader pb={4}>
                    <HStack spacing={4} align="center">
                        <Box
                            p={3}
                            bgGradient="linear(135deg, blue.500, purple.600)"
                            borderRadius="xl"
                            boxShadow="0 8px 20px rgba(59, 130, 246, 0.3)"
                        >
                            <Icon as={Wallet} color="white" boxSize={6} />
                        </Box>
                        <VStack spacing={1} align="start">
                            <Text
                                fontSize="xl"
                                fontWeight="bold"
                                color={textColor}
                            >
                                Wallet Required
                            </Text>
                            <Text
                                fontSize="sm"
                                color={textColor}
                                opacity={0.7}
                            >
                                Connect your wallet to create tournaments
                            </Text>
                        </VStack>
                    </HStack>
                </ModalHeader>

                <ModalCloseButton
                    color={textColor}
                    _hover={{
                        bg: 'rgba(0,0,0,0.1)',
                        transform: 'scale(1.1)'
                    }}
                    transition="all 0.2s ease"
                />

                <ModalBody pb={6}>
                    <VStack spacing={6} align="stretch">
                        {/* Info Box */}
                        <Box
                            p={4}
                            bgGradient="linear(135deg, blue.50, purple.50)"
                            borderRadius="xl"
                            border="2px solid"
                            borderColor="blue.200"
                            _dark={{
                                bgGradient: "linear(135deg, blue.900, purple.900)",
                                borderColor: "blue.700"
                            }}
                        >
                            <HStack spacing={3} align="start">
                                <Box
                                    p={2}
                                    bg={iconBg}
                                    borderRadius="md"
                                    _dark={{ bg: "blue.800" }}
                                >
                                    <Icon as={AlertCircle} color="blue.500" boxSize={5} />
                                </Box>
                                <VStack spacing={2} align="start" flex={1}>
                                    <Text
                                        fontSize="sm"
                                        fontWeight="semibold"
                                        color={textColor}
                                    >
                                        Why do I need to connect my wallet?
                                    </Text>
                                    <Text
                                        fontSize="sm"
                                        color={textColor}
                                        opacity={0.8}
                                        lineHeight="1.5"
                                    >
                                        Creating tournaments requires blockchain transactions to register your tournament and pay the entry fee. Your wallet is needed to sign these transactions securely.
                                    </Text>
                                </VStack>
                            </HStack>
                        </Box>

                        <Divider borderColor={borderColor} />

                        {/* Features List */}
                        <VStack spacing={3} align="stretch">
                            <Text
                                fontSize="md"
                                fontWeight="semibold"
                                color={textColor}
                                textAlign="center"
                            >
                                What you can do after connecting:
                            </Text>

                            <VStack spacing={2} align="stretch">
                                {[
                                    "Create and manage tournaments",
                                    "Join tournaments with entry fees",
                                    "Receive tournament rewards",
                                    "Track your gaming statistics"
                                ].map((feature, index) => (
                                    <HStack key={index} spacing={3} align="center">
                                        <Box
                                            w="6px"
                                            h="6px"
                                            bgGradient="linear(135deg, blue.500, purple.500)"
                                            borderRadius="full"
                                            flexShrink={0}
                                        />
                                        <Text
                                            fontSize="sm"
                                            color={textColor}
                                            opacity={0.8}
                                        >
                                            {feature}
                                        </Text>
                                    </HStack>
                                ))}
                            </VStack>
                        </VStack>
                    </VStack>
                </ModalBody>

                <ModalFooter pt={0}>
                    <HStack spacing={3} w="full" justify="flex-end">
                        <Button
                            variant="outline"
                            onClick={onClose}
                            color={textColor}
                            borderColor={borderColor}
                            _hover={{
                                bg: 'rgba(0,0,0,0.05)',
                                borderColor: 'blue.400'
                            }}
                            _dark={{
                                _hover: {
                                    bg: 'rgba(255,255,255,0.05)',
                                    borderColor: 'blue.400'
                                }
                            }}
                            transition="all 0.2s ease"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleConnect}
                            bgGradient="linear(135deg, blue.500, purple.600)"
                            color="white"
                            fontWeight="bold"
                            px={6}
                            py={3}
                            borderRadius="xl"
                            boxShadow="0 8px 20px rgba(59, 130, 246, 0.3)"
                            _hover={{
                                bgGradient: "linear(135deg, blue.600, purple.700)",
                                transform: "translateY(-2px)",
                                boxShadow: "0 12px 25px rgba(59, 130, 246, 0.4)"
                            }}
                            _active={{
                                transform: "translateY(0px)",
                                boxShadow: "0 6px 15px rgba(59, 130, 246, 0.3)"
                            }}
                            transition="all 0.3s ease"
                            rightIcon={<ArrowRight size={16} />}
                        >
                            Go to Connect Wallet
                        </Button>
                    </HStack>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
};
