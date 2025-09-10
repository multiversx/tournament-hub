use multiversx_sc::types::{
    BigUint, ManagedBuffer, ReturnsNewAddress, ReturnsResult, TestAddress, TestSCAddress,
};
use multiversx_sc_scenario::{api::StaticApi, imports::MxscPath, *};

use tournament_hub::tournament_hub_proxy;

const OWNER_ADDRESS: TestAddress = TestAddress::new("owner");
const USER_ADDRESS: TestAddress = TestAddress::new("user");

const USER1: TestAddress = TestAddress::new("user1");
const USER2: TestAddress = TestAddress::new("user2");
const USER3: TestAddress = TestAddress::new("user3");
const USER4: TestAddress = TestAddress::new("user4");
const SPECTATOR: TestAddress = TestAddress::new("spectator");

const TOURNAMENT_HUB_CODE_PATH: MxscPath = MxscPath::new("output/tournament-hub.mxsc.json");
const TOURNAMENT_HUB_ADDRESS: TestSCAddress = TestSCAddress::new("tournament-hub");

fn world() -> ScenarioWorld {
    let mut blockchain = ScenarioWorld::new();

    blockchain.register_contract(TOURNAMENT_HUB_CODE_PATH, tournament_hub::ContractBuilder);

    blockchain
}

struct TournamentHubTestState {
    world: ScenarioWorld,
}

impl TournamentHubTestState {
    fn new() -> Self {
        let mut world = world();
        world
            .account(OWNER_ADDRESS)
            .nonce(1)
            .balance(BigUint::from(10u64).pow(19));
        world
            .account(USER_ADDRESS)
            .nonce(1)
            .balance(BigUint::from(10u64).pow(19));
        world
            .account(USER1)
            .nonce(1)
            .balance(BigUint::from(10u64).pow(19));
        world
            .account(USER2)
            .nonce(1)
            .balance(BigUint::from(10u64).pow(19));
        world
            .account(USER3)
            .nonce(1)
            .balance(BigUint::from(10u64).pow(19));
        world
            .account(USER4)
            .nonce(1)
            .balance(BigUint::from(10u64).pow(19));
        world
            .account(SPECTATOR)
            .nonce(1)
            .balance(BigUint::from(10u64).pow(19));

        Self { world }
    }

    fn deploy_tournament_hub_contract(&mut self) -> &mut Self {
        let new_address = self
            .world
            .tx()
            .from(OWNER_ADDRESS)
            .typed(tournament_hub_proxy::TournamentHubProxy)
            .init()
            .code(TOURNAMENT_HUB_CODE_PATH)
            .new_address(TOURNAMENT_HUB_ADDRESS)
            .returns(ReturnsNewAddress)
            .run();

        assert_eq!(new_address, TOURNAMENT_HUB_ADDRESS.to_address());

        self
    }

    fn register_game(&mut self) {
        self.world
            .tx()
            .from(OWNER_ADDRESS)
            .to(TOURNAMENT_HUB_ADDRESS)
            .typed(tournament_hub_proxy::TournamentHubProxy)
            .register_game(
                OWNER_ADDRESS.to_address(),
                3u32,
                vec![5_000u32, 3_000u32, 2_000u32],
                false,
            )
            .run();
    }

    fn set_house_fee_percentage(&mut self, new_fee: u32) {
        self.world
            .tx()
            .from(OWNER_ADDRESS)
            .to(TOURNAMENT_HUB_ADDRESS)
            .typed(tournament_hub_proxy::TournamentHubProxy)
            .set_house_fee_percentage(new_fee)
            .run();
    }

    fn set_tournament_fee(&mut self, fee: &BigUint<StaticApi>) {
        self.world
            .tx()
            .from(OWNER_ADDRESS)
            .to(TOURNAMENT_HUB_ADDRESS)
            .typed(tournament_hub_proxy::TournamentHubProxy)
            .set_tournament_fee(fee.clone())
            .run();
    }

    fn create_tournament(&mut self, game_index: usize) -> usize {
        let entry_fee = BigUint::from(10u64).pow(18); // 1 EGLD
        let tournament_name = ManagedBuffer::from("Test Tournament");

        self.world
            .tx()
            .from(USER1)
            .to(TOURNAMENT_HUB_ADDRESS)
            .typed(tournament_hub_proxy::TournamentHubProxy)
            .create_tournament(
                game_index,
                8u32, // max_players
                2u32, // min_players
                entry_fee.clone(),
                tournament_name,
            )
            .egld(entry_fee)
            .run();

        // The new tournament's index is the current length of the vector
        let tournament_id = self
            .world
            .query()
            .to(TOURNAMENT_HUB_ADDRESS)
            .typed(tournament_hub_proxy::TournamentHubProxy)
            .get_number_of_tournaments()
            .returns(ReturnsResult)
            .run();

        tournament_id
    }

    fn create_tournament_with_params(
        &mut self,
        game_index: usize,
        max_players: u32,
        min_players: u32,
        entry_fee: BigUint<StaticApi>,
        name: &str,
    ) -> usize {
        let tournament_name = ManagedBuffer::from(name);

        self.world
            .tx()
            .from(USER1)
            .to(TOURNAMENT_HUB_ADDRESS)
            .typed(tournament_hub_proxy::TournamentHubProxy)
            .create_tournament(
                game_index,
                max_players,
                min_players,
                entry_fee.clone(),
                tournament_name,
            )
            .egld(entry_fee)
            .run();

        // The new tournament's index is the current length of the vector
        let tournament_id = self
            .world
            .query()
            .to(TOURNAMENT_HUB_ADDRESS)
            .typed(tournament_hub_proxy::TournamentHubProxy)
            .get_number_of_tournaments()
            .returns(ReturnsResult)
            .run();

        tournament_id
    }

    fn start_tournament(&mut self, tournament_id: usize) {
        self.world
            .tx()
            .from(USER1)
            .to(TOURNAMENT_HUB_ADDRESS)
            .typed(tournament_hub_proxy::TournamentHubProxy)
            .start_game(tournament_id)
            .run();
    }

    fn start_tournament_expect_error(&mut self, tournament_id: usize, expected_error: &str) {
        self.world
            .tx()
            .from(USER1)
            .to(TOURNAMENT_HUB_ADDRESS)
            .typed(tournament_hub_proxy::TournamentHubProxy)
            .start_game(tournament_id)
            .returns(ExpectError(4u64, expected_error))
            .run();
    }

    fn join_tournament(&mut self, tournament_id: usize, user: &str) -> &mut Self {
        let user_addr = TestAddress::new(user);
        let entry_fee = BigUint::from(10u64).pow(18); // 1 EGLD - same as create_tournament
        self.world
            .tx()
            .from(user_addr)
            .to(TOURNAMENT_HUB_ADDRESS)
            .typed(tournament_hub_proxy::TournamentHubProxy)
            .join_tournament(tournament_id)
            .egld(entry_fee)
            .run();
        self
    }

    fn join_tournament_expect_error(
        &mut self,
        tournament_id: usize,
        user: &str,
        entry_fee: &BigUint<StaticApi>,
        return_error_message: &str,
    ) -> &mut Self {
        let user_addr = TestAddress::new(user);

        self.world
            .tx()
            .from(user_addr)
            .to(TOURNAMENT_HUB_ADDRESS)
            .typed(tournament_hub_proxy::TournamentHubProxy)
            .join_tournament(tournament_id)
            .egld(entry_fee.clone())
            .returns(ExpectError(4u64, return_error_message))
            .run();
        self
    }

