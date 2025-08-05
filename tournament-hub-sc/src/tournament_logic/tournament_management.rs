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
        game_index: u64, // sequential index for the game (starting from 1)
        max_players: u32,
        entry_fee: BigUint,
        duration: u64, // duration in seconds
        name: ManagedBuffer,
    ) {
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

        // Prepare tournament with new fields
        let mut tournament = Tournament {
            game_id: game_index, // store the index as the game_id
            status: TournamentStatus::Joining,
            participants: ManagedVec::new(),
            final_podium: ManagedVec::new(),
            creator: self.blockchain().get_caller(),
            max_players,
            entry_fee,
            duration,
            name,
            created_at: self.blockchain().get_block_timestamp(),
        };

        // Automatically add the creator as the first participant
        tournament.participants.push(self.blockchain().get_caller());

        // Add tournament to VecMapper; index will be the tournament ID (starting from 1)
        self.active_tournaments().push(&tournament);
        let tournament_index = self.active_tournaments().len() as u64; // index of the newly added tournament
        self.tournament_created_event(
            &tournament_index,
            &game_index,
            &self.blockchain().get_caller(),
        );
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
            TournamentStatus::Joining => {
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
        self.player_joined_event(&(tournament_index as u64), &caller);
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
}
