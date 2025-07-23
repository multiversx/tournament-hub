import { PropsWithChildren } from 'react';
import { Box } from '@chakra-ui/react';

export const PageWrapper = ({ children }: PropsWithChildren) => {
  return (
    <Box
      display="flex"
      flex="1"
      borderRadius="xl"
      bg="gray.900"
      p={6}
      flexDirection={{ base: 'column', sm: 'row' }}
      alignItems="center"
      justifyContent="center"
    >
      {children}
    </Box>
  );
};