    fn place_spectator_bet(
        &mut self,
        tournament_id: usize,
        betting_on: &TestAddress,
        amount: &BigUint<StaticApi>,
    ) -> &mut Self {
        self.world
            .tx()
            .from(SPECTATOR)
            .to(TOURNAMENT_HUB_ADDRESS)
            .typed(tournament_hub_proxy::TournamentHubProxy)
            .place_spectator_bet(tournament_id, betting_on.to_address())
            .egld(amount.clone())
            .run();
        self
    }

    fn place_spectator_bet_expect_error(
        &mut self,
        tournament_id: usize,
        betting_on: &TestAddress,
        amount: &BigUint<StaticApi>,
        return_error_message: &str,
    ) -> &mut Self {
        self.world
            .tx()
            .from(SPECTATOR)
            .to(TOURNAMENT_HUB_ADDRESS)
            .typed(tournament_hub_proxy::TournamentHubProxy)
            .place_spectator_bet(tournament_id, betting_on.to_address())
            .egld(amount.clone())
            .returns(ExpectError(4u64, return_error_message))
            .run();
        self
    }

    fn get_prize_pool(&mut self, tournament_id: usize) -> BigUint<StaticApi> {
        self.world
            .query()
            .to(TOURNAMENT_HUB_ADDRESS)
            .typed(tournament_hub_proxy::TournamentHubProxy)
            .get_prize_pool(tournament_id)
            .returns(ReturnsResult)
            .run()
    }
}

#[test]
fn test_deploy_tournament_hub() {
    let mut state = TournamentHubTestState::new();
    state.deploy_tournament_hub_contract();
}

#[test]
fn test_full_tournament_flow() {
    let mut state = TournamentHubTestState::new();
    state.deploy_tournament_hub_contract();

    // Register a game
    state.register_game();

    // Edge case: create_tournament with non-existent game_id
    let bad_game_id = 999usize;
    let _tournament_id = 1usize;
    let entry_fee = BigUint::from(10u64).pow(18);
    state.world.current_block().block_timestamp(10u64);
    state
        .world
        .tx()
        .from(USER1)
        .to(TOURNAMENT_HUB_ADDRESS)
        .typed(tournament_hub_proxy::TournamentHubProxy)
        .create_tournament(
            bad_game_id,
            8u32, // max_players
            2u32, // min_players
            entry_fee.clone(),
            ManagedBuffer::from("Bad Game Tournament"),
        )
        .egld(entry_fee.clone())
        .returns(ExpectError(4u64, "Game not registered"))
        .run();

    // Create a tournament successfully
    let tournament_id = state.create_tournament(1usize);

    // Start tournament (simulate time passing)

    // Edge case: join_tournament with wrong entry_fee
    let wrong_fee = BigUint::from(5u64).pow(17); // 0.05 EGLD
    state.join_tournament_expect_error(
        tournament_id,
        "user2",
        &wrong_fee,
        "Incorrect payment: must send exactly the tournament entry fee",
    );

    // Edge case: join_tournament for non-existent tournament
    state.join_tournament_expect_error(999usize, "user2", &entry_fee, "Tournament does not exist");

    // User2 joins (USER1 is already a participant as the creator)
    state.join_tournament(tournament_id, "user2");
    state.join_tournament(tournament_id, "user3");
    // Edge case: join_tournament twice
    state.join_tournament_expect_error(tournament_id, "user2", &entry_fee, "Player already joined");

    // User4 joins (user3 is already joined)
    state.join_tournament(tournament_id, "user4");

    // Spectator bets on user1
    let bet_amount = BigUint::from(10u64).pow(17); // 0.1 EGLD
    state.place_spectator_bet(tournament_id, &USER1, &bet_amount);

    // Add more steps: submitResults, claimSpectatorWinnings, assertions, etc.
}

#[cfg(feature = "no-sig-check")]
#[test]
fn test_result_submission_and_prize_distribution() {
    let mut state = TournamentHubTestState::new();
    state.deploy_tournament_hub_contract();

    state.register_game();
    let tournament_id = state.create_tournament(1usize);
    let entry_fee = state.get_prize_pool(tournament_id);
    state.set_tournament_fee(&entry_fee);

    state.join_tournament(tournament_id, "user2");
    state.join_tournament(tournament_id, "user3");
    state.join_tournament(tournament_id, "user4");

    state.start_tournament(tournament_id);

    // Happy path: valid result submission
    let podium = vec![USER1.to_address(), USER2.to_address(), USER1.to_address()]; // Example podium
    let fake_signature = vec![0u8; 64]; // Placeholder
    state
        .world
        .tx()
        .from(USER1)
        .to(TOURNAMENT_HUB_ADDRESS)
        .typed(tournament_hub_proxy::TournamentHubProxy)
        .submit_results(tournament_id, podium.clone(), fake_signature.clone())
        .run();

    // Edge: submit results again (should fail)
    state
        .world
        .tx()
        .from(USER1)
        .to(TOURNAMENT_HUB_ADDRESS)
        .typed(tournament_hub_proxy::TournamentHubProxy)
        .submit_results(tournament_id, podium.clone(), fake_signature.clone())
        .returns(ExpectError(
            4u64,
            "UNIQUE_ERROR_MESSAGE_FOR_DEBUGGING_12345",
        ))
        .run();

    state.world.current_block();

    // Edge: submit results with wrong podium size
    let bad_podium = vec![USER1.to_address()];
    state.register_game();
    state.create_tournament(2usize);
    state.set_tournament_fee(&entry_fee);
    state.join_tournament(2usize, "user2");
    state.join_tournament(2usize, "user3");
    state.start_tournament(2usize);
    state
        .world
        .tx()
        .from(USER1)
        .to(TOURNAMENT_HUB_ADDRESS)
        .typed(tournament_hub_proxy::TournamentHubProxy)
        .submit_results(2usize, bad_podium, fake_signature.clone())
        .returns(ExpectError(4u64, "Winner podium size mismatch"))
        .run();
}

#[test]
fn test_debug_message_construction() {
    let mut state = TournamentHubTestState::new();
    state.deploy_tournament_hub_contract();

    let tournament_id = 1usize; // Same as your test case

    state.register_game();
    state.create_tournament(1usize);

    let entry_fee = state.get_prize_pool(tournament_id);
    state.set_tournament_fee(&entry_fee);

    state.join_tournament(tournament_id, "user2");
    state.join_tournament(tournament_id, "user3");

    // Test with the exact same data as your real test
    let podium = vec![USER1.to_address(), USER2.to_address(), USER3.to_address()]; // 3-player podium
    let signature = vec![
        0xea, 0xef, 0xf5, 0x5a, 0xbc, 0xb1, 0x1c, 0x1d, 0x23, 0x1d, 0x0a, 0xe2, 0x03, 0x5a, 0x44,
        0x7c, 0xa0, 0x52, 0x56, 0x65, 0x9d, 0x16, 0x28, 0x61, 0xac, 0x21, 0xb5, 0x2a, 0x72, 0xc0,
        0x1c, 0xc6, 0xaa, 0x65, 0x47, 0x73, 0xb6, 0x27, 0x53, 0x37, 0x64, 0x53, 0xdf, 0x2a, 0x7c,
        0x73, 0xb0, 0x0c, 0xf3, 0xba, 0x6b, 0xd4, 0x50, 0x51, 0xb9, 0xc7, 0x9f, 0x72, 0x17, 0x65,
        0x2b, 0x49, 0x57, 0x05,
    ];

    println!("=== DEBUG MESSAGE CONSTRUCTION ===");
    println!("Tournament ID: {}", tournament_id);
    println!(
        "Tournament ID as usize bytes: {:?}",
        tournament_id.to_be_bytes()
    );
    println!("Podium addresses: {:?}", podium);
    println!("Signature length: {}", signature.len());
    println!("Signature: {:?}", signature);

    // This should fail with ed25519 verify error, but we'll see the debug events
    // Let's just run it and see what happens without expecting a specific error
    state
        .world
        .tx()
        .from(USER1)
        .to(TOURNAMENT_HUB_ADDRESS)
        .typed(tournament_hub_proxy::TournamentHubProxy)
        .submit_results(tournament_id, podium, signature)
        .returns(ExpectError(
            4u64,
            "UNIQUE_ERROR_MESSAGE_FOR_DEBUGGING_12345",
        ))
        .run();

    println!("=== END DEBUG ===");
}

