import React, { useState } from 'react';
import {
    Box,
    Button,
    Card,
    CardBody,
    CardHeader,
    Container,
    FormControl,
    FormLabel,
    Heading,
    Input,
    NumberInput,
    NumberInputField,
    Textarea,
    VStack,
    Alert,
    AlertIcon,
    Text,
    useToast
} from '@chakra-ui/react';
import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useWallet } from '../contexts/WalletContext';
import { useCreateTournamentTransaction } from '../hooks/transactions/useCreateTournamentTransaction';

interface FormData {
    name: string;
    description: string;
    maxPlayers: string;
    prizePool: string;
}

interface FormErrors {
    name?: string;
    description?: string;
    maxPlayers?: string;
    prizePool?: string;
}

export const CreateTournament: React.FC = () => {
    const { isConnected, address } = useWallet();
    const { createTournament } = useCreateTournamentTransaction();
    const toast = useToast();

    const [formData, setFormData] = useState<FormData>({
        name: '',
        description: '',
        maxPlayers: '4',
        prizePool: '0'
    });

    const [errors, setErrors] = useState<FormErrors>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    const validateForm = (): boolean => {
        const newErrors: FormErrors = {};

        if (!formData.name.trim()) {
            newErrors.name = 'Tournament name is required';
        }

        if (!formData.description.trim()) {
            newErrors.description = 'Description is required';
        }

        if (!formData.maxPlayers || parseInt(formData.maxPlayers) < 2 || parseInt(formData.maxPlayers) > 8) {
            newErrors.maxPlayers = 'Max players must be between 2 and 8';
        }

        if (!formData.prizePool || parseFloat(formData.prizePool) < 0) {
            newErrors.prizePool = 'Prize pool cannot be negative';
        }



        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!isConnected) {
            toast({
                title: 'Wallet not connected',
                description: 'Please connect your wallet to create a tournament',
                status: 'error',
                duration: 5000,
                isClosable: true,
            });
            return;
        }

        if (!validateForm()) {
            return;
        }

        setIsSubmitting(true);

        try {
            // Generate a unique tournament ID
            const tournamentId = Date.now();

            // For now, use game_id = 1 (you'll need to register this game first)
            const gameId = 1;

            const sessionId = await createTournament({
                gameId
            });

            toast({
                title: 'Tournament created successfully!',
                description: `Transaction: ${sessionId}`,
                status: 'success',
                duration: 5000,
                isClosable: true,
            });

            // Reset form
            setFormData({
                name: '',
                description: '',
                maxPlayers: '4',
                prizePool: '0'
            });
        } catch (error) {
            console.error('Error creating tournament:', error);
            toast({
                title: 'Error creating tournament',
                description: error instanceof Error ? error.message : 'Unknown error occurred',
                status: 'error',
                duration: 5000,
                isClosable: true,
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleInputChange = (field: keyof FormData, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        // Clear error when user starts typing
        if (errors[field]) {
            setErrors(prev => ({ ...prev, [field]: undefined }));
        }
    };

    return (
        <Container maxW="container.md" py={8}>
            <VStack spacing={6} align="stretch">
                <Heading size="lg" textAlign="center" color="gray.300">
                    Create New Tournament
                </Heading>

                {isConnected && (
                    <Card bg="gray.800" border="1px solid" borderColor="gray.700" mb={6}>
                        <CardBody>
                            <Alert status="success" borderRadius="md">
                                <AlertIcon />
                                <Box>
                                    <Text fontWeight="bold">Wallet Connected</Text>
                                    <Text fontSize="sm">Ready to create tournaments with address: {address?.slice(0, 10)}...</Text>
                                </Box>
                            </Alert>
                        </CardBody>
                    </Card>
                )}

                <Card bg="gray.800" border="1px solid" borderColor="gray.700">
                    <CardHeader>
                        <Heading size="md" color="gray.300">
                            <FontAwesomeIcon icon={faPlus} style={{ marginRight: '8px' }} />
                            Tournament Details
                        </Heading>
                    </CardHeader>
                    <CardBody>
                        <form onSubmit={handleSubmit}>
                            <VStack spacing={4}>
                                <FormControl isInvalid={!!errors.name}>
                                    <FormLabel color="gray.300">Tournament Name</FormLabel>
                                    <Input
                                        value={formData.name}
                                        onChange={(e) => handleInputChange('name', e.target.value)}
                                        placeholder="Enter tournament name"
                                        sx={{ color: 'white !important' }}
                                    />
                                    {errors.name && <Text color="red.400" fontSize="sm">{errors.name}</Text>}
                                </FormControl>

                                <FormControl isInvalid={!!errors.description}>
                                    <FormLabel color="gray.300">Description</FormLabel>
                                    <Textarea
                                        value={formData.description}
                                        onChange={(e) => handleInputChange('description', e.target.value)}
                                        placeholder="Enter tournament description"
                                        rows={3}
                                        sx={{ color: 'white !important' }}
                                    />
                                    {errors.description && <Text color="red.400" fontSize="sm">{errors.description}</Text>}
                                </FormControl>

                                <FormControl isInvalid={!!errors.maxPlayers}>
                                    <FormLabel color="gray.300">Max Players (2-8)</FormLabel>
                                    <NumberInput
                                        value={formData.maxPlayers}
                                        onChange={(value) => handleInputChange('maxPlayers', value)}
                                        min={2}
                                        max={8}
                                    >
                                        <NumberInputField sx={{ color: 'white !important' }} />
                                    </NumberInput>
                                    {errors.maxPlayers && <Text color="red.400" fontSize="sm">{errors.maxPlayers}</Text>}
                                </FormControl>

                                <FormControl isInvalid={!!errors.prizePool}>
                                    <FormLabel color="gray.300">Prize Pool (EGLD)</FormLabel>
                                    <NumberInput
                                        value={formData.prizePool}
                                        onChange={(value) => handleInputChange('prizePool', value)}
                                        min={0}
                                        precision={2}
                                    >
                                        <NumberInputField sx={{ color: 'white !important' }} />
                                    </NumberInput>
                                    {errors.prizePool && <Text color="red.400" fontSize="sm">{errors.prizePool}</Text>}
                                </FormControl>



                                <Button
                                    type="submit"
                                    colorScheme="blue"
                                    size="lg"
                                    width="full"
                                    isLoading={isSubmitting}
                                    loadingText="Creating Tournament..."
                                    isDisabled={!isConnected}
                                >
                                    Create Tournament
                                </Button>
                            </VStack>
                        </form>
                    </CardBody>
                </Card>
            </VStack>
        </Container>
    );
};

export default CreateTournament; 