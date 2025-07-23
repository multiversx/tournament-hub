import { EnvironmentsEnum } from 'lib';

export * from './sharedConfig';

export const API_URL = 'https://devnet-api.multiversx.com';
export const contractAddress =
  'erd1qqqqqqqqqqqqqpgq0uqzyw46yc8zdcpazvwhscl2m92qpmegd8ssja5slh';
export const environment = EnvironmentsEnum.devnet;
export const sampleAuthenticatedDomains = [API_URL];