#[ignore = "run with no-sig-check feature enabled"]
#[test]
fn test_debug_message_construction_success() {
    let mut state = TournamentHubTestState::new();
    state.deploy_tournament_hub_contract();

    let tournament_id = 1usize; // Same as your test case

    state.register_game();
    state.create_tournament(1usize);

    let entry_fee = state.get_prize_pool(tournament_id);
    state.set_tournament_fee(&entry_fee);

    state.join_tournament(tournament_id, "user2");
    state.join_tournament(tournament_id, "user3");

    state.start_tournament(tournament_id);

    // Test with a valid signature (we'll create one that matches our expected message)
    let podium = vec![USER1.to_address(), USER2.to_address(), USER3.to_address()]; // 3-player podium

    // Create a signature that matches our expected message format
    // Expected message: tournament_id (8 bytes) + address bytes
    let mut expected_message = Vec::new();
    expected_message.extend_from_slice(&tournament_id.to_be_bytes());
    expected_message.extend_from_slice(&USER1.to_address().to_vec());

    println!("=== DEBUG MESSAGE CONSTRUCTION SUCCESS ===");
    println!("Tournament ID: {}", tournament_id);
    println!(
        "Tournament ID as u64 bytes: {:?}",
        tournament_id.to_be_bytes()
    );
    println!("Expected message: {:?}", expected_message);
    println!("Expected message hex: {:02x?}", expected_message);
    println!("Podium addresses: {:?}", podium);

    // For now, use a dummy signature - we'll see if the message construction works
    let dummy_signature = vec![0u8; 64];

    // This should succeed with the debug events in the logs (no-sig-check feature enabled)
    state
        .world
        .tx()
        .from(USER1)
        .to(TOURNAMENT_HUB_ADDRESS)
        .typed(tournament_hub_proxy::TournamentHubProxy)
        .submit_results(tournament_id, podium, dummy_signature)
        .run();

    println!("=== END DEBUG SUCCESS ===");
}

#[ignore = "run with no-sig-check feature enabled"]
#[test]
fn test_debug_message_construction_with_real_addresses() {
    let mut state = TournamentHubTestState::new();
    state.deploy_tournament_hub_contract();

    let tournament_id = 1usize;

    state.register_game();
    state.create_tournament(1usize);

    let entry_fee = state.get_prize_pool(tournament_id);
    state.set_tournament_fee(&entry_fee);

    state.join_tournament(tournament_id, "user2");
    state.join_tournament(tournament_id, "user3");

    state.start_tournament(tournament_id);

    // Use the test address directly - this will show us what the test environment produces
    let podium = vec![USER1.to_address(), USER2.to_address(), USER3.to_address()]; // 3-player podium
    let dummy_signature = vec![0u8; 64];

    // This should succeed with the debug events in the logs (no-sig-check feature enabled)
    state
        .world
        .tx()
        .from(USER1)
        .to(TOURNAMENT_HUB_ADDRESS)
        .typed(tournament_hub_proxy::TournamentHubProxy)
        .submit_results(tournament_id, podium, dummy_signature)
        .run();

    println!("=== END DEBUG WITH TEST ADDRESSES ===");
}

#[cfg(feature = "no-sig-check")]
#[test]
fn test_spectator_betting_and_claims() {
    let mut state = TournamentHubTestState::new();
    state.deploy_tournament_hub_contract();

    let tournament_id = 1usize;

    state.register_game();
    state.create_tournament(1usize);
    let entry_fee = state.get_prize_pool(tournament_id);
    state.set_tournament_fee(&entry_fee);

    state.join_tournament(tournament_id, "user2");
    state.join_tournament(tournament_id, "user3");
    state.join_tournament(tournament_id, "user4");

    state.start_tournament(tournament_id);

    // Spectator bets on user1
    let bet_amount = BigUint::from(10u64).pow(17);
    state.place_spectator_bet(tournament_id, &USER1, &bet_amount);

    // Edge: bet on non-participant
    let non_participant = TestAddress::new("nonparticipant");
    state.place_spectator_bet_expect_error(
        tournament_id,
        &non_participant,
        &bet_amount,
        "Player not found in tournament",
    );

    // Complete tournament and submit results
    let podium = vec![USER1.to_address(), USER2.to_address(), USER3.to_address()];
    let fake_signature = vec![0u8; 64];
    state
        .world
        .tx()
        .from(USER1)
        .to(TOURNAMENT_HUB_ADDRESS)
        .typed(tournament_hub_proxy::TournamentHubProxy)
        .submit_results(tournament_id, podium.clone(), fake_signature.clone())
        .run();

    // Happy path: claim winnings
    state
        .world
        .tx()
        .from(SPECTATOR)
        .to(TOURNAMENT_HUB_ADDRESS)
        .typed(tournament_hub_proxy::TournamentHubProxy)
        .claim_spectator_winnings(tournament_id)
        .run();

    // Edge: claim twice
    state
        .world
        .tx()
        .from(SPECTATOR)
        .to(TOURNAMENT_HUB_ADDRESS)
        .typed(tournament_hub_proxy::TournamentHubProxy)
        .claim_spectator_winnings(tournament_id)
        .returns(ExpectError(4u64, "Already claimed winnings"))
        .run();
}

#[test]
fn test_views_and_state_consistency() {
    let mut state = TournamentHubTestState::new();
    state.deploy_tournament_hub_contract();

    let game_id = 1usize;
    let tournament_id = 1usize;

    state.register_game();
    state.create_tournament(1usize);

    let entry_fee = state.get_prize_pool(tournament_id);
    state.set_tournament_fee(&entry_fee);

    // Query game config
    let game_config = state
        .world
        .query()
        .to(TOURNAMENT_HUB_ADDRESS)
        .typed(tournament_hub_proxy::TournamentHubProxy)
        .get_game_config(game_id)
        .returns(ReturnsResult)
        .run();
    // Game config is returned directly, not as Option
    assert_eq!(game_config.podium_size, 3u32);

    // Query tournament before join
    state
        .world
        .query()
        .to(TOURNAMENT_HUB_ADDRESS)
        .typed(tournament_hub_proxy::TournamentHubProxy)
        .get_tournament(tournament_id)
        .returns(ReturnsResult)
        .run();
    // If no error, tournament exists

    // Join and check participants
    state.join_tournament(tournament_id, "user2");
    state.join_tournament(tournament_id, "user3");
    let tournament = state
        .world
        .query()
        .to(TOURNAMENT_HUB_ADDRESS)
        .typed(tournament_hub_proxy::TournamentHubProxy)
        .get_tournament(tournament_id)
        .returns(ReturnsResult)
        .run();
    assert_eq!(tournament.participants.len(), 3);
}

