use multiversx_sc::types::{BigUint, ReturnsNewAddress, ReturnsResult, TestAddress, TestSCAddress};
use multiversx_sc_scenario::{api::StaticApi, imports::MxscPath, *};

use tournament_hub::tournament_hub_proxy;

const OWNER_ADDRESS: TestAddress = TestAddress::new("owner");
const USER_ADDRESS: TestAddress = TestAddress::new("user");

const USER1: TestAddress = TestAddress::new("user1");
const USER2: TestAddress = TestAddress::new("user2");
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
            .account(USER1)
            .nonce(1)
            .balance(BigUint::from(10u64).pow(19));
        world
            .account(USER2)
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

    fn create_tournament(
        &mut self,
        game_index: usize,
        join_deadline: u64,
        play_deadline: u64,
    ) -> u64 {
        self.world
            .tx()
            .from(USER1)
            .to(TOURNAMENT_HUB_ADDRESS)
            .typed(tournament_hub_proxy::TournamentHubProxy)
            .create_tournament(game_index as u64, join_deadline, play_deadline)
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

        tournament_id as u64
    }

    fn join_tournament(&mut self, tournament_id: u64, user: &str) -> &mut Self {
        let user_addr = TestAddress::new(user);
        let entry_fee = self.get_tournament_fee();
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
        tournament_id: u64,
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

    fn start_tournament(&mut self, tournament_id: u64) -> &mut Self {
        self.world
            .tx()
            .from(USER1)
            .to(TOURNAMENT_HUB_ADDRESS)
            .typed(tournament_hub_proxy::TournamentHubProxy)
            .start_tournament(tournament_id)
            .run();
        self
    }

    fn start_tournament_expect_error(
        &mut self,
        tournament_id: u64,
        return_error_message: &str,
    ) -> &mut Self {
        self.world
            .tx()
            .from(USER1)
            .to(TOURNAMENT_HUB_ADDRESS)
            .typed(tournament_hub_proxy::TournamentHubProxy)
            .start_tournament(tournament_id)
            .returns(ExpectError(4u64, return_error_message))
            .run();
        self
    }

    fn place_spectator_bet(
        &mut self,
        tournament_id: u64,
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
        tournament_id: u64,
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

    fn get_tournament_fee(&mut self) -> BigUint<StaticApi> {
        self.world
            .query()
            .to(TOURNAMENT_HUB_ADDRESS)
            .typed(tournament_hub_proxy::TournamentHubProxy)
            .get_tournament_fee()
            .returns(ReturnsResult)
            .run()
    }

    fn get_prize_pool(&mut self, tournament_id: u64) -> BigUint<StaticApi> {
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
    let bad_game_id = 999u64;
    let tournament_id = 1u64;
    let entry_fee = BigUint::from(10u64).pow(18);
    let join_deadline_timestamp = 100u64;
    let play_deadline_timestamp = 200u64;
    state.world.current_block().block_timestamp(10u64);
    state
        .world
        .tx()
        .from(USER1)
        .to(TOURNAMENT_HUB_ADDRESS)
        .typed(tournament_hub_proxy::TournamentHubProxy)
        .create_tournament(
            bad_game_id,
            join_deadline_timestamp,
            play_deadline_timestamp,
        )
        .returns(ExpectError(4u64, "Game not registered"))
        .run();

    // Edge case: create_tournament with join_deadline in the past
    state
        .world
        .tx()
        .from(USER1)
        .to(TOURNAMENT_HUB_ADDRESS)
        .typed(tournament_hub_proxy::TournamentHubProxy)
        .create_tournament(
            bad_game_id,
            5u64, // join_deadline in the past
            play_deadline_timestamp,
        )
        .returns(ExpectError(4u64, "Join deadline must be in the future"))
        .run();

    // Edge case: create_tournament with play_deadline before join_deadline
    state
        .world
        .tx()
        .from(USER1)
        .to(TOURNAMENT_HUB_ADDRESS)
        .typed(tournament_hub_proxy::TournamentHubProxy)
        .create_tournament(
            bad_game_id,
            join_deadline_timestamp,
            50u64, // play_deadline before join_deadline
        )
        .returns(ExpectError(
            4u64,
            "Play deadline must be after join deadline",
        ))
        .run();

    // Edge case: create_tournament with duplicate tournament_id
    state.create_tournament(1usize, join_deadline_timestamp, play_deadline_timestamp);
    state
        .world
        .tx()
        .from(USER1)
        .to(TOURNAMENT_HUB_ADDRESS)
        .typed(tournament_hub_proxy::TournamentHubProxy)
        .create_tournament(
            tournament_id,
            join_deadline_timestamp,
            play_deadline_timestamp,
        )
        .returns(ExpectError(4u64, "Tournament ID already exists"))
        .run();

    // Start tournament (simulate time passing)
    state.start_tournament_expect_error(tournament_id, "Join deadline has not passed yet");
    state
        .world
        .current_block()
        .block_timestamp(join_deadline_timestamp);

    // Edge case: join_tournament with wrong entry_fee
    let wrong_fee = BigUint::from(5u64).pow(17); // 0.05 EGLD
    state.join_tournament_expect_error(tournament_id, "user1", &wrong_fee, "Incorrect entry fee");

    // Edge case: join_tournament for non-existent tournament
    state.join_tournament_expect_error(999u64, "user1", &entry_fee, "Tournament does not exist");

    // User1 joins
    state.join_tournament(tournament_id, "user1");
    // Edge case: join_tournament twice
    state.join_tournament_expect_error(tournament_id, "user1", &entry_fee, "Player already joined");

    // User2 joins
    state.join_tournament(tournament_id, "user2");

    // Edge case: join_tournament after join_deadline (late join is false)
    state
        .world
        .current_block()
        .block_timestamp(play_deadline_timestamp + 1);
    state.join_tournament_expect_error(
        tournament_id,
        "user2",
        &entry_fee,
        "Join deadline has passed",
    );
    state
        .world
        .current_block()
        .block_timestamp(play_deadline_timestamp);

    // Edge case: start_tournament for non-existent tournament
    state.start_tournament_expect_error(999u64, "Tournament does not exist");

    // Edge case: start_tournament when not in joining phase (simulate by starting twice)
    state.start_tournament(tournament_id);
    state.start_tournament_expect_error(tournament_id, "Tournament is not in joining phase");

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

    let tournament_id = 1u64;
    let join_deadline = 100u64;
    let play_deadline = 200u64;

    state.register_game();
    state.create_tournament(1usize, join_deadline, play_deadline);
    let entry_fee = state.get_prize_pool(tournament_id);
    state.set_tournament_fee(&entry_fee);

    state.join_tournament(tournament_id, "user1");
    state.join_tournament(tournament_id, "user2");

    // Move to play_deadline
    state.world.current_block().block_timestamp(play_deadline);

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
        .submit_results(
            tournament_id as usize,
            podium.clone(),
            fake_signature.clone(),
        )
        .run();

    // Edge: submit results again (should fail)
    state
        .world
        .tx()
        .from(USER1)
        .to(TOURNAMENT_HUB_ADDRESS)
        .typed(tournament_hub_proxy::TournamentHubProxy)
        .submit_results(
            tournament_id as usize,
            podium.clone(),
            fake_signature.clone(),
        )
        .returns(ExpectError(4u64, "Tournament is not in playing phase"))
        .run();

    state
        .world
        .current_block()
        .block_timestamp(join_deadline - 1u64);

    // Edge: submit results with wrong podium size
    let bad_podium = vec![USER1.to_address()];
    state.register_game();
    state.create_tournament(2usize, join_deadline, play_deadline);
    state.set_tournament_fee(&entry_fee);
    state.join_tournament(2u64, "user1");
    state.join_tournament(2u64, "user2");
    state.world.current_block().block_timestamp(play_deadline);
    state.start_tournament(2u64);
    state
        .world
        .tx()
        .from(USER1)
        .to(TOURNAMENT_HUB_ADDRESS)
        .typed(tournament_hub_proxy::TournamentHubProxy)
        .submit_results(2u64 as usize, bad_podium, fake_signature.clone())
        .returns(ExpectError(4u64, "Winner podium size mismatch"))
        .run();
}

#[test]
fn test_debug_message_construction() {
    let mut state = TournamentHubTestState::new();
    state.deploy_tournament_hub_contract();

    let tournament_id = 1u64; // Same as your test case
    let join_deadline = 100u64;
    let play_deadline = 200u64;

    state.register_game();
    state.create_tournament(1usize, join_deadline, play_deadline);

    let entry_fee = state.get_prize_pool(tournament_id);
    state.set_tournament_fee(&entry_fee);

    state.join_tournament(tournament_id, "user1");

    // Move to play_deadline
    state.world.current_block().block_timestamp(play_deadline);
    state.start_tournament(tournament_id);

    // Test with the exact same data as your real test
    let podium = vec![USER1.to_address()]; // Single player podium
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
        .submit_results(tournament_id as usize, podium, signature)
        .run();

    println!("=== END DEBUG ===");
}

#[test]
fn test_debug_message_construction_success() {
    let mut state = TournamentHubTestState::new();
    state.deploy_tournament_hub_contract();

    let tournament_id = 1u64; // Same as your test case
    let join_deadline = 100u64;
    let play_deadline = 200u64;

    state.register_game();
    state.create_tournament(1usize, join_deadline, play_deadline);

    let entry_fee = state.get_prize_pool(tournament_id);
    state.set_tournament_fee(&entry_fee);

    state.join_tournament(tournament_id, "user1");

    // Move to play_deadline
    state.world.current_block().block_timestamp(play_deadline);
    state.start_tournament(tournament_id);

    // Test with a valid signature (we'll create one that matches our expected message)
    let podium = vec![USER1.to_address()]; // Single player podium

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

    // This should fail, but we'll see the debug events in the logs
    state
        .world
        .tx()
        .from(USER1)
        .to(TOURNAMENT_HUB_ADDRESS)
        .typed(tournament_hub_proxy::TournamentHubProxy)
        .submit_results(tournament_id as usize, podium, dummy_signature)
        .returns(ExpectError(4u64, "ed25519 verify error"))
        .run();

    println!("=== END DEBUG SUCCESS ===");
}

#[test]
fn test_debug_message_construction_with_real_addresses() {
    let mut state = TournamentHubTestState::new();
    state.deploy_tournament_hub_contract();

    let tournament_id = 1u64;
    let join_deadline = 100u64;
    let play_deadline = 200u64;

    state.register_game();
    state.create_tournament(1usize, join_deadline, play_deadline);

    let entry_fee = state.get_prize_pool(tournament_id);
    state.set_tournament_fee(&entry_fee);

    state.join_tournament(tournament_id, "user1");

    // Move to play_deadline
    state.world.current_block().block_timestamp(play_deadline);
    state.start_tournament(tournament_id);

    // Use the test address directly - this will show us what the test environment produces
    let podium = vec![USER1.to_address()]; // Use test address
    let dummy_signature = vec![0u8; 64];

    // This should fail, but we'll see the debug events in the logs
    state
        .world
        .tx()
        .from(USER1)
        .to(TOURNAMENT_HUB_ADDRESS)
        .typed(tournament_hub_proxy::TournamentHubProxy)
        .submit_results(tournament_id as usize, podium, dummy_signature)
        .returns(ExpectError(4u64, "ed25519 verify error"))
        .run();

    println!("=== END DEBUG WITH TEST ADDRESSES ===");
}

#[test]
fn test_spectator_betting_and_claims() {
    let mut state = TournamentHubTestState::new();
    state.deploy_tournament_hub_contract();

    let tournament_id = 1u64;
    let join_deadline = 100u64;
    let play_deadline = 200u64;

    state.register_game();
    state.create_tournament(1usize, join_deadline, play_deadline);
    let entry_fee = state.get_prize_pool(tournament_id);
    state.set_tournament_fee(&entry_fee);

    state.join_tournament(tournament_id, "user1");
    state.join_tournament(tournament_id, "user2");

    state.world.current_block().block_timestamp(join_deadline);
    state.start_tournament(tournament_id);

    // Spectator bets on user1
    let bet_amount = BigUint::from(10u64).pow(17);
    state.place_spectator_bet(tournament_id, &USER1, &bet_amount);

    // Edge: bet after play_deadline
    state
        .world
        .current_block()
        .block_timestamp(play_deadline + 1);
    state.place_spectator_bet_expect_error(
        tournament_id,
        &USER1,
        &bet_amount,
        "Betting period has ended",
    );

    // Edge: bet on non-participant
    let non_participant = TestAddress::new("nonparticipant");
    state.world.current_block().block_timestamp(join_deadline);
    state.place_spectator_bet_expect_error(
        tournament_id,
        &non_participant,
        &bet_amount,
        "Player not found in tournament",
    );

    state
        .world
        .current_block()
        .block_timestamp(play_deadline + 1);
    state.place_spectator_bet_expect_error(
        tournament_id,
        &non_participant,
        &bet_amount,
        "Betting period has ended",
    );

    // Complete tournament and submit results
    let podium = vec![USER1.to_address(), USER2.to_address(), USER1.to_address()];
    let fake_signature = vec![0u8; 64];
    state
        .world
        .tx()
        .from(USER1)
        .to(TOURNAMENT_HUB_ADDRESS)
        .typed(tournament_hub_proxy::TournamentHubProxy)
        .submit_results(
            tournament_id as usize,
            podium.clone(),
            fake_signature.clone(),
        )
        .run();

    // Happy path: claim winnings
    state
        .world
        .tx()
        .from(SPECTATOR)
        .to(TOURNAMENT_HUB_ADDRESS)
        .typed(tournament_hub_proxy::TournamentHubProxy)
        .claim_spectator_winnings(tournament_id as usize)
        .run();

    // Edge: claim twice
    state
        .world
        .tx()
        .from(SPECTATOR)
        .to(TOURNAMENT_HUB_ADDRESS)
        .typed(tournament_hub_proxy::TournamentHubProxy)
        .claim_spectator_winnings(tournament_id as usize)
        .returns(ExpectError(4u64, "Already claimed winnings"))
        .run();
}

#[test]
fn test_views_and_state_consistency() {
    let mut state = TournamentHubTestState::new();
    state.deploy_tournament_hub_contract();

    let game_id = 1usize;
    let tournament_id = 1u64;
    let join_deadline = 100u64;
    let play_deadline = 200u64;

    state.register_game();
    state.create_tournament(1usize, join_deadline, play_deadline);

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
    assert!(game_config.is_some());

    // Query tournament before join
    state
        .world
        .query()
        .to(TOURNAMENT_HUB_ADDRESS)
        .typed(tournament_hub_proxy::TournamentHubProxy)
        .get_tournament(tournament_id as usize)
        .returns(ReturnsResult)
        .run();
    // If no error, tournament exists

    // Join and check participants
    state.join_tournament(tournament_id, "user1");
    let tournament = state
        .world
        .query()
        .to(TOURNAMENT_HUB_ADDRESS)
        .typed(tournament_hub_proxy::TournamentHubProxy)
        .get_tournament(tournament_id as usize)
        .returns(ReturnsResult)
        .run();
    assert_eq!(tournament.participants.len(), 1);
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
    state.join_tournament_expect_error(999u64, "user1", &entry_fee, "Tournament does not exist");

    // Try to start non-existent tournament
    state.start_tournament_expect_error(999u64, "Tournament does not exist");
}

#[test]
fn test_multiple_tournaments_and_games() {
    let mut state = TournamentHubTestState::new();
    state.deploy_tournament_hub_contract();

    let t1 = 1u64;
    let t2 = 2u64;

    state.register_game();
    state.create_tournament(1usize, 100u64, 200u64);
    state.create_tournament(1usize, 100u64, 200u64);

    // Ensure state isolation
    let t1_state = state
        .world
        .query()
        .to(TOURNAMENT_HUB_ADDRESS)
        .typed(tournament_hub_proxy::TournamentHubProxy)
        .get_tournament(t1 as usize)
        .returns(ReturnsResult)
        .run();
    let t2_state = state
        .world
        .query()
        .to(TOURNAMENT_HUB_ADDRESS)
        .typed(tournament_hub_proxy::TournamentHubProxy)
        .get_tournament(t2 as usize)
        .returns(ReturnsResult)
        .run();
    assert_eq!(t1_state.participants.len(), 0);
    assert_eq!(t2_state.participants.len(), 0);
}

#[test]
fn test_house_fee_is_taken_on_gains() {
    let mut state = TournamentHubTestState::new();
    state.deploy_tournament_hub_contract();

    // Set the house fee to 1000 (10%)
    let house_fee_percentage = 1_000u32;
    state.set_house_fee_percentage(house_fee_percentage);

    // Register a game and run a full tournament flow...
    state.register_game();
    let game_index = 1u64;
    let join_deadline = 100u64;
    let play_deadline = 200u64;

    let tournament_id = state.create_tournament(game_index as usize, join_deadline, play_deadline);
    let entry_fee = BigUint::from(10u64).pow(18);
    state.set_tournament_fee(&entry_fee);

    state.join_tournament(tournament_id, "user1");
    state.join_tournament(tournament_id, "user2");

    // Move to play_deadline and start tournament
    state.world.current_block().block_timestamp(play_deadline);
    state.start_tournament(tournament_id);

    // Submit results to trigger prize distribution and fee accumulation
    let podium = vec![USER1.to_address(), USER2.to_address(), USER1.to_address()];
    let dummy_signature = vec![0u8; 64];
    state
        .world
        .tx()
        .from(USER1)
        .to(TOURNAMENT_HUB_ADDRESS)
        .typed(tournament_hub_proxy::TournamentHubProxy)
        .submit_results(tournament_id as usize, podium, dummy_signature)
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

    // Calculate expected fee and assert
    let expected_fee = BigUint::from(10u64).pow(18) * 2u64 * house_fee_percentage / 10_000u32;
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
    let tournament_id = state.create_tournament(1usize, 100u64, 200u64);
    state.join_tournament(tournament_id, "user1");
    state.join_tournament(tournament_id, "user2");

    let prize_pool = state.get_prize_pool(tournament_id);

    let expected_pool = &tournament_fee * 2u32;
    assert_eq!(prize_pool, expected_pool);
}
