use crate::models::{GameConfig, SpectatorBet, Tournament};
use multiversx_sc::imports::*;

#[multiversx_sc::module]
pub trait StorageModule {
    #[storage_mapper("registered_games")]
    fn registered_games(&self) -> MapMapper<u64, GameConfig<Self::Api>>;

    #[storage_mapper("active_tournaments")]
    fn active_tournaments(&self) -> MapMapper<u64, Tournament<Self::Api>>;

    #[storage_mapper("spectator_bets")]
    fn spectator_bets(
        &self,
        tournament_id: &u64,
        player: &ManagedAddress,
    ) -> SingleValueMapper<ManagedVec<SpectatorBet<Self::Api>>>;

    #[storage_mapper("spectator_pool_total")]
    fn spectator_pool_total(&self, tournament_id: &u64) -> SingleValueMapper<BigUint>;

    #[storage_mapper("spectator_claims")]
    fn spectator_claims(&self) -> MapMapper<ManagedBuffer, bool>;

    #[storage_mapper("accumulated_house_fees")]
    fn accumulated_house_fees(&self) -> SingleValueMapper<BigUint>;
}