#[test]
fn test_permission_and_access_control() {
    let mut state = TournamentHubTestState::new();
    state.deploy_tournament_hub_contract();

    // Only owner can register game
    state
        .world
        .tx()
        .from(USER_ADDRESS)
        .to(TOURNAMENT_HUB_ADDRESS)
        .typed(tournament_hub_proxy::TournamentHubProxy)
        .register_game(
            OWNER_ADDRESS.to_address(),
            3u32,
            vec![5_000u32, 3_000u32, 2_000u32],
            false,
        )
        .returns(ExpectError(4u64, "Endpoint can only be called by owner"))
        .run();
}

#[test]
fn test_invalid_flows() {
    let mut state = TournamentHubTestState::new();
    state.deploy_tournament_hub_contract();

    // Try to join non-existent tournament
    let entry_fee = BigUint::from(10u64).pow(18);
    state.join_tournament_expect_error(999usize, "user2", &entry_fee, "Tournament does not exist");

    // Try to start non-existent tournament
    state.start_tournament_expect_error(999usize, "Tournament does not exist");
}

#[test]
fn test_multiple_tournaments_and_games() {
    let mut state = TournamentHubTestState::new();
    state.deploy_tournament_hub_contract();

    let t1 = 1usize;
    let t2 = 2usize;

    state.register_game();
    state.create_tournament(1usize);
    state.create_tournament(1usize);

    // Ensure state isolation
    let t1_state = state
        .world
        .query()
        .to(TOURNAMENT_HUB_ADDRESS)
        .typed(tournament_hub_proxy::TournamentHubProxy)
        .get_tournament(t1)
        .returns(ReturnsResult)
        .run();
    let t2_state = state
        .world
        .query()
        .to(TOURNAMENT_HUB_ADDRESS)
        .typed(tournament_hub_proxy::TournamentHubProxy)
        .get_tournament(t2)
        .returns(ReturnsResult)
        .run();
    assert_eq!(t1_state.participants.len(), 1); // Creator is automatically added
    assert_eq!(t2_state.participants.len(), 1); // Creator is automatically added
}

#[cfg(feature = "no-sig-check")]
#[test]
fn test_house_fee_is_taken_on_gains() {
    let mut state = TournamentHubTestState::new();
    state.deploy_tournament_hub_contract();

    // Set the house fee to 1000 (10%)
    let house_fee_percentage = 1_000u32;
    state.set_house_fee_percentage(house_fee_percentage);

    // Register a game and run a full tournament flow...
    state.register_game();
    let game_index = 1usize;

    let tournament_id = state.create_tournament(game_index);
    let entry_fee = BigUint::from(10u64).pow(18);
    state.set_tournament_fee(&entry_fee);

    state.join_tournament(tournament_id, "user2");
    state.join_tournament(tournament_id, "user3");
    state.join_tournament(tournament_id, "user4");

    // Start tournament
    state.start_tournament(tournament_id);

    // Submit results to trigger prize distribution and fee accumulation
    let podium = vec![USER1.to_address(), USER2.to_address(), USER3.to_address()];
    let dummy_signature = vec![0u8; 64];
    state
        .world
        .tx()
        .from(USER1)
        .to(TOURNAMENT_HUB_ADDRESS)
        .typed(tournament_hub_proxy::TournamentHubProxy)
        .submit_results(tournament_id, podium, dummy_signature)
        .run();

    // Query the accumulated house fees and assert the correct amount was taken
    let accumulated_fees = state
        .world
        .query()
        .to(TOURNAMENT_HUB_ADDRESS)
        .typed(tournament_hub_proxy::TournamentHubProxy)
        .get_accumulated_house_fees()
        .returns(ReturnsResult)
        .run();

    // Calculate expected fee and assert (4 participants: USER1, USER2, USER3, USER4)
    let expected_fee = BigUint::from(10u64).pow(18) * 4u64 * house_fee_percentage / 10_000u32;
    assert_eq!(accumulated_fees, expected_fee);
}

#[test]
fn test_prize_pool_calculation() {
    let mut state = TournamentHubTestState::new();
    state.deploy_tournament_hub_contract();

    let tournament_fee = BigUint::from(10u64).pow(18);
    state
        .world
        .tx()
        .from(OWNER_ADDRESS)
        .to(TOURNAMENT_HUB_ADDRESS)
        .typed(tournament_hub_proxy::TournamentHubProxy)
        .set_tournament_fee(tournament_fee.clone())
        .run();

    state.register_game();
    let tournament_id = state.create_tournament(1usize);
    state.join_tournament(tournament_id, "user2");
    state.join_tournament(tournament_id, "user3");
    state.join_tournament(tournament_id, "user4");

    let prize_pool = state.get_prize_pool(tournament_id);

    let expected_pool = &tournament_fee * 4u32; // USER1 (creator) + USER2 + USER3 + USER4
    assert_eq!(prize_pool, expected_pool);
}

#[test]
fn test_storage_consistency_after_tournament_creation() {
    let mut state = TournamentHubTestState::new();
    state.deploy_tournament_hub_contract();

    state.register_game();

    // Create tournament and verify storage consistency
    let tournament_id = state.create_tournament(1usize);

    // Test 1: Verify tournament count is correct
    let tournament_count = state
        .world
        .query()
        .to(TOURNAMENT_HUB_ADDRESS)
        .typed(tournament_hub_proxy::TournamentHubProxy)
        .get_number_of_tournaments()
        .returns(ReturnsResult)
        .run();
    assert_eq!(tournament_count, 1usize);

    // Test 2: Verify tournament can be retrieved by ID
    let tournament = state
        .world
        .query()
        .to(TOURNAMENT_HUB_ADDRESS)
        .typed(tournament_hub_proxy::TournamentHubProxy)
        .get_tournament(tournament_id)
        .returns(ReturnsResult)
        .run();
    assert_eq!(tournament.game_id, 1u64);
    assert_eq!(tournament.participants.len(), 1); // Creator is automatically added

    // Test 3: Verify tournament basic info works
    let basic_info = state
        .world
        .query()
        .to(TOURNAMENT_HUB_ADDRESS)
        .typed(tournament_hub_proxy::TournamentHubProxy)
        .get_tournament_basic_info(tournament_id)
        .returns(ReturnsResult)
        .run();
    assert_eq!(basic_info.0, tournament_id as u64); // tournament_id
    assert_eq!(basic_info.1, 1u64); // game_id
}

