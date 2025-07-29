import { EnvironmentsEnum } from 'lib';

export * from './sharedConfig';

export const API_URL = 'https://devnet-api.multiversx.com';
export const contractAddress =
  'erd1qqqqqqqqqqqqqpgqeqv9v8fydgdh8arf6kfd5y7uvycv9kx3d8ssz87x92';
export const environment = EnvironmentsEnum.devnet;
export const sampleAuthenticatedDomains = [API_URL];
