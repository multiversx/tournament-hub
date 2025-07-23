use crate::models::{Tournament, TournamentStatus};

multiversx_sc::imports!();
multiversx_sc::derive_imports!();

#[multiversx_sc::module]
// Specify the supertrait with its full path as required by the linter
pub trait TournamentManagementModule:
    crate::storage::StorageModule + crate::events::EventsModule
{
    #[endpoint(createTournament)]
    fn create_tournament(
        &self,
        game_index: usize, // sequential index for the game (starting from 1)
        entry_fee: BigUint,
        join_deadline: u64,
        play_deadline: u64,
    ) {
        // Check that the game exists
        let games_len = self.registered_games().len();
        require!(
            game_index > 0 && game_index <= games_len,
            "Game not registered"
        );

        // Prepare tournament
        let tournament = Tournament {
            game_id: game_index as u64, // store the index as the game_id
            status: TournamentStatus::Joining,
            entry_fee,
            participants: ManagedVec::new(),
            prize_pool: BigUint::zero(),
            join_deadline,
            play_deadline,
            final_podium: ManagedVec::new(),
            creator: self.blockchain().get_caller(),
        };

        // Add tournament to VecMapper; index will be the tournament ID (starting from 1)
        self.active_tournaments().push(&tournament);
        let tournament_index = self.active_tournaments().len(); // index of the newly added tournament
        self.tournament_created_event(
            &(tournament_index as u64),
            &(game_index as u64),
            &self.blockchain().get_caller(),
        );
    }

    #[endpoint(joinTournament)]
    #[payable("EGLD")]
    fn join_tournament(&self, tournament_index: usize) {
        let payment = self.call_value().egld().clone_value();
        let caller = self.blockchain().get_caller();
        let current_time = self.blockchain().get_block_timestamp();

        let tournaments_len = self.active_tournaments().len();
        require!(
            tournament_index > 0 && tournament_index <= tournaments_len,
            "Tournament does not exist"
        );

        let mut tournament = self.active_tournaments().get(tournament_index).clone();
        let game_index = tournament.game_id as usize;
        let game_config = self.registered_games().get(game_index).clone();

        // Check payment amount
        require!(payment == tournament.entry_fee, "Incorrect entry fee");

        // Check if player can join based on status and timing
        match tournament.status {
            TournamentStatus::Joining => {
                self.debug_current_time_event(&current_time);
                self.debug_join_deadline_event(&tournament.join_deadline);

                require!(
                    current_time <= tournament.join_deadline,
                    "Join deadline has passed"
                );
            }
            TournamentStatus::Playing => {
                require!(
                    game_config.allow_late_join,
                    "Late joining not allowed for this game"
                );
                require!(
                    current_time <= tournament.play_deadline,
                    "Play deadline has passed"
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

        // Add player and update prize pool
        tournament.participants.push(caller.clone());
        tournament.prize_pool += &payment;

        self.active_tournaments().set(tournament_index, &tournament);
        self.player_joined_event(&(tournament_index as u64), &caller);
    }

    #[endpoint(startTournament)]
    fn start_tournament(&self, tournament_index: usize) {
        let tournaments_len = self.active_tournaments().len();
        require!(
            tournament_index > 0 && tournament_index <= tournaments_len,
            "Tournament does not exist"
        );

        let mut tournament = self.active_tournaments().get(tournament_index).clone();

        require!(
            tournament.status == TournamentStatus::Joining,
            "Tournament is not in joining phase"
        );

        let current_time = self.blockchain().get_block_timestamp();
        let join_deadline_for_event = tournament.join_deadline;
        let status_for_event = tournament.status.clone();

        self.debug_current_time_event(&current_time);
        self.debug_join_deadline_event(&join_deadline_for_event);
        self.debug_tournament_status_event(&(status_for_event as u32));

        require!(
            current_time >= tournament.join_deadline,
            "Join deadline has not passed yet"
        );

        tournament.status = TournamentStatus::Playing;
        self.active_tournaments().set(tournament_index, &tournament);
        self.tournament_started_event(&(tournament_index as u64));
    }
}