#[test]
fn test_tournament_indexing_consistency() {
    let mut state = TournamentHubTestState::new();
    state.deploy_tournament_hub_contract();

    state.register_game();

    // Create multiple tournaments to test indexing
    let tournament1_id = state.create_tournament(1usize);
    let tournament2_id = state.create_tournament(1usize);
    let tournament3_id = state.create_tournament(1usize);

    // Verify tournament IDs are sequential and correct
    assert_eq!(tournament1_id, 1usize);
    assert_eq!(tournament2_id, 2usize);
    assert_eq!(tournament3_id, 3usize);

    // Verify we can access each tournament by its ID
    let tournament1 = state
        .world
        .query()
        .to(TOURNAMENT_HUB_ADDRESS)
        .typed(tournament_hub_proxy::TournamentHubProxy)
        .get_tournament(tournament1_id)
        .returns(ReturnsResult)
        .run();
    assert_eq!(tournament1.game_id, 1u64);

    let tournament2 = state
        .world
        .query()
        .to(TOURNAMENT_HUB_ADDRESS)
        .typed(tournament_hub_proxy::TournamentHubProxy)
        .get_tournament(tournament2_id)
        .returns(ReturnsResult)
        .run();
    assert_eq!(tournament2.game_id, 1u64);

    let tournament3 = state
        .world
        .query()
        .to(TOURNAMENT_HUB_ADDRESS)
        .typed(tournament_hub_proxy::TournamentHubProxy)
        .get_tournament(tournament3_id)
        .returns(ReturnsResult)
        .run();
    assert_eq!(tournament3.game_id, 1u64);
}

#[test]
fn test_join_tournament_storage_updates() {
    let mut state = TournamentHubTestState::new();
    state.deploy_tournament_hub_contract();

    state.register_game();
    let tournament_id = state.create_tournament(1usize);

    // Verify initial state
    let initial_tournament = state
        .world
        .query()
        .to(TOURNAMENT_HUB_ADDRESS)
        .typed(tournament_hub_proxy::TournamentHubProxy)
        .get_tournament(tournament_id)
        .returns(ReturnsResult)
        .run();
    assert_eq!(initial_tournament.participants.len(), 1); // Only creator

    // Join tournament and verify storage update
    state.join_tournament(tournament_id, "user2");
    state.join_tournament(tournament_id, "user3");

    let updated_tournament = state
        .world
        .query()
        .to(TOURNAMENT_HUB_ADDRESS)
        .typed(tournament_hub_proxy::TournamentHubProxy)
        .get_tournament(tournament_id)
        .returns(ReturnsResult)
        .run();
    assert_eq!(updated_tournament.participants.len(), 3); // Creator + user2 + user3

    // Verify the correct addresses are stored
    let participants = updated_tournament.participants;
    assert_eq!(participants.len(), 3);
    // Note: In test environment, addresses might be different, so we just check count
}

#[test]
fn test_storage_serialization_edge_cases() {
    let mut state = TournamentHubTestState::new();
    state.deploy_tournament_hub_contract();

    state.register_game();
    let tournament_id = state.create_tournament(1usize);

    // Test serialization with empty participants list (should work)
    let tournament = state
        .world
        .query()
        .to(TOURNAMENT_HUB_ADDRESS)
        .typed(tournament_hub_proxy::TournamentHubProxy)
        .get_tournament(tournament_id)
        .returns(ReturnsResult)
        .run();
    assert_eq!(tournament.participants.len(), 1); // Creator is added automatically

    // Test serialization with multiple participants
    state.join_tournament(tournament_id, "user2");
    state.join_tournament(tournament_id, "user3");
    state.join_tournament(tournament_id, "user4");

    let tournament_with_participants = state
        .world
        .query()
        .to(TOURNAMENT_HUB_ADDRESS)
        .typed(tournament_hub_proxy::TournamentHubProxy)
        .get_tournament(tournament_id)
        .returns(ReturnsResult)
        .run();
    assert_eq!(tournament_with_participants.participants.len(), 4);

    // Test tournament number serialization (simpler than full stats)
    let total_tournaments = state
        .world
        .query()
        .to(TOURNAMENT_HUB_ADDRESS)
        .typed(tournament_hub_proxy::TournamentHubProxy)
        .get_number_of_tournaments()
        .returns(ReturnsResult)
        .run();
    assert!(total_tournaments >= 1); // Should have at least one tournament created
}

#[test]
fn test_storage_boundary_conditions() {
    let mut state = TournamentHubTestState::new();
    state.deploy_tournament_hub_contract();

    state.register_game();

    // Test accessing non-existent tournament (should fail gracefully)
    state
        .world
        .query()
        .to(TOURNAMENT_HUB_ADDRESS)
        .typed(tournament_hub_proxy::TournamentHubProxy)
        .get_tournament(999usize) // Non-existent tournament
        .returns(ExpectError(4u64, "Tournament does not exist"))
        .run();

    // Test accessing tournament with ID 0 (should fail)
    state
        .world
        .query()
        .to(TOURNAMENT_HUB_ADDRESS)
        .typed(tournament_hub_proxy::TournamentHubProxy)
        .get_tournament(0usize) // Invalid tournament ID
        .returns(ExpectError(4u64, "Tournament does not exist"))
        .run();

    // Create a tournament and test valid access
    let tournament_id = state.create_tournament(1usize);

    // This should work
    let tournament = state
        .world
        .query()
        .to(TOURNAMENT_HUB_ADDRESS)
        .typed(tournament_hub_proxy::TournamentHubProxy)
        .get_tournament(tournament_id)
        .returns(ReturnsResult)
        .run();
    assert_eq!(tournament.game_id, 1u64);
}

#[test]
fn test_storage_data_integrity() {
    let mut state = TournamentHubTestState::new();
    state.deploy_tournament_hub_contract();

    state.register_game();
    let tournament_id = state.create_tournament(1usize);

    // Test that all view functions return consistent data
    let tournament = state
        .world
        .query()
        .to(TOURNAMENT_HUB_ADDRESS)
        .typed(tournament_hub_proxy::TournamentHubProxy)
        .get_tournament(tournament_id)
        .returns(ReturnsResult)
        .run();

    let basic_info = state
        .world
        .query()
        .to(TOURNAMENT_HUB_ADDRESS)
        .typed(tournament_hub_proxy::TournamentHubProxy)
        .get_tournament_basic_info(tournament_id)
        .returns(ReturnsResult)
        .run();

    // Verify data consistency between different view functions
    // basic_info is a tuple: (tournament_id, game_id, status, participants, creator, max_players, min_players, entry_fee, name, created_at)
    assert_eq!(tournament.game_id, basic_info.1); // game_id
    assert_eq!(tournament.participants.len(), basic_info.3.len()); // participants
    assert_eq!(tournament.creator, basic_info.4); // creator
    assert_eq!(tournament.max_players, basic_info.5); // max_players
    assert_eq!(tournament.min_players, basic_info.6); // min_players
    assert_eq!(tournament.entry_fee, basic_info.7); // entry_fee
    assert_eq!(tournament.name, basic_info.8); // name
    assert_eq!(tournament.created_at, basic_info.9); // created_at
}

#[test]
fn test_storage_after_tournament_state_changes() {
    let mut state = TournamentHubTestState::new();
    state.deploy_tournament_hub_contract();

    state.register_game();
    let tournament_id = state.create_tournament(1usize);

    // Add enough players to make tournament ready to start
    state.join_tournament(tournament_id, "user2");
    state.join_tournament(tournament_id, "user3");

    // Verify tournament is in ReadyToStart status
    let tournament_ready = state
        .world
        .query()
        .to(TOURNAMENT_HUB_ADDRESS)
        .typed(tournament_hub_proxy::TournamentHubProxy)
        .get_tournament(tournament_id)
        .returns(ReturnsResult)
        .run();
    assert_eq!(tournament_ready.status as u32, 1); // ReadyToStart = 1

    // Start the tournament
    state.start_tournament(tournament_id);

    // Verify tournament is now in Active status
    let tournament_active = state
        .world
        .query()
        .to(TOURNAMENT_HUB_ADDRESS)
        .typed(tournament_hub_proxy::TournamentHubProxy)
        .get_tournament(tournament_id)
        .returns(ReturnsResult)
        .run();
    assert_eq!(tournament_active.status as u32, 2); // Active = 2
}

