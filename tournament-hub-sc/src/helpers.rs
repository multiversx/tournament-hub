multiversx_sc::imports!();
multiversx_sc::derive_imports!();

use crate::models::{GameConfig, Tournament, UserStats};

#[multiversx_sc::module]
pub trait HelperModule: crate::storage::StorageModule + crate::events::EventsModule {
    fn verify_result_signature(
        &self,
        tournament_id: &u64,
        winner_podium: &ManagedVec<ManagedAddress>,
        signed_result: &ManagedBuffer,
        game_config: &GameConfig<Self::Api>,
    ) {
        // Debug: Log the tournament_id value
        self.debug_tournament_id_event(tournament_id);

        // Construct message exactly as the server does:
        // tournament_id (8 bytes big-endian) + raw address bytes for each podium address
        let mut message = ManagedBuffer::new();
        message.append(&ManagedBuffer::from(&tournament_id.to_be_bytes()[..]));
        for addr in winner_podium.iter() {
            // ManagedAddress has as_managed_buffer() to get the buffer representation
            message.append(&addr.as_managed_buffer());
        }

        // Debug: Log the constructed message
        self.debug_message_event(&message);
        sc_print!("Verifying result signature...{}", message);

        // The public key should be stored in game_config.signing_server_address
        let pubkey = game_config.signing_server_address.as_managed_buffer();

        // Debug: Log the signing server address (public key) as hex
        self.debug_message_event(&pubkey);

        self.debug_message_length_event(message.len());

        self.debug_message_event(&signed_result);

        // Verify the signature
        // Use a feature flag to allow bypassing signature verification in scenario tests
        #[cfg(not(feature = "no-sig-check"))]
        self.crypto()
            .verify_ed25519(&pubkey, &message, signed_result);

        #[cfg(feature = "no-sig-check")]
        {
            // skip signature verification
        }
    }

    fn distribute_player_prizes(
        &self,
        tournament: &Tournament<Self::Api>,
        game_config: &GameConfig<Self::Api>,
    ) {
        let num_participants = BigUint::from(tournament.participants.len());
        let tournament_fee = self.tournament_fee().get();
        let total_pool = &tournament_fee * &num_participants;
        let house_fee = &total_pool * game_config.house_fee_percentage / 10_000u32;
        let remaining_pool = &total_pool - &house_fee;

        // Accumulate house fee in contract storage
        if house_fee > 0 {
            let mut accumulated_fees = self.accumulated_house_fees().get();
            accumulated_fees += &house_fee;
            self.accumulated_house_fees().set(&accumulated_fees);
        }

        // Distribute prizes to winners and update user statistics
        for (position, winner) in tournament.final_podium.iter().enumerate() {
            let percentage = game_config.prize_distribution_percentages.get(position);
            let prize_amount = &remaining_pool * percentage / 10_000u32;

            if prize_amount > 0 {
                self.send().direct_egld(&winner, &prize_amount);

                // Update winner's statistics
                self.update_user_tournament_won(&winner, tournament.game_id, &prize_amount);
            }
        }

        // Update statistics for all participants (winners and losers)
        for participant in tournament.participants.iter() {
            let mut is_winner = false;
            for winner in tournament.final_podium.iter() {
                if participant == winner {
                    is_winner = true;
                    break;
                }
            }

            if !is_winner {
                // Update loser's statistics
                self.update_user_tournament_lost(&participant, &tournament.entry_fee);
            }
        }
    }

    fn get_claim_key(&self, tournament_id: &u64, caller: &ManagedAddress) -> ManagedBuffer {
        let mut key = ManagedBuffer::new();
        let tournament_id_buf = ManagedBuffer::from(&tournament_id.to_be_bytes()[..]);
        key.append(&tournament_id_buf);
        key.append(&ManagedBuffer::from(b"_"));
        key.append(caller.as_managed_buffer());
        key
    }

    // Helper functions for user statistics (moved from tournament_management)
    fn update_user_tournament_won(
        &self,
        user: &ManagedAddress,
        tournament_id: u64,
        prize_amount: &BigUint,
    ) {
        // Add tournament to user's won tournaments
        self.user_tournaments_won(user).insert(tournament_id);

        // Update user stats
        self.update_user_stats(user, |stats| {
            stats.tournaments_won += 1;
            stats.wins += 1;
            stats.tokens_won += prize_amount;
            stats.current_streak += 1;
            if stats.current_streak > stats.best_streak {
                stats.best_streak = stats.current_streak;
            }
            stats.last_activity = self.blockchain().get_block_timestamp();
        });
    }

    fn update_user_tournament_lost(&self, user: &ManagedAddress, entry_fee: &BigUint) {
        // Update user stats
        self.update_user_stats(user, |stats| {
            stats.losses += 1;
            stats.tokens_spent += entry_fee;
            stats.current_streak = 0; // Reset streak on loss
            stats.last_activity = self.blockchain().get_block_timestamp();
        });
    }

    fn get_or_create_user_stats(&self, user: &ManagedAddress) -> UserStats<Self::Api> {
        if self.user_stats(user).is_empty() {
            // Create default stats for new user
            UserStats {
                games_played: 0,
                wins: 0,
                losses: 0,
                win_rate: 0,
                tokens_won: BigUint::zero(),
                tokens_spent: BigUint::zero(),
                tournaments_created: 0,
                tournaments_won: 0,
                current_streak: 0,
                best_streak: 0,
                last_activity: 0,
                member_since: self.blockchain().get_block_timestamp(),
            }
        } else {
            self.user_stats(user).get()
        }
    }

    fn update_user_stats<F>(&self, user: &ManagedAddress, update_fn: F)
    where
        F: FnOnce(&mut UserStats<Self::Api>),
    {
        let mut stats = self.get_or_create_user_stats(user);

        // Initialize member_since if this is the first activity
        if stats.member_since == 0 {
            stats.member_since = self.blockchain().get_block_timestamp();
        }

        update_fn(&mut stats);

        // Calculate win rate
        if stats.games_played > 0 {
            stats.win_rate = (stats.wins as u64 * 10000 / stats.games_played as u64) as u32;
            // Store as basis points
        }

        self.user_stats(user).set(&stats);
    }
}
