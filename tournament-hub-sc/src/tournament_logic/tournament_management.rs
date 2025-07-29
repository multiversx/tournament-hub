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
    ) {
        // Check that the game exists
        let games_len = self.registered_games().len() as u64;
        require!(
            game_index > 0 && game_index <= games_len,
            "Game not registered"
        );

        // Prepare tournament (no deadlines)
        let tournament = Tournament {
            game_id: game_index, // store the index as the game_id
            status: TournamentStatus::Joining,
            participants: ManagedVec::new(),
            final_podium: ManagedVec::new(),
            creator: self.blockchain().get_caller(),
        };

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

        let required_fee = self.tournament_fee().get();

        let tournaments_len = self.active_tournaments().len() as u64;
        require!(
            tournament_index > 0 && tournament_index <= tournaments_len,
            "Tournament does not exist"
        );

        require!(
            payment == required_fee,
            "Incorrect payment: must send exactly the tournament fee"
        );

        let mut tournament = self
            .active_tournaments()
            .get(tournament_index as usize)
            .clone();

        // Check if player can join based on status
        match tournament.status {
            TournamentStatus::Joining => {
                // No deadline check - players can join anytime
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

        // Add player (no prize_pool update)
        tournament.participants.push(caller.clone());

        self.active_tournaments()
            .set(tournament_index as usize, &tournament);
        self.player_joined_event(&(tournament_index as u64), &caller);
    }

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
        let fee = self.tournament_fee().get();
        let num_participants = BigUint::from(tournament.participants.len());
        &fee * &num_participants
    }
}
