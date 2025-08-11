use crate::models::{GameConfig, SpectatorBet, Tournament};

multiversx_sc::imports!();

#[multiversx_sc::module]
pub trait ViewsModule: crate::storage::StorageModule {
    #[view(getGameConfig)]
    fn get_game_config(&self, game_index: usize) -> GameConfig<Self::Api> {
        let games_len = self.registered_games().len();
        require!(
            game_index > 0 && game_index <= games_len,
            "Invalid game index"
        );
        self.registered_games().get(game_index).clone()
    }

    #[view(getTournament)]
    fn get_tournament(&self, tournament_index: usize) -> Tournament<Self::Api> {
        let tournaments_len = self.active_tournaments().len();
        require!(
            tournament_index > 0 && tournament_index <= tournaments_len,
            "Tournament does not exist"
        );
        self.active_tournaments().get(tournament_index).clone()
    }

    #[view(getNumberOfTournaments)]
    fn get_number_of_tournaments(&self) -> usize {
        self.active_tournaments().len()
    }

    #[view(getActiveTournamentIds)]
    fn get_active_tournament_ids(&self) -> ManagedVec<u64> {
        let mut ids = ManagedVec::new();
        let no_of_tournaments = self.active_tournaments().len();

        // Only return IDs for tournaments that actually exist
        for id in 1..=no_of_tournaments {
            // Check if the tournament exists by trying to get it
            // If it doesn't exist, the get() call will panic, but that's okay
            // because we're only iterating up to the actual length
            let _tournament = self.active_tournaments().get(id);
            ids.push(id as u64);
        }
        ids
    }

    #[view(getSpectatorBets)]
    fn get_spectator_bets(
        &self,
        tournament_index: usize,
        player: &ManagedAddress,
    ) -> ManagedVec<SpectatorBet<Self::Api>> {
        self.spectator_bets(&(tournament_index as u64), player)
            .get()
    }

    #[view(getSpectatorPoolTotal)]
    fn get_spectator_pool_total(&self, tournament_index: usize) -> BigUint {
        self.spectator_pool_total(&(tournament_index as u64)).get()
    }

    #[view(getAccumulatedHouseFees)]
    fn get_accumulated_house_fees(&self) -> BigUint {
        self.accumulated_house_fees().get()
    }

    #[view(getTournamentFee)]
    fn get_tournament_fee(&self) -> BigUint<Self::Api> {
        self.tournament_fee().get()
    }
}
