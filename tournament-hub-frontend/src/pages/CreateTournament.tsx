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
    useToast,
    Select,
    HStack,
    Badge,
    Divider,
    SimpleGrid,
    Icon,
} from '@chakra-ui/react';
import { faPlus, faGamepad, faUsers, faCoins, faClock, faEdit } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useWallet } from '../contexts/WalletContext';
import { useCreateTournamentTransaction } from '../hooks/transactions/useCreateTournamentTransaction';
import { GAME_CONFIGS } from '../services/tournamentService';

interface FormData {
    name: string;
    gameType: string;
    maxPlayers: string;
    minPlayers: string;
    entryFee: string;
    duration: string;
}

interface FormErrors {
    name?: string;
    gameType?: string;
    maxPlayers?: string;
    minPlayers?: string;
    entryFee?: string;
    duration?: string;
}

// Duration options in hours
const DURATION_OPTIONS = [
    { value: '1', label: '1 Hour' },
    { value: '6', label: '6 Hours' },
    { value: '12', label: '12 Hours' },
    { value: '24', label: '1 Day' },
    { value: '72', label: '3 Days' },
    { value: '168', label: '1 Week' },
    { value: '720', label: '1 Month' },
];

export const CreateTournament: React.FC = () => {
    const { isConnected, address } = useWallet();
    const { createTournament } = useCreateTournamentTransaction();
    const toast = useToast();

    const [formData, setFormData] = useState<FormData>({
        name: '',
        gameType: '1', // Default to TicTacToe
        maxPlayers: '4',
        minPlayers: '2', // Default to 2 players
        entryFee: '0.1',
        duration: '24', // Default to 1 day
    });

    const [errors, setErrors] = useState<FormErrors>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    const validateForm = (): boolean => {
        const newErrors: FormErrors = {};

        if (!formData.name.trim()) {
            newErrors.name = 'Tournament name is required';
        } else if (formData.name.length > 100) {
            newErrors.name = 'Name must be at most 100 characters';
        }

        if (!formData.gameType) {
            newErrors.gameType = 'Please select a game type';
        }

        const maxPlayers = parseInt(formData.maxPlayers);
        if (!maxPlayers || maxPlayers < 2 || maxPlayers > 8) {
            newErrors.maxPlayers = 'Max players must be between 2 and 8';
        }

        const minPlayers = parseInt(formData.minPlayers);
        if (!minPlayers || minPlayers < 2 || minPlayers > maxPlayers) {
            newErrors.minPlayers = 'Min players must be between 2 and max players';
        }

        const entryFee = parseFloat(formData.entryFee);
        if (isNaN(entryFee) || entryFee < 0) {
            newErrors.entryFee = 'Entry fee must be a positive number';
        }

        const duration = parseInt(formData.duration);
        if (!duration || duration < 1 || duration > 720) {
            newErrors.duration = 'Duration must be between 1 hour and 1 month';
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
            // Convert duration from hours to seconds
            const durationInSeconds = parseInt(formData.duration) * 3600;

            // Debug logging
            console.log('=== Create Tournament Form Submission ===');
            console.log('Form data:', formData);
            console.log('Duration in seconds:', durationInSeconds);
            console.log('Entry fee (string):', formData.entryFee);
            console.log('Entry fee (number):', parseFloat(formData.entryFee));

            const sessionId = await createTournament({
                gameId: parseInt(formData.gameType),
                maxPlayers: parseInt(formData.maxPlayers),
                minPlayers: parseInt(formData.minPlayers),
                entryFee: formData.entryFee,
                duration: durationInSeconds,
                name: formData.name.trim(),
            });

            toast({
                title: 'Tournament created successfully!',
                description: `Tournament created! Entry fee paid and creator joined. Session ID: ${sessionId.createSessionId}`,
                status: 'success',
                duration: 5000,
                isClosable: true,
            });

            // Reset form
            setFormData({
                name: '',
                gameType: '1',
                maxPlayers: '4',
                minPlayers: '2',
                entryFee: '0.1',
                duration: '24',
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

    const getSelectedGameConfig = () => {
        const gameId = parseInt(formData.gameType);
        return GAME_CONFIGS[gameId as keyof typeof GAME_CONFIGS];
    };

    const selectedGame = getSelectedGameConfig();

    return (
        <Container maxW="container.lg" py={8}>
            <VStack spacing={6} align="stretch">
                <Heading size="lg" textAlign="center" color="gray.300">
                    <FontAwesomeIcon icon={faPlus} style={{ marginRight: '12px' }} />
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
                            <FontAwesomeIcon icon={faEdit} style={{ marginRight: '8px' }} />
                            Tournament Details
                        </Heading>
                    </CardHeader>
                    <CardBody>
                        <form onSubmit={handleSubmit}>
                            <VStack spacing={6}>
                                {/* Basic Information */}
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

                                <FormControl isInvalid={!!errors.gameType}>
                                    <FormLabel color="gray.300">
                                        <FontAwesomeIcon icon={faGamepad} style={{ marginRight: '8px' }} />
                                        Game Type
                                    </FormLabel>
                                    <Select
                                        value={formData.gameType}
                                        onChange={(e) => handleInputChange('gameType', e.target.value)}
                                        sx={{ color: 'white !important' }}
                                    >
                                        {Object.entries(GAME_CONFIGS).map(([id, config]) => (
                                            <option key={id} value={id}>
                                                {config.name}
                                            </option>
                                        ))}
                                    </Select>
                                    {errors.gameType && <Text color="red.400" fontSize="sm">{errors.gameType}</Text>}
                                </FormControl>

                                {/* Game Configuration Preview */}
                                {selectedGame && (
                                    <Card bg="gray.700" border="1px solid" borderColor="gray.600">
                                        <CardBody>
                                            <VStack spacing={3} align="start">
                                                <HStack>
                                                    <Badge colorScheme="blue">{selectedGame.name}</Badge>
                                                    <Badge colorScheme="green">{selectedGame.gameType}</Badge>
                                                </HStack>
                                                <Text color="gray.300" fontSize="sm">{selectedGame.description}</Text>
                                                <Text color="gray.400" fontSize="xs">
                                                    Players: {selectedGame.minPlayers}-{selectedGame.maxPlayers}
                                                </Text>
                                            </VStack>
                                        </CardBody>
                                    </Card>
                                )}

                                <Divider borderColor="gray.600" />

                                {/* Tournament Settings */}
                                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6} w="full">
                                    <FormControl isInvalid={!!errors.maxPlayers}>
                                        <FormLabel color="gray.300">
                                            <FontAwesomeIcon icon={faUsers} style={{ marginRight: '8px' }} />
                                            Max Players (2-8)
                                        </FormLabel>
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

                                    <FormControl isInvalid={!!errors.minPlayers}>
                                        <FormLabel color="gray.300">
                                            <FontAwesomeIcon icon={faUsers} style={{ marginRight: '8px' }} />
                                            Min Players (2-Max)
                                        </FormLabel>
                                        <NumberInput
                                            value={formData.minPlayers}
                                            onChange={(value) => handleInputChange('minPlayers', value)}
                                            min={2}
                                            max={parseInt(formData.maxPlayers)}
                                        >
                                            <NumberInputField sx={{ color: 'white !important' }} />
                                        </NumberInput>
                                        {errors.minPlayers && <Text color="red.400" fontSize="sm">{errors.minPlayers}</Text>}
                                    </FormControl>
                                </SimpleGrid>

                                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6} w="full">

                                    <FormControl isInvalid={!!errors.entryFee}>
                                        <FormLabel color="gray.300">
                                            <FontAwesomeIcon icon={faCoins} style={{ marginRight: '8px' }} />
                                            Entry Fee (EGLD)
                                        </FormLabel>
                                        <NumberInput
                                            value={formData.entryFee}
                                            onChange={(value) => handleInputChange('entryFee', value)}
                                            min={0}
                                            precision={4}
                                        >
                                            <NumberInputField sx={{ color: 'white !important' }} />
                                        </NumberInput>
                                        {errors.entryFee && <Text color="red.400" fontSize="sm">{errors.entryFee}</Text>}
                                    </FormControl>

                                    <FormControl isInvalid={!!errors.duration}>
                                        <FormLabel color="gray.300">
                                            <FontAwesomeIcon icon={faClock} style={{ marginRight: '8px' }} />
                                            Duration
                                        </FormLabel>
                                        <Select
                                            value={formData.duration}
                                            onChange={(e) => handleInputChange('duration', e.target.value)}
                                            sx={{ color: 'white !important' }}
                                        >
                                            {DURATION_OPTIONS.map(option => (
                                                <option key={option.value} value={option.value}>
                                                    {option.label}
                                                </option>
                                            ))}
                                        </Select>
                                        {errors.duration && <Text color="red.400" fontSize="sm">{errors.duration}</Text>}
                                    </FormControl>
                                </SimpleGrid>

                                {/* Tournament Summary */}
                                <Card bg="gray.700" border="1px solid" borderColor="gray.600">
                                    <CardBody>
                                        <VStack spacing={3} align="start">
                                            <Text fontWeight="bold" color="gray.200">Tournament Summary</Text>
                                            <SimpleGrid columns={2} spacing={4} w="full">
                                                <Text color="gray.400">Max Prize Pool:</Text>
                                                <Text color="gray.200">
                                                    {(parseFloat(formData.entryFee) * parseInt(formData.maxPlayers)).toFixed(4)} EGLD
                                                </Text>
                                                <Text color="gray.400">Registration Period:</Text>
                                                <Text color="gray.200">
                                                    {DURATION_OPTIONS.find(d => d.value === formData.duration)?.label}
                                                </Text>
                                            </SimpleGrid>
                                            <Text color="gray.400" fontSize="sm" fontStyle="italic">
                                                * Prize pool depends on actual number of participants
                                            </Text>
                                            <Text color="blue.300" fontSize="sm" fontWeight="medium">
                                                ✓ You will automatically be joined to this tournament as the creator
                                            </Text>
                                        </VStack>
                                    </CardBody>
                                </Card>

                                <Button
                                    type="submit"
                                    colorScheme="blue"
                                    size="lg"
                                    width="full"
                                    isLoading={isSubmitting}
                                    loadingText="Creating Tournament..."
                                    isDisabled={!isConnected}
                                >
                                    <FontAwesomeIcon icon={faPlus} style={{ marginRight: '8px' }} />
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