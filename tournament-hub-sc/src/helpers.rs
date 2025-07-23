multiversx_sc::imports!();
multiversx_sc::derive_imports!();

use crate::models::{GameConfig, Tournament};

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
        // Calculate house fee (basis points: 10,000 = 100.00%)
        let house_fee = &tournament.prize_pool * game_config.house_fee_percentage / 10_000u32;
        let remaining_pool = &tournament.prize_pool - &house_fee;

        // Accumulate house fee in contract storage
        if house_fee > 0 {
            let mut accumulated_fees = self.accumulated_house_fees().get();
            accumulated_fees += &house_fee;
            self.accumulated_house_fees().set(&accumulated_fees);
        }

        // Distribute prizes to winners
        for (position, winner) in tournament.final_podium.iter().enumerate() {
            let percentage = game_config.prize_distribution_percentages.get(position);
            let prize_amount = &remaining_pool * percentage / 10_000u32;

            if prize_amount > 0 {
                self.send().direct_egld(&winner, &prize_amount);
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
}