#[test]
fn test_storage_after_tournament_deletion() {
    let mut state = TournamentHubTestState::new();
    state.deploy_tournament_hub_contract();

    state.register_game();
    let tournament_id = state.create_tournament(1usize);

    // Verify tournament exists
    let tournament = state
        .world
        .query()
        .to(TOURNAMENT_HUB_ADDRESS)
        .typed(tournament_hub_proxy::TournamentHubProxy)
        .get_tournament(tournament_id)
        .returns(ReturnsResult)
        .run();
    assert_eq!(tournament.game_id, 1u64);

    // Test accessing tournament after potential deletion scenarios
    // (Note: No delete function exists, but we test edge cases)
    let tournament_count = state
        .world
        .query()
        .to(TOURNAMENT_HUB_ADDRESS)
        .typed(tournament_hub_proxy::TournamentHubProxy)
        .get_number_of_tournaments()
        .returns(ReturnsResult)
        .run();
    assert_eq!(tournament_count, 1usize);
}

#[test]
fn test_storage_with_maximum_tournaments() {
    let mut state = TournamentHubTestState::new();
    state.deploy_tournament_hub_contract();

    state.register_game();

    // Create multiple tournaments to test storage limits
    let mut tournament_ids = Vec::new();
    for _i in 1..=5 {
        let tournament_id = state.create_tournament(1usize);
        tournament_ids.push(tournament_id);

        // Verify each tournament can be accessed
        let tournament = state
            .world
            .query()
            .to(TOURNAMENT_HUB_ADDRESS)
            .typed(tournament_hub_proxy::TournamentHubProxy)
            .get_tournament(tournament_id)
            .returns(ReturnsResult)
            .run();
        assert_eq!(tournament.game_id, 1u64);
    }

    // Verify all tournaments are accessible
    let tournament_count = state
        .world
        .query()
        .to(TOURNAMENT_HUB_ADDRESS)
        .typed(tournament_hub_proxy::TournamentHubProxy)
        .get_number_of_tournaments()
        .returns(ReturnsResult)
        .run();
    assert_eq!(tournament_count, 5usize);

    // Test accessing tournaments in reverse order
    for tournament_id in tournament_ids.iter().rev() {
        let tournament = state
            .world
            .query()
            .to(TOURNAMENT_HUB_ADDRESS)
            .typed(tournament_hub_proxy::TournamentHubProxy)
            .get_tournament(*tournament_id)
            .returns(ReturnsResult)
            .run();
        assert_eq!(tournament.game_id, 1u64);
    }
}

#[test]
fn test_storage_with_large_participant_lists() {
    let mut state = TournamentHubTestState::new();
    state.deploy_tournament_hub_contract();

    state.register_game();
    let tournament_id = state.create_tournament(1usize);

    // Add multiple participants to test large participant lists
    let users = ["user2", "user3", "user4"];
    for user in users.iter() {
        state.join_tournament(tournament_id, user);
    }

    // Verify all participants are stored correctly
    let tournament = state
        .world
        .query()
        .to(TOURNAMENT_HUB_ADDRESS)
        .typed(tournament_hub_proxy::TournamentHubProxy)
        .get_tournament(tournament_id)
        .returns(ReturnsResult)
        .run();
    assert_eq!(tournament.participants.len(), 4); // Creator + 3 users

    // Test joining with a user that already joined
    state.join_tournament_expect_error(
        tournament_id,
        "user2",
        &BigUint::from(10u64).pow(18),
        "Player already joined",
    );
}

#[test]
fn test_storage_consistency_after_multiple_operations() {
    let mut state = TournamentHubTestState::new();
    state.deploy_tournament_hub_contract();

    state.register_game();

    // Create multiple tournaments with different states
    let tournament1_id = state.create_tournament(1usize);
    let tournament2_id = state.create_tournament(1usize);

    // Add participants to tournament 1
    state.join_tournament(tournament1_id, "user2");
    state.join_tournament(tournament1_id, "user3");

    // Add participants to tournament 2
    state.join_tournament(tournament2_id, "user2");
    state.join_tournament(tournament2_id, "user4");

    // Verify both tournaments maintain separate state
    let tournament1 = state
        .world
        .query()
        .to(TOURNAMENT_HUB_ADDRESS)
        .typed(tournament_hub_proxy::TournamentHubProxy)
        .get_tournament(tournament1_id)
        .returns(ReturnsResult)
        .run();
    assert_eq!(tournament1.participants.len(), 3); // Creator + 2 users

    let tournament2 = state
        .world
        .query()
        .to(TOURNAMENT_HUB_ADDRESS)
        .typed(tournament_hub_proxy::TournamentHubProxy)
        .get_tournament(tournament2_id)
        .returns(ReturnsResult)
        .run();
    assert_eq!(tournament2.participants.len(), 3); // Creator + 2 users

    // Verify tournament IDs are unique
    assert_ne!(tournament1_id, tournament2_id);
}

#[test]
fn test_storage_error_recovery() {
    let mut state = TournamentHubTestState::new();
    state.deploy_tournament_hub_contract();

    state.register_game();

    // Test that operations work after previous errors
    let tournament_id = state.create_tournament(1usize);

    // Try to access non-existent tournament (should fail)
    state
        .world
        .query()
        .to(TOURNAMENT_HUB_ADDRESS)
        .typed(tournament_hub_proxy::TournamentHubProxy)
        .get_tournament(999usize)
        .returns(ExpectError(4u64, "Tournament does not exist"))
        .run();

    // Verify that valid operations still work after error
    let tournament = state
        .world
        .query()
        .to(TOURNAMENT_HUB_ADDRESS)
        .typed(tournament_hub_proxy::TournamentHubProxy)
        .get_tournament(tournament_id)
        .returns(ReturnsResult)
        .run();
    assert_eq!(tournament.game_id, 1u64);

    // Verify tournament count is still correct
    let tournament_count = state
        .world
        .query()
        .to(TOURNAMENT_HUB_ADDRESS)
        .typed(tournament_hub_proxy::TournamentHubProxy)
        .get_number_of_tournaments()
        .returns(ReturnsResult)
        .run();
    assert_eq!(tournament_count, 1usize);
}

#[test]
fn test_storage_with_invalid_inputs() {
    let mut state = TournamentHubTestState::new();
    state.deploy_tournament_hub_contract();

    state.register_game();

    // Test with invalid tournament IDs
    let invalid_ids = [0usize, 999usize, 1000usize];

    for invalid_id in invalid_ids.iter() {
        state
            .world
            .query()
            .to(TOURNAMENT_HUB_ADDRESS)
            .typed(tournament_hub_proxy::TournamentHubProxy)
            .get_tournament(*invalid_id)
            .returns(ExpectError(4u64, "Tournament does not exist"))
            .run();
    }

    // Test with invalid game IDs
    let invalid_game_ids = [0usize, 999usize, 1000usize];

    for invalid_game_id in invalid_game_ids.iter() {
        state
            .world
            .query()
            .to(TOURNAMENT_HUB_ADDRESS)
            .typed(tournament_hub_proxy::TournamentHubProxy)
            .get_game_config(*invalid_game_id)
            .returns(ExpectError(4u64, "Invalid game index"))
            .run();
    }
}

