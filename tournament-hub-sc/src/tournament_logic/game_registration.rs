use crate::models::GameConfig;

multiversx_sc::imports!();
multiversx_sc::derive_imports!();

#[multiversx_sc::module]
pub trait GameRegistrationModule: crate::storage::StorageModule {
    #[only_owner]
    #[endpoint(registerGame)]
    fn register_game(
        &self,
        signing_server_address: ManagedAddress,
        podium_size: u32,
        prize_distribution_percentages: ManagedVec<u32>,
        allow_late_join: bool,
    ) {
        // Validate inputs
        require!(podium_size > 0, "Podium size must be greater than 0");
        require!(
            prize_distribution_percentages.len() == podium_size as usize,
            "Prize distribution must match podium size"
        );

        // Validate that percentages sum to 10,000 (100.00%)
        let mut total_percentage = 0u32;
        for percentage in prize_distribution_percentages.iter() {
            total_percentage += percentage;
        }
        require!(
            total_percentage == 10_000,
            "Prize distribution percentages must sum to 10,000 (100.00%)"
        );

        let house_fee_percentage = self.house_fee_percentage().get();

        let game_config = GameConfig {
            signing_server_address,
            podium_size,
            prize_distribution_percentages,
            house_fee_percentage,
            allow_late_join,
        };

        self.registered_games().push(&game_config);
    }

    #[storage_mapper("house_fee_percentage")]
    fn house_fee_percentage(&self) -> SingleValueMapper<u32>;

    #[only_owner]
    #[endpoint(setHouseFeePercentage)]
    fn set_house_fee_percentage(&self, new_fee: u32) {
        require!(
            new_fee <= 10_000,
            "House fee cannot exceed 10,000 (100.00%)"
        );
        self.house_fee_percentage().set(&new_fee);
    }
}
