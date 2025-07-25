import { renderHook } from '@testing-library/react';
import axios from 'axios';
import { useGetPongTransaction } from '../useGetPongTransaction';

const pongTransaction = {
  nonce: 10702,
  value: '0',
  receiver: 'erd1qqqqqqqqqqqqqpgqeqv9v8fydgdh8arf6kfd5y7uvycv9kx3d8ssz87x92',
  sender: 'erd1axhx4kenjlae6sknq7zjg2g4fvzavv979r2fg425p62wkl84avtqsf7vvv',
  gasPrice: 1000000000,
  gasLimit: 6000000,
  data: 'cG9uZw==',
  chainID: 'D',
  version: 1
};

describe('useGetPongTransaction', () => {
  it('should return Pong transaction', async () => {
    jest.spyOn(axios, 'post').mockResolvedValueOnce({
      data: pongTransaction
    });

    const { result } = renderHook(() => useGetPongTransaction());
    const transactionReceived = await result.current();

    expect(transactionReceived).toBe(pongTransaction);
  });

  it('should return null', async () => {
    jest.spyOn(axios, 'post').mockRejectedValueOnce(new Error('error'));

    const { result } = renderHook(() => useGetPongTransaction());
    const transactionReceived = await result.current();

    expect(transactionReceived).toBeNull();
  });
});
