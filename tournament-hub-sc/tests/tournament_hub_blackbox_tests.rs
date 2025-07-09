use multiversx_sc::types::{BigUint, ReturnsNewAddress, ReturnsResult, TestAddress, TestSCAddress};
use multiversx_sc_scenario::{api::StaticApi, imports::MxscPath, *};

use tournament_hub::tournament_hub_proxy;

const OWNER_ADDRESS: TestAddress = TestAddress::new("owner");
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

    fn register_game(&mut self, game_id: u64) -> &mut Self {
        self.world
            .tx()
            .from(OWNER_ADDRESS)
            .to(TOURNAMENT_HUB_ADDRESS)
            .typed(tournament_hub_proxy::TournamentHubProxy)
            .register_game(
                game_id,
                OWNER_ADDRESS.to_address(), // signing_server_address
                3u32,                       // podium_size
                vec![5_000u32, 3_000u32, 2_000u32], // prize_distribution_percentages
                500u32,                     // house_fee_percentage (5%)
                false,                      // allow_late_join
            )
            .run();
        self
    }

    fn create_tournament(
        &mut self,
        tournament_id: u64,
        game_id: u64,
        entry_fee: &BigUint<StaticApi>,
        join_deadline: u64,
        play_deadline: u64,
    ) -> &mut Self {
        let user1 = TestAddress::new("user1");

        self.world
            .tx()
            .from(user1)
            .to(TOURNAMENT_HUB_ADDRESS)
            .typed(tournament_hub_proxy::TournamentHubProxy)
            .create_tournament(
                tournament_id,
                game_id,
                entry_fee.clone(),
                join_deadline,
                play_deadline,
            )
            .run();
        self
    }

    fn join_tournament(
        &mut self,
        tournament_id: u64,
        user: &str,
        entry_fee: &BigUint<StaticApi>,
    ) -> &mut Self {
        let user_addr = TestAddress::new(user);

        self.world
            .tx()
            .from(user_addr)
            .to(TOURNAMENT_HUB_ADDRESS)
            .typed(tournament_hub_proxy::TournamentHubProxy)
            .join_tournament(tournament_id)
            .egld(entry_fee.clone())
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
    let game_id = 1u64;
    state.register_game(game_id);

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
            2u64, // new tournament_id
            bad_game_id,
            entry_fee.clone(),
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
            3u64,
            game_id,
            entry_fee.clone(),
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
            4u64,
            game_id,
            entry_fee.clone(),
            join_deadline_timestamp,
            50u64, // play_deadline before join_deadline
        )
        .returns(ExpectError(
            4u64,
            "Play deadline must be after join deadline",
        ))
        .run();

    // Edge case: create_tournament with duplicate tournament_id
    state.create_tournament(
        tournament_id,
        game_id,
        &entry_fee,
        join_deadline_timestamp,
        play_deadline_timestamp,
    );
    state
        .world
        .tx()
        .from(USER1)
        .to(TOURNAMENT_HUB_ADDRESS)
        .typed(tournament_hub_proxy::TournamentHubProxy)
        .create_tournament(
            tournament_id,
            game_id,
            entry_fee.clone(),
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
    state.join_tournament(tournament_id, "user1", &entry_fee);
    // Edge case: join_tournament twice
    state.join_tournament_expect_error(tournament_id, "user1", &entry_fee, "Player already joined");

    // User2 joins
    state.join_tournament(tournament_id, "user2", &entry_fee);

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

#[test]
fn test_result_submission_and_prize_distribution() {
    let mut state = TournamentHubTestState::new();
    state.deploy_tournament_hub_contract();

    let game_id = 1u64;
    let tournament_id = 1u64;
    let entry_fee = BigUint::from(10u64).pow(18);
    let join_deadline = 100u64;
    let play_deadline = 200u64;

    state.register_game(game_id);
    state.create_tournament(
        tournament_id,
        game_id,
        &entry_fee,
        join_deadline,
        play_deadline,
    );
    state.join_tournament(tournament_id, "user1", &entry_fee);
    state.join_tournament(tournament_id, "user2", &entry_fee);

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
        .returns(ExpectError(4u64, "Tournament is not in playing phase"))
        .run();

    state
        .world
        .current_block()
        .block_timestamp(join_deadline - 1u64);

    // Edge: submit results with wrong podium size
    let bad_podium = vec![USER1.to_address()];
    state.create_tournament(2, game_id, &entry_fee, join_deadline, play_deadline);
    state.join_tournament(2, "user1", &entry_fee);
    state.join_tournament(2, "user2", &entry_fee);
    state.world.current_block().block_timestamp(play_deadline);
    state.start_tournament(2);
    state
        .world
        .tx()
        .from(USER1)
        .to(TOURNAMENT_HUB_ADDRESS)
        .typed(tournament_hub_proxy::TournamentHubProxy)
        .submit_results(2u64, bad_podium, fake_signature.clone())
        .returns(ExpectError(4u64, "Winner podium size mismatch"))
        .run();
}

#[test]
fn test_spectator_betting_and_claims() {
    let mut state = TournamentHubTestState::new();
    state.deploy_tournament_hub_contract();

    let game_id = 1u64;
    let tournament_id = 1u64;
    let entry_fee = BigUint::from(10u64).pow(18);
    let join_deadline = 100u64;
    let play_deadline = 200u64;

    state.register_game(game_id);
    state.create_tournament(
        tournament_id,
        game_id,
        &entry_fee,
        join_deadline,
        play_deadline,
    );
    state.join_tournament(tournament_id, "user1", &entry_fee);
    state.join_tournament(tournament_id, "user2", &entry_fee);

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

    let game_id = 1u64;
    let tournament_id = 1u64;
    let entry_fee = BigUint::from(10u64).pow(18);
    let join_deadline = 100u64;
    let play_deadline = 200u64;

    state.register_game(game_id);
    state.create_tournament(
        tournament_id,
        game_id,
        &entry_fee,
        join_deadline,
        play_deadline,
    );

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
    let tournament = state
        .world
        .query()
        .to(TOURNAMENT_HUB_ADDRESS)
        .typed(tournament_hub_proxy::TournamentHubProxy)
        .get_tournament(tournament_id)
        .returns(ReturnsResult)
        .run();
    assert!(tournament.is_some());

    // Join and check participants
    state.join_tournament(tournament_id, "user1", &entry_fee);
    let tournament = state
        .world
        .query()
        .to(TOURNAMENT_HUB_ADDRESS)
        .typed(tournament_hub_proxy::TournamentHubProxy)
        .get_tournament(tournament_id)
        .returns(ReturnsResult)
        .run();
    assert_eq!(tournament.unwrap().participants.len(), 1);
}

#[test]
fn test_permission_and_access_control() {
    let mut state = TournamentHubTestState::new();
    state.deploy_tournament_hub_contract();

    // Only owner can register game
    let game_id = 1u64;
    state
        .world
        .tx()
        .from(USER1)
        .to(TOURNAMENT_HUB_ADDRESS)
        .typed(tournament_hub_proxy::TournamentHubProxy)
        .register_game(
            game_id,
            USER1.to_address(),
            3u32,
            vec![5_000u32, 3_000u32, 2_000u32],
            500u32,
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

    let game1 = 1u64;
    let game2 = 2u64;
    let t1 = 1u64;
    let t2 = 2u64;
    let entry_fee = BigUint::from(10u64).pow(18);

    state.register_game(game1);
    state.register_game(game2);

    state.create_tournament(t1, game1, &entry_fee, 100, 200);
    state.create_tournament(t2, game2, &entry_fee, 100, 200);

    state.join_tournament(t1, "user1", &entry_fee);
    state.join_tournament(t2, "user2", &entry_fee);

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
    assert_eq!(t1_state.unwrap().participants.len(), 1);
    assert_eq!(t2_state.unwrap().participants.len(), 1);
}

#[test]
fn test_house_fee_and_distribution() {
    let mut state = TournamentHubTestState::new();
    state.deploy_tournament_hub_contract();

    // Register a game with 0% house fee
    let game_id = 1u64;
    state
        .world
        .tx()
        .from(OWNER_ADDRESS)
        .to(TOURNAMENT_HUB_ADDRESS)
        .typed(tournament_hub_proxy::TournamentHubProxy)
        .register_game(
            game_id,
            OWNER_ADDRESS.to_address(),
            3u32,
            vec![5_000u32, 3_000u32, 2_000u32],
            0u32, // 0% house fee
            false,
        )
        .run();

    // Register a game with 100% house fee
    let game_id2 = 2u64;
    state
        .world
        .tx()
        .from(OWNER_ADDRESS)
        .to(TOURNAMENT_HUB_ADDRESS)
        .typed(tournament_hub_proxy::TournamentHubProxy)
        .register_game(
            game_id2,
            OWNER_ADDRESS.to_address(),
            3u32,
            vec![5_000u32, 3_000u32, 2_000u32],
            10_000u32, // 100% house fee
            false,
        )
        .run();
}
