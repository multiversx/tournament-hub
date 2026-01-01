import { EnvironmentsEnum } from 'lib';

export * from './sharedConfig';

export const API_URL = 'https://devnet-api.multiversx.com';
export const contractAddress =
    'erd1qqqqqqqqqqqqqpgq9zhclje8g8n6xlsaj0ds6xj87lt4rgtzd8sspxwzu7';
export const environment = EnvironmentsEnum.devnet;
export const sampleAuthenticatedDomains = [API_URL];