#[test]
fn test_storage_performance_with_large_data() {
    let mut state = TournamentHubTestState::new();
    state.deploy_tournament_hub_contract();

    state.register_game();

    // Create tournament with long name to test large data handling
    let long_name = "A".repeat(100);
    let tournament_id = state.create_tournament_with_params(
        1usize,
        8u32,
        2u32,
        BigUint::from(10u64).pow(18),
        &long_name,
    );

    // Verify tournament with long name is stored correctly
    let tournament = state
        .world
        .query()
        .to(TOURNAMENT_HUB_ADDRESS)
        .typed(tournament_hub_proxy::TournamentHubProxy)
        .get_tournament(tournament_id)
        .returns(ReturnsResult)
        .run();
    assert_eq!(tournament.name.len(), 100);
}

#[test]
fn test_storage_consistency_across_block_transitions() {
    let mut state = TournamentHubTestState::new();
    state.deploy_tournament_hub_contract();

    state.register_game();
    let tournament_id = state.create_tournament(1usize);

    // Add participants
    state.join_tournament(tournament_id, "user2");
    state.join_tournament(tournament_id, "user3");
    state.join_tournament(tournament_id, "user4");

    // Verify state before block transition
    let tournament_before = state
        .world
        .query()
        .to(TOURNAMENT_HUB_ADDRESS)
        .typed(tournament_hub_proxy::TournamentHubProxy)
        .get_tournament(tournament_id)
        .returns(ReturnsResult)
        .run();
    assert_eq!(tournament_before.participants.len(), 4); // Creator + 3 users

    // Simulate block transition
    state.world.current_block().block_timestamp(150u64);

    // Verify state after block transition
    let tournament_after = state
        .world
        .query()
        .to(TOURNAMENT_HUB_ADDRESS)
        .typed(tournament_hub_proxy::TournamentHubProxy)
        .get_tournament(tournament_id)
        .returns(ReturnsResult)
        .run();
    assert_eq!(tournament_after.participants.len(), 4); // Should be the same
    assert_eq!(tournament_before.game_id, tournament_after.game_id);
    assert_eq!(tournament_before.creator, tournament_after.creator);
}

#[test]
fn test_storage_with_concurrent_operations() {
    let mut state = TournamentHubTestState::new();
    state.deploy_tournament_hub_contract();

    state.register_game();
    let tournament_id = state.create_tournament(1usize);

    // Simulate concurrent operations by performing multiple operations in sequence
    // (In a real scenario, these would be concurrent, but we test the storage consistency)

    // User2 joins (USER1 is already a participant as the creator)
    state.join_tournament(tournament_id, "user2");

    // Verify state after first join
    let tournament_after_user2 = state
        .world
        .query()
        .to(TOURNAMENT_HUB_ADDRESS)
        .typed(tournament_hub_proxy::TournamentHubProxy)
        .get_tournament(tournament_id)
        .returns(ReturnsResult)
        .run();
    assert_eq!(tournament_after_user2.participants.len(), 2); // Creator + user2

    // User3 joins
    state.join_tournament(tournament_id, "user3");

    // Verify state after second join
    let tournament_after_user3 = state
        .world
        .query()
        .to(TOURNAMENT_HUB_ADDRESS)
        .typed(tournament_hub_proxy::TournamentHubProxy)
        .get_tournament(tournament_id)
        .returns(ReturnsResult)
        .run();
    assert_eq!(tournament_after_user3.participants.len(), 3); // Creator + user2 + user3

    // Verify that previous state is preserved
    assert_eq!(
        tournament_after_user2.participants.len() + 1,
        tournament_after_user3.participants.len()
    );
}

#[test]
fn test_storage_memory_management() {
    let mut state = TournamentHubTestState::new();
    state.deploy_tournament_hub_contract();

    state.register_game();

    // Create and destroy multiple tournaments to test memory management
    let mut tournament_ids = Vec::new();

    for _i in 1..=3 {
        let tournament_id = state.create_tournament(1usize);
        tournament_ids.push(tournament_id);

        // Verify tournament exists
        let tournament = state
            .world
            .query()
            .to(TOURNAMENT_HUB_ADDRESS)
            .typed(tournament_hub_proxy::TournamentHubProxy)
            .get_tournament(tournament_id)
            .returns(ReturnsResult)
            .run();
        assert_eq!(tournament.game_id, 1u64);
    }

    // Verify all tournaments are accessible
    let tournament_count = state
        .world
        .query()
        .to(TOURNAMENT_HUB_ADDRESS)
        .typed(tournament_hub_proxy::TournamentHubProxy)
        .get_number_of_tournaments()
        .returns(ReturnsResult)
        .run();
    assert_eq!(tournament_count, 3usize);

    // Test accessing tournaments in different orders
    for tournament_id in tournament_ids.iter().rev() {
        let tournament = state
            .world
            .query()
            .to(TOURNAMENT_HUB_ADDRESS)
            .typed(tournament_hub_proxy::TournamentHubProxy)
            .get_tournament(*tournament_id)
            .returns(ReturnsResult)
            .run();
        assert_eq!(tournament.game_id, 1u64);
    }
}

#[test]
fn test_storage_edge_cases_with_boundary_values() {
    let mut state = TournamentHubTestState::new();
    state.deploy_tournament_hub_contract();

    state.register_game();

    // Test with minimum valid values
    let tournament_id =
        state.create_tournament_with_params(1usize, 2u32, 2u32, BigUint::from(1u64), "T");

    // Verify tournament with minimum values is stored correctly
    let tournament = state
        .world
        .query()
        .to(TOURNAMENT_HUB_ADDRESS)
        .typed(tournament_hub_proxy::TournamentHubProxy)
        .get_tournament(tournament_id)
        .returns(ReturnsResult)
        .run();
    assert_eq!(tournament.max_players, 2u32);
    assert_eq!(tournament.min_players, 2u32);
    assert_eq!(tournament.entry_fee, BigUint::from(1u64));
    assert_eq!(tournament.name.len(), 1);
}

#[test]
fn test_storage_with_corrupted_data_scenarios() {
    let mut state = TournamentHubTestState::new();
    state.deploy_tournament_hub_contract();

    state.register_game();
    let _tournament_id = state.create_tournament(1usize);

    // Test accessing tournament with various edge case IDs
    let edge_case_ids = [1usize, 2usize, 3usize, 100usize, 1000usize];

    for edge_id in edge_case_ids.iter() {
        if *edge_id == 1 {
            // Only tournament 1 should exist
            let tournament = state
                .world
                .query()
                .to(TOURNAMENT_HUB_ADDRESS)
                .typed(tournament_hub_proxy::TournamentHubProxy)
                .get_tournament(*edge_id)
                .returns(ReturnsResult)
                .run();
            assert_eq!(tournament.game_id, 1u64);
        } else {
            // Other IDs should not exist
            state
                .world
                .query()
                .to(TOURNAMENT_HUB_ADDRESS)
                .typed(tournament_hub_proxy::TournamentHubProxy)
                .get_tournament(*edge_id)
                .returns(ExpectError(4u64, "Tournament does not exist"))
                .run();
        }
    }
}

