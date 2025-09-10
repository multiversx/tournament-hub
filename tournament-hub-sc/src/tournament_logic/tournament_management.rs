use crate::models::{Tournament, TournamentStatus};

multiversx_sc::imports!();
multiversx_sc::derive_imports!();

#[multiversx_sc::module]
// Specify the supertrait with its full path as required by the linter
pub trait TournamentManagementModule:
    crate::storage::StorageModule + crate::events::EventsModule + crate::helpers::HelperModule
{
    #[endpoint(createTournament)]
    #[payable("EGLD")]
    fn create_tournament(
        &self,
        game_index: u64, // sequential index for the game (starting from 1)
        max_players: u32,
        min_players: u32, // minimum players required to start
        entry_fee: BigUint,
        duration: u64, // duration in seconds
        name: ManagedBuffer,
    ) {
        let payment = self.call_value().egld().clone_value();
        let caller = self.blockchain().get_caller();

        // Check that the game exists
        let games_len = self.registered_games().len() as u64;
        require!(
            game_index > 0 && game_index <= games_len,
            "Game not registered"
        );

        // Validate max_players (2-8)
        require!(
            max_players >= 2 && max_players <= 8,
            "Max players must be between 2 and 8"
        );

        // Validate min_players (must be <= max_players and >= 2)
        require!(
            min_players >= 2 && min_players <= max_players,
            "Min players must be between 2 and max_players"
        );

        // Validate duration (minimum 1 hour, maximum 30 days)
        require!(
            duration >= 3600 && duration <= 2592000,
            "Duration must be between 1 hour and 30 days"
        );

        // Validate name
        require!(
            name.len() > 0 && name.len() <= 100,
            "Name must be between 1 and 100 characters"
        );

        // Validate payment matches entry fee
        require!(
            payment == entry_fee,
            "Incorrect payment: must send exactly the tournament entry fee"
        );

        // Prepare tournament with new fields
        let mut tournament = Tournament {
            game_id: game_index, // store the index as the game_id
            status: TournamentStatus::Joining,
            participants: ManagedVec::new(),
            final_podium: ManagedVec::new(),
            creator: caller.clone(),
            max_players,
            min_players,
            entry_fee,
            duration,
            name,
            created_at: self.blockchain().get_block_timestamp(),
        };

        // Automatically add the creator as the first participant
        tournament.participants.push(caller.clone());

        // Add tournament to VecMapper; index will be the tournament ID (starting from 1)
        self.active_tournaments().push(&tournament);
        let tournament_index = self.active_tournaments().len() as u64; // index of the newly added tournament

        // Update user statistics
        self.update_user_tournament_created(&caller, tournament_index);

        // Update global statistics
        self.total_tournaments_created().update(|count| *count += 1);

        self.tournament_created_event(&tournament_index, &game_index, &caller);
    }

    #[endpoint(joinTournament)]
    #[payable("EGLD")]
    fn join_tournament(&self, tournament_index: u64) {
        let payment = self.call_value().egld().clone_value();
        let caller = self.blockchain().get_caller();

        let tournaments_len = self.active_tournaments().len() as u64;
        require!(
            tournament_index > 0 && tournament_index <= tournaments_len,
            "Tournament does not exist"
        );

        let mut tournament = self
            .active_tournaments()
            .get(tournament_index as usize)
            .clone();

        // Check if player can join based on status
        match tournament.status {
            TournamentStatus::Joining | TournamentStatus::ReadyToStart => {
                // Check if tournament is still open (duration check)
                let current_time = self.blockchain().get_block_timestamp();
                let tournament_end_time = tournament.created_at + tournament.duration;

                require!(
                    current_time < tournament_end_time,
                    "Tournament registration period has ended"
                );
            }
            _ => {
                sc_panic!("Cannot join tournament in current status");
            }
        }

        // Check if player is already participating
        for participant in tournament.participants.iter() {
            require!(
                participant.clone_value() != caller.clone(),
                "Player already joined"
            );
        }

        // Check if tournament is full
        require!(
            tournament.participants.len() < tournament.max_players as usize,
            "Tournament is full"
        );

        // Check payment matches tournament entry fee
        require!(
            payment == tournament.entry_fee,
            "Incorrect payment: must send exactly the tournament entry fee"
        );

        // Add player
        tournament.participants.push(caller.clone());

        self.active_tournaments()
            .set(tournament_index as usize, &tournament);

        // Update user statistics
        self.update_user_tournament_joined(&caller, tournament_index);

        self.player_joined_event(&(tournament_index as u64), &caller);

        // Check if minimum players reached and update status to ReadyToStart
        if tournament.participants.len() >= tournament.min_players as usize {
            tournament.status = TournamentStatus::ReadyToStart;
            self.active_tournaments()
                .set(tournament_index as usize, &tournament);
            self.tournament_ready_to_start_event(&tournament_index);
        }
    }

    #[endpoint(startGame)]
    fn start_game(&self, tournament_index: u64) {
        let caller = self.blockchain().get_caller();

        let tournaments_len = self.active_tournaments().len() as u64;
        require!(
            tournament_index > 0 && tournament_index <= tournaments_len,
            "Tournament does not exist"
        );

        let mut tournament = self
            .active_tournaments()
            .get(tournament_index as usize)
            .clone();

        // Only allow starting if status is ReadyToStart
        require!(
            tournament.status == TournamentStatus::ReadyToStart,
            "Tournament is not ready to start"
        );

        // Verify minimum players requirement
        require!(
            tournament.participants.len() >= tournament.min_players as usize,
            "Not enough players to start the game"
        );

        // Transition to Active status
        tournament.status = TournamentStatus::Active;
        self.active_tournaments()
            .set(tournament_index as usize, &tournament);

        // Update games_played for all participants when tournament starts
        for participant in tournament.participants.iter() {
            self.update_user_stats(&participant, |stats| {
                stats.games_played += 1;
                stats.last_activity = self.blockchain().get_block_timestamp();
            });
        }

        self.game_started_event(&tournament_index, &caller);
    }

    // Keep the old setTournamentFee for backward compatibility (now sets default fee)
    #[endpoint(setTournamentFee)]
    fn set_tournament_fee(&self, new_fee: BigUint) {
        self.tournament_fee().set(&new_fee);
    }

    #[view(getPrizePool)]
    fn get_prize_pool(&self, tournament_index: u64) -> BigUint {
        let tournaments_len = self.active_tournaments().len() as u64;
        require!(
            tournament_index > 0 && tournament_index <= tournaments_len,
            "Tournament does not exist"
        );
        let tournament = self
            .active_tournaments()
            .get(tournament_index as usize)
            .clone();
        let fee = tournament.entry_fee;
        let num_participants = BigUint::from(tournament.participants.len());
        &fee * &num_participants
    }

    #[only_owner]
    #[endpoint(clearAllTournaments)]
    fn clear_all_tournaments(&self) {
        // Clear all tournaments from storage
        self.active_tournaments().clear();

        // Emit event for logging
        self.tournaments_cleared_event();
    }

    // Helper functions for user statistics
    fn update_user_tournament_created(&self, user: &ManagedAddress, tournament_id: u64) {
        // Add tournament to user's created tournaments
        self.user_tournaments_created(user).insert(tournament_id);

        // Update user stats
        self.update_user_stats(user, |stats| {
            stats.tournaments_created += 1;
            stats.last_activity = self.blockchain().get_block_timestamp();
        });
    }

    fn update_user_tournament_joined(&self, user: &ManagedAddress, tournament_id: u64) {
        // Add tournament to user's joined tournaments
        self.user_tournaments_joined(user).insert(tournament_id);

        // Update user stats - only update last_activity when joining
        self.update_user_stats(user, |stats| {
            stats.last_activity = self.blockchain().get_block_timestamp();
        });
    }
}
