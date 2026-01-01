multiversx_sc::imports!();

#[multiversx_sc::module]
pub trait EventsModule {
    #[event("tournamentCreated")]
    fn tournament_created_event(
        &self,
        #[indexed] tournament_id: &u64,
        #[indexed] game_id: &u64,
        creator: &ManagedAddress,
    );

    #[event("playerJoined")]
    fn player_joined_event(
        &self,
        #[indexed] tournament_id: &u64,
        #[indexed] player: &ManagedAddress,
    );

    #[event("tournamentStarted")]
    fn tournament_started_event(&self, #[indexed] tournament_id: &u64);

    #[event("resultsSubmitted")]
    fn results_submitted_event(
        &self,
        #[indexed] tournament_id: &u64,
        #[indexed] submitter: &ManagedAddress,
    );

    #[event("prizesDistributed")]
    fn prizes_distributed_event(&self, #[indexed] tournament_id: &u64);

    #[event("debugCurrentTime")]
    fn debug_current_time_event(&self, #[indexed] current_time: &u64);

    #[event("debugTournamentStatus")]
    fn debug_tournament_status_event(&self, #[indexed] status: &u32);

    #[event("debugTournamentId")]
    fn debug_tournament_id_event(&self, #[indexed] tournament_id: &u64);

    #[event("debugMessage")]
    fn debug_message_event(&self, #[indexed] message: &ManagedBuffer);

    #[event("debugMessageLength")]
    fn debug_message_length_event(&self, #[indexed] message_length: usize);

    #[event("tournamentsCleared")]
    fn tournaments_cleared_event(&self);

    #[event("tournamentReadyToStart")]
    fn tournament_ready_to_start_event(&self, #[indexed] tournament_id: &u64);

    #[event("gameStarted")]
    fn game_started_event(
        &self,
        #[indexed] tournament_id: &u64,
        #[indexed] starter: &ManagedAddress,
    );
}
