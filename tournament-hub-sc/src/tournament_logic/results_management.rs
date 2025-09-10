use crate::models::TournamentStatus;

multiversx_sc::imports!();
multiversx_sc::derive_imports!();

#[multiversx_sc::module]
pub trait ResultsManagementModule:
    crate::storage::StorageModule + crate::helpers::HelperModule + crate::events::EventsModule
{
    #[endpoint(submitResults)]
    fn submit_results(
        &self,
        tournament_index: usize,
        winner_podium: ManagedVec<ManagedAddress>,
        signed_result: ManagedBuffer,
    ) {
        let tournaments_len = self.active_tournaments().len();
        require!(
            tournament_index > 0 && tournament_index <= tournaments_len,
            "Tournament does not exist"
        );

        let mut tournament = self.active_tournaments().get(tournament_index).clone();
        let game_index = tournament.game_id as usize;
        let games_len = self.registered_games().len();
        require!(
            game_index > 0 && game_index <= games_len,
            "Game not registered"
        );
        let game_config = self.registered_games().get(game_index).clone();

        require!(
            tournament.status == TournamentStatus::Active,
            "UNIQUE_ERROR_MESSAGE_FOR_DEBUGGING_12345"
        );

        self.verify_result_signature(
            &(tournament_index as u64),
            &winner_podium,
            &signed_result,
            &game_config,
        );
        self.results_submitted_event(&(tournament_index as u64), &self.blockchain().get_caller());

        // Validate winner podium
        require!(
            winner_podium.len() == game_config.podium_size as usize,
            "Winner podium size mismatch"
        );

        // Verify all winners are participants
        for winner in winner_podium.iter() {
            let mut found = false;
            for participant in tournament.participants.iter() {
                if participant == winner {
                    found = true;
                    break;
                }
            }
            require!(found, "Winner not found in participants");
        }

        tournament.status = TournamentStatus::ProcessingResults;
        tournament.final_podium = winner_podium.clone();

        // Calculate and distribute prizes
        self.distribute_player_prizes(&tournament, &game_config);
        <Self as crate::events::EventsModule>::prizes_distributed_event(
            self,
            &(tournament_index as u64),
        );

        tournament.status = TournamentStatus::Completed;
        self.active_tournaments().set(tournament_index, &tournament);

        // Update global statistics
        self.total_tournaments_completed()
            .update(|count| *count += 1);
    }
}
