use crate::models::{GameConfig, SpectatorBet, Tournament, UserStats};
use multiversx_sc::imports::*;

#[multiversx_sc::module]
pub trait StorageModule {
    #[storage_mapper("registered_games")]
    fn registered_games(&self) -> VecMapper<GameConfig<Self::Api>>;

    #[storage_mapper("active_tournaments")]
    fn active_tournaments(&self) -> VecMapper<Tournament<Self::Api>>;

    #[storage_mapper("spectator_bets")]
    fn spectator_bets(
        &self,
        tournament_id: &u64,
        player: &ManagedAddress,
    ) -> SingleValueMapper<ManagedVec<SpectatorBet<Self::Api>>>;

    #[storage_mapper("spectator_pool_total")]
    fn spectator_pool_total(&self, tournament_id: &u64) -> SingleValueMapper<BigUint>;

    #[storage_mapper("spectator_claims")]
    fn spectator_claims(&self) -> UnorderedSetMapper<ManagedBuffer>;

    #[storage_mapper("house_fee_percentage")]
    fn house_fee_percentage(&self) -> SingleValueMapper<u32>;

    #[storage_mapper("accumulated_house_fees")]
    fn accumulated_house_fees(&self) -> SingleValueMapper<BigUint>;

    #[storage_mapper("tournament_fee")]
    fn tournament_fee(&self) -> SingleValueMapper<BigUint<Self::Api>>;

    // User statistics storage
    #[storage_mapper("user_stats")]
    fn user_stats(&self, user: &ManagedAddress) -> SingleValueMapper<UserStats<Self::Api>>;

    // User tournament participation tracking
    #[storage_mapper("user_tournaments_created")]
    fn user_tournaments_created(&self, user: &ManagedAddress) -> UnorderedSetMapper<u64>;

    #[storage_mapper("user_tournaments_joined")]
    fn user_tournaments_joined(&self, user: &ManagedAddress) -> UnorderedSetMapper<u64>;

    #[storage_mapper("user_tournaments_won")]
    fn user_tournaments_won(&self, user: &ManagedAddress) -> UnorderedSetMapper<u64>;

    // Global statistics
    #[storage_mapper("total_tournaments_created")]
    fn total_tournaments_created(&self) -> SingleValueMapper<u64>;

    #[storage_mapper("total_tournaments_completed")]
    fn total_tournaments_completed(&self) -> SingleValueMapper<u64>;

    // Prize statistics
    #[storage_mapper("max_prize_won")]
    fn max_prize_won(&self) -> SingleValueMapper<BigUint>;

    #[storage_mapper("total_prize_distributed")]
    fn total_prize_distributed(&self) -> SingleValueMapper<BigUint>;
}