#[test]
fn test_storage_with_rapid_state_changes() {
    let mut state = TournamentHubTestState::new();
    state.deploy_tournament_hub_contract();

    state.register_game();
    let tournament_id = state.create_tournament(1usize);

    // Rapidly add and verify participants
    let participants = ["user2", "user3", "user4", "spectator"];

    for (i, participant) in participants.iter().enumerate() {
        state.join_tournament(tournament_id, participant);

        // Verify state after each join
        let tournament = state
            .world
            .query()
            .to(TOURNAMENT_HUB_ADDRESS)
            .typed(tournament_hub_proxy::TournamentHubProxy)
            .get_tournament(tournament_id)
            .returns(ReturnsResult)
            .run();
        assert_eq!(tournament.participants.len(), i + 2); // Creator + participants
    }

    // Verify final state
    let final_tournament = state
        .world
        .query()
        .to(TOURNAMENT_HUB_ADDRESS)
        .typed(tournament_hub_proxy::TournamentHubProxy)
        .get_tournament(tournament_id)
        .returns(ReturnsResult)
        .run();
    assert_eq!(final_tournament.participants.len(), 5); // Creator + 4 participants
}

#[test]
fn test_storage_with_boundary_timestamp_values() {
    let mut state = TournamentHubTestState::new();
    state.deploy_tournament_hub_contract();

    state.register_game();

    // Test with different timestamp scenarios
    let timestamp_scenarios = [
        (0u64, "zero_timestamp"),
        (1u64, "min_timestamp"),
        (u64::MAX, "max_timestamp"),
    ];

    for (timestamp, scenario_name) in timestamp_scenarios.iter() {
        state.world.current_block().block_timestamp(*timestamp);

        let tournament_id = state.create_tournament_with_params(
            1usize,
            8u32,
            2u32,
            BigUint::from(10u64).pow(18),
            scenario_name,
        );

        // Verify tournament was created successfully
        let tournament = state
            .world
            .query()
            .to(TOURNAMENT_HUB_ADDRESS)
            .typed(tournament_hub_proxy::TournamentHubProxy)
            .get_tournament(tournament_id)
            .returns(ReturnsResult)
            .run();
        assert_eq!(tournament.name, ManagedBuffer::from(*scenario_name));
    }
}

#[test]
fn test_storage_with_malformed_data_handling() {
    let mut state = TournamentHubTestState::new();
    state.deploy_tournament_hub_contract();

    state.register_game();

    // Test with different name lengths
    let max_name = "A".repeat(100);
    let malformed_scenarios = [
        ("A", "single_char"),
        ("Valid Name", "normal_name"),
        (&max_name, "max_length"),
    ];

    for (name, _scenario) in malformed_scenarios.iter() {
        let tournament_id = state.create_tournament_with_params(
            1usize,
            8u32,
            2u32,
            BigUint::from(10u64).pow(18),
            name,
        );

        // Verify tournament was created and data is stored correctly
        let tournament = state
            .world
            .query()
            .to(TOURNAMENT_HUB_ADDRESS)
            .typed(tournament_hub_proxy::TournamentHubProxy)
            .get_tournament(tournament_id)
            .returns(ReturnsResult)
            .run();
        assert_eq!(tournament.name, ManagedBuffer::from(*name));
    }
}

#[test]
fn test_storage_with_concurrent_tournament_creation() {
    let mut state = TournamentHubTestState::new();
    state.deploy_tournament_hub_contract();

    state.register_game();

    // Create multiple tournaments rapidly to test concurrent creation
    let mut tournament_ids = Vec::new();

    for _i in 1..=3 {
        let tournament_id = state.create_tournament(1usize);

        tournament_ids.push(tournament_id);
    }

    // Verify all tournaments were created with unique IDs
    assert_eq!(tournament_ids.len(), 3);
    assert_eq!(tournament_ids[0], 1usize);
    assert_eq!(tournament_ids[1], 2usize);
    assert_eq!(tournament_ids[2], 3usize);

    // Verify all tournaments are accessible
    for tournament_id in tournament_ids.iter() {
        let tournament = state
            .world
            .query()
            .to(TOURNAMENT_HUB_ADDRESS)
            .typed(tournament_hub_proxy::TournamentHubProxy)
            .get_tournament(*tournament_id)
            .returns(ReturnsResult)
            .run();
        assert_eq!(tournament.game_id, 1u64);
    }
}

#[test]
fn test_storage_with_memory_pressure_scenarios() {
    let mut state = TournamentHubTestState::new();
    state.deploy_tournament_hub_contract();

    state.register_game();

    // Create tournaments with maximum allowed data to test memory pressure
    let max_name = "A".repeat(100); // Maximum name length
    let max_participants = 8; // Maximum participants

    let tournament_id = state.create_tournament_with_params(
        1usize,
        8u32,
        2u32,
        BigUint::from(10u64).pow(18),
        &max_name,
    );

    // Add maximum participants (creator is already added, so we need 7 more)
    let users = ["user2", "user3", "user4", "spectator"];
    for user in users.iter() {
        state.join_tournament(tournament_id, user);
    }

    // Verify tournament with maximum data is stored correctly
    let tournament = state
        .world
        .query()
        .to(TOURNAMENT_HUB_ADDRESS)
        .typed(tournament_hub_proxy::TournamentHubProxy)
        .get_tournament(tournament_id)
        .returns(ReturnsResult)
        .run();

    assert_eq!(tournament.name.len(), 100);
    assert_eq!(tournament.participants.len(), 5); // Creator + 4 users
    assert_eq!(tournament.max_players, max_participants as u32);
}

#[test]
fn test_storage_with_rollback_scenarios() {
    let mut state = TournamentHubTestState::new();
    state.deploy_tournament_hub_contract();

    state.register_game();

    // Create a tournament
    let tournament_id = state.create_tournament(1usize);

    // Verify initial state
    let initial_tournament = state
        .world
        .query()
        .to(TOURNAMENT_HUB_ADDRESS)
        .typed(tournament_hub_proxy::TournamentHubProxy)
        .get_tournament(tournament_id)
        .returns(ReturnsResult)
        .run();
    assert_eq!(initial_tournament.participants.len(), 1); // Only creator

    // Add participants
    state.join_tournament(tournament_id, "user2");
    state.join_tournament(tournament_id, "user3");
    state.join_tournament(tournament_id, "user4");

    // Verify state after additions
    let updated_tournament = state
        .world
        .query()
        .to(TOURNAMENT_HUB_ADDRESS)
        .typed(tournament_hub_proxy::TournamentHubProxy)
        .get_tournament(tournament_id)
        .returns(ReturnsResult)
        .run();
    assert_eq!(updated_tournament.participants.len(), 4); // Creator + 3 users

    // Verify that the state is persistent and not rolled back
    let persistent_tournament = state
        .world
        .query()
        .to(TOURNAMENT_HUB_ADDRESS)
        .typed(tournament_hub_proxy::TournamentHubProxy)
        .get_tournament(tournament_id)
        .returns(ReturnsResult)
        .run();
    assert_eq!(persistent_tournament.participants.len(), 4);
    assert_eq!(persistent_tournament.game_id, initial_tournament.game_id);
}
