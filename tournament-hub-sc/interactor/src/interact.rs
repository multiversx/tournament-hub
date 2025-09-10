#![allow(non_snake_case)]

pub mod config;
mod proxy;

use config::Config;
use multiversx_sc_snippets::hex;
use multiversx_sc_snippets::imports::*;
use serde::{Deserialize, Serialize};
use std::{
    io::{Read, Write},
    path::Path,
};

const STATE_FILE: &str = "state.toml";

pub async fn tournament_hub_cli() {
    env_logger::init();

    let mut args = std::env::args();
    let _ = args.next();
    let cmd = args.next().expect("at least one argument required");
    let config = Config::new();
    let mut interact = ContractInteract::new(config).await;
    match cmd.as_str() {
        "deploy" => interact.deploy().await,
        "upgrade" => interact.upgrade().await,
        "config" => interact.config().await,
        "registerGame" => interact.register_game().await,
        "submitResults" => interact.submit_results().await,
        "placeSpectatorBet" => interact.place_spectator_bet().await,
        "claimSpectatorWinnings" => interact.claim_spectator_winnings().await,
        "createTournament" => interact.create_tournament().await,
        "joinTournament" => interact.join_tournament().await,
        "startGame" => interact.start_game().await,
        "clearAllTournaments" => interact.clear_all_tournaments().await,
        "getGameConfig" => interact.get_game_config().await,
        "getTournament" => interact.get_tournament().await,
        "getSpectatorBets" => interact.get_spectator_bets().await,
        "getSpectatorPoolTotal" => interact.get_spectator_pool_total().await,
        "getAccumulatedHouseFees" => interact.get_accumulated_house_fees().await,
        "getNumberOfTournaments" => interact.get_number_of_tournaments().await,
        "getNumberOfGames" => interact.get_number_of_games().await,
        "getActiveTournamentIds" => interact.get_active_tournament_ids().await,
        "getTournamentBasicInfo" => interact.get_tournament_basic_info().await,
        "getUserTournaments" => interact.get_user_tournaments().await,
        "getTournamentFee" => interact.get_tournament_fee().await,
        "getUserStats" => interact.get_user_stats().await,
        "getUserTournamentsCreated" => interact.get_user_tournaments_created().await,
        "getUserTournamentsJoined" => interact.get_user_tournaments_joined().await,
        "getUserTournamentsWon" => interact.get_user_tournaments_won().await,
        "getTotalTournamentsCreated" => interact.get_total_tournaments_created().await,
        "getTotalTournamentsCompleted" => interact.get_total_tournaments_completed().await,
        "getTournamentStats" => interact.get_tournament_stats().await,
        "getPrizePool" => interact.get_prize_pool().await,
        "getHouseFeePercentage" => interact.get_house_fee_percentage().await,
        "getAllTournaments" => interact.get_all_tournaments().await,
        "getAllGames" => interact.get_all_games().await,
        "getTournamentByStatus" => interact.get_tournament_by_status().await,
        "getUserStatsByAddress" => interact.get_user_stats_by_address().await,
        "getTournamentBasicInfoById" => interact.get_tournament_basic_info_by_id().await,
        "getPrizePoolById" => interact.get_prize_pool_by_id().await,
        "getPrizeStats" => interact.get_prize_stats().await,
        _ => panic!("unknown command: {}", &cmd),
    }
}

#[derive(Debug, Default, Serialize, Deserialize)]
pub struct State {
    contract_address: Option<Bech32Address>,
}

impl State {
    // Deserializes state from file
    pub fn load_state() -> Self {
        if Path::new(STATE_FILE).exists() {
            let mut file = std::fs::File::open(STATE_FILE).unwrap();
            let mut content = String::new();
            file.read_to_string(&mut content).unwrap();
            toml::from_str(&content).unwrap()
        } else {
            Self::default()
        }
    }

    /// Sets the contract address
    pub fn set_address(&mut self, address: Bech32Address) {
        self.contract_address = Some(address);
    }

    /// Returns the contract address
    pub fn current_address(&self) -> &Bech32Address {
        self.contract_address
            .as_ref()
            .expect("no known contract, deploy first")
    }
}

impl Drop for State {
    // Serializes state to file
    fn drop(&mut self) {
        let mut file = std::fs::File::create(STATE_FILE).unwrap();
        file.write_all(toml::to_string(self).unwrap().as_bytes())
            .unwrap();
    }
}

pub struct ContractInteract {
    interactor: Interactor,
    wallet_address: Address,
    contract_code: BytesValue,
    state: State,
}

impl ContractInteract {
    pub async fn new(config: Config) -> Self {
        let mut interactor = Interactor::new(config.gateway_uri())
            .await
            .use_chain_simulator(config.use_chain_simulator());

        interactor.set_current_dir_from_workspace("tournament-hub");
        let wallet_address = interactor.register_wallet(test_wallets::alice()).await;

        // Useful in the chain simulator setting
        // generate blocks until ESDTSystemSCAddress is enabled
        interactor.generate_blocks_until_epoch(1).await.unwrap();

        let contract_code = BytesValue::interpret_from(
            "mxsc:../output/tournament-hub.mxsc.json",
            &InterpreterContext::default(),
        );

        ContractInteract {
            interactor,
            wallet_address,
            contract_code,
            state: State::load_state(),
        }
    }

    pub async fn deploy(&mut self) {
        let new_address = self
            .interactor
            .tx()
            .from(&self.wallet_address)
            .gas(100_000_000u64)
            .typed(proxy::TournamentHubProxy)
            .init()
            .code(&self.contract_code)
            .returns(ReturnsNewAddress)
            .run()
            .await;
        let new_address_bech32 = bech32::encode(&new_address);
        self.state.set_address(Bech32Address::from_bech32_string(
            new_address_bech32.clone(),
        ));

        println!("new address: {new_address_bech32}");
    }

    pub async fn upgrade(&mut self) {
        let response = self
            .interactor
            .tx()
            .to(self.state.current_address())
            .from(&self.wallet_address)
            .gas(100_000_000u64)
            .typed(proxy::TournamentHubProxy)
            .upgrade()
            .code(&self.contract_code)
            .code_metadata(CodeMetadata::UPGRADEABLE)
            .returns(ReturnsResultUnmanaged)
            .run()
            .await;

        println!("Result: {response:?}");
    }

    pub async fn config(&mut self) {
        self.set_tournament_fee().await;
        self.set_house_fee().await;
    }

    pub async fn register_game(&mut self) {
        let signing_server_address = Bech32Address::from_bech32_string(
            "erd1qyu5wthldzr8wx5c9ucg8kjagg0jfs53s8nr3zpz3hypefsdd8ssycr6th".to_string(),
        );
        let podium_size = 1u32;
        let mut prize_distribution_percentages = ManagedVec::new();
        prize_distribution_percentages.push(10_000u32);
        let allow_late_late_join = false;

        let response = self
            .interactor
            .tx()
            .from(&self.wallet_address)
            .to(self.state.current_address())
            .gas(100_000_000u64)
            .typed(proxy::TournamentHubProxy)
            .register_game(
                signing_server_address,
                podium_size,
                prize_distribution_percentages,
                allow_late_late_join,
            )
            .returns(ReturnsResultUnmanaged)
            .run()
            .await;

        println!("Result: {response:?}");
    }

    pub async fn submit_results(&mut self) {
        let tournament_id = 1usize; // Use tournament ID 1 (first tournament)
        let mut winner_podium = ManagedVec::new();
        let alice_address = ManagedAddress::from(self.wallet_address.clone());
        winner_podium.push(alice_address);
        let signature_hex = "43e0c523b89fe8d381f21133ba33e987009d2252e79fbe30133877b8a3fac8ecebcf7809f9905ff8c439d5206c8bb63263a4c180fc238ee2a56d0ed1324e1209";
        let signature_bytes = hex::decode(signature_hex).expect("Invalid hex");
        let signed_result = ManagedBuffer::new_from_bytes(&signature_bytes);

        let response = self
            .interactor
            .tx()
            .from(&self.wallet_address)
            .to(self.state.current_address())
            .gas(100_000_000u64)
            .typed(proxy::TournamentHubProxy)
            .submit_results(tournament_id, winner_podium, signed_result)
            .returns(ReturnsResultUnmanaged)
            .run()
            .await;

        println!("Result: {response:?}");
    }

    pub async fn place_spectator_bet(&mut self) {
        let egld_amount = BigUint::<StaticApi>::from(0u128);

        let tournament_id = 0usize;
        let betting_on_player = bech32::decode("");

        let response = self
            .interactor
            .tx()
            .from(&self.wallet_address)
            .to(self.state.current_address())
            .gas(100_000_000u64)
            .typed(proxy::TournamentHubProxy)
            .place_spectator_bet(tournament_id, betting_on_player)
            .egld(egld_amount)
            .returns(ReturnsResultUnmanaged)
            .run()
            .await;

        println!("Result: {response:?}");
    }

    pub async fn claim_spectator_winnings(&mut self) {
        let tournament_id = 0usize;

        let response = self
            .interactor
            .tx()
            .from(&self.wallet_address)
            .to(self.state.current_address())
            .gas(100_000_000u64)
            .typed(proxy::TournamentHubProxy)
            .claim_spectator_winnings(tournament_id)
            .returns(ReturnsResultUnmanaged)
            .run()
            .await;

        println!("Result: {response:?}");
    }

    pub async fn create_tournament(&mut self) {
        let game_index = 1u32;
        let max_players = 2u32;
        let min_players = 2u32;
        let entry_fee = BigUint::from(1u64).mul(10u64.pow(16)); // 0.01 EGLD (matching config)
        let name = ManagedBuffer::new_from_bytes(b"Test Fix Tournament");

        let response = self
            .interactor
            .tx()
            .from(&self.wallet_address)
            .to(self.state.current_address())
            .gas(100_000_000u64)
            .typed(proxy::TournamentHubProxy)
            .create_tournament(
                game_index,
                max_players,
                min_players,
                entry_fee.clone(),
                name,
            )
            .egld(entry_fee) // Send the entry fee as payment
            .returns(ReturnsResultUnmanaged)
            .run()
            .await;

        println!("Result: {response:?}");
    }

    pub async fn start_game(&mut self) {
        let tournament_id = 1usize; // Use tournament ID 1 (first tournament)

        let response = self
            .interactor
            .tx()
            .from(&self.wallet_address)
            .to(self.state.current_address())
            .gas(100_000_000u64)
            .typed(proxy::TournamentHubProxy)
            .start_game(tournament_id)
            .returns(ReturnsResultUnmanaged)
            .run()
            .await;

        println!("Result: {response:?}");
    }

    pub async fn join_tournament(&mut self) {
        let egld_amount = BigUint::<StaticApi>::from(1u64).mul(10u64.pow(16)); // 0.01 EGLD (matching config)

        let tournament_id = 1usize; // Use tournament ID 1 (first tournament)

        let response = self
            .interactor
            .tx()
            .from(&self.wallet_address)
            .to(self.state.current_address())
            .gas(100_000_000u64)
            .typed(proxy::TournamentHubProxy)
            .join_tournament(tournament_id)
            .egld(egld_amount)
            .returns(ReturnsResultUnmanaged)
            .run()
            .await;

        println!("Result: {response:?}");
    }

    pub async fn set_tournament_fee(&mut self) {
        let entry_fee = BigUint::from(1u64).mul(10u64.pow(16));

        let response = self
            .interactor
            .tx()
            .from(&self.wallet_address)
            .to(self.state.current_address())
            .gas(10_000_000u64)
            .typed(proxy::TournamentHubProxy)
            .set_tournament_fee(entry_fee)
            .returns(ReturnsResultUnmanaged)
            .run()
            .await;

        println!("Result: {response:?}");
    }

    pub async fn set_house_fee(&mut self) {
        let house_fee = 100u32;

        let response = self
            .interactor
            .tx()
            .from(&self.wallet_address)
            .to(self.state.current_address())
            .gas(10_000_000u64)
            .typed(proxy::TournamentHubProxy)
            .set_house_fee_percentage(house_fee)
            .returns(ReturnsResultUnmanaged)
            .run()
            .await;

        println!("Result: {response:?}");
    }

    pub async fn get_game_config(&mut self) {
        let game_id = 1usize;

        let result_value = self
            .interactor
            .query()
            .to(self.state.current_address())
            .typed(proxy::TournamentHubProxy)
            .get_game_config(game_id)
            .returns(ReturnsResultUnmanaged)
            .run()
            .await;

        println!("Result: {result_value:?}");
    }

    pub async fn get_tournament(&mut self) {
        let tournament_id = 13usize;

        let result_value = self
            .interactor
            .query()
            .to(self.state.current_address())
            .typed(proxy::TournamentHubProxy)
            .get_tournament(tournament_id)
            .returns(ReturnsResultUnmanaged)
            .run()
            .await;

        println!("Result: {result_value:?}");
    }

    pub async fn get_spectator_bets(&mut self) {
        let tournament_id = 0usize;
        let player = bech32::decode("");

        let result_value = self
            .interactor
            .query()
            .to(self.state.current_address())
            .typed(proxy::TournamentHubProxy)
            .get_spectator_bets(tournament_id, player)
            .returns(ReturnsResultUnmanaged)
            .run()
            .await;

        println!("Result: {result_value:?}");
    }

    pub async fn get_spectator_pool_total(&mut self) {
        let tournament_id = 0usize;

        let result_value = self
            .interactor
            .query()
            .to(self.state.current_address())
            .typed(proxy::TournamentHubProxy)
            .get_spectator_pool_total(tournament_id)
            .returns(ReturnsResultUnmanaged)
            .run()
            .await;

        println!("Result: {result_value:?}");
    }

    pub async fn get_accumulated_house_fees(&mut self) {
        let result_value = self
            .interactor
            .query()
            .to(self.state.current_address())
            .typed(proxy::TournamentHubProxy)
            .get_accumulated_house_fees()
            .returns(ReturnsResultUnmanaged)
            .run()
            .await;

        println!("Result: {result_value:?}");
    }

    pub async fn clear_all_tournaments(&mut self) {
        let response = self
            .interactor
            .tx()
            .from(&self.wallet_address)
            .to(self.state.current_address())
            .gas(100_000_000u64)
            .typed(proxy::TournamentHubProxy)
            .clear_all_tournaments()
            .returns(ReturnsResultUnmanaged)
            .run()
            .await;

        println!("Result: {response:?}");
    }

    // Additional view functions
    pub async fn get_number_of_tournaments(&mut self) {
        let result_value = self
            .interactor
            .query()
            .to(self.state.current_address())
            .typed(proxy::TournamentHubProxy)
            .get_number_of_tournaments()
            .returns(ReturnsResultUnmanaged)
            .run()
            .await;

        println!("Number of tournaments: {result_value:?}");
    }

    pub async fn get_number_of_games(&mut self) {
        let result_value = self
            .interactor
            .query()
            .to(self.state.current_address())
            .typed(proxy::TournamentHubProxy)
            .get_number_of_games()
            .returns(ReturnsResultUnmanaged)
            .run()
            .await;

        println!("Number of games: {result_value:?}");
    }

    pub async fn get_active_tournament_ids(&mut self) {
        let result_value = self
            .interactor
            .query()
            .to(self.state.current_address())
            .typed(proxy::TournamentHubProxy)
            .get_active_tournament_ids()
            .returns(ReturnsResultUnmanaged)
            .run()
            .await;

        println!("Active tournament IDs: {result_value:?}");
    }

    pub async fn get_tournament_basic_info(&mut self) {
        let tournament_id = 11usize;

        let result_value = self
            .interactor
            .query()
            .to(self.state.current_address())
            .typed(proxy::TournamentHubProxy)
            .get_tournament_basic_info(tournament_id)
            .returns(ReturnsResultUnmanaged)
            .run()
            .await;

        println!("Tournament basic info: {result_value:?}");
    }

    pub async fn get_user_tournaments(&mut self) {
        let user_address =
            bech32::decode("erd1qyu5wthldzr8wx5c9ucg8kjagg0jfs53s8nr3zpz3hypefsdd8ssycr6th");

        let result_value = self
            .interactor
            .query()
            .to(self.state.current_address())
            .typed(proxy::TournamentHubProxy)
            .get_user_tournaments(user_address)
            .returns(ReturnsResultUnmanaged)
            .run()
            .await;

        println!("User tournaments: {result_value:?}");
    }

    pub async fn get_tournament_fee(&mut self) {
        let result_value = self
            .interactor
            .query()
            .to(self.state.current_address())
            .typed(proxy::TournamentHubProxy)
            .get_tournament_fee()
            .returns(ReturnsResultUnmanaged)
            .run()
            .await;

        println!("Tournament fee: {result_value:?}");
    }

    pub async fn get_user_stats(&mut self) {
        let user_address =
            bech32::decode("erd1thvc8uzzdvkq4nuvqygfdkqu32evkkh3fdtt8hc672085ed3dthqhrkvvm");

        let result_value = self
            .interactor
            .query()
            .to(self.state.current_address())
            .typed(proxy::TournamentHubProxy)
            .get_user_stats(user_address)
            .returns(ReturnsResultUnmanaged)
            .run()
            .await;

        println!("User stats: {result_value:?}");
    }

    pub async fn get_user_tournaments_created(&mut self) {
        let user_address =
            bech32::decode("erd1qyu5wthldzr8wx5c9ucg8kjagg0jfs53s8nr3zpz3hypefsdd8ssycr6th");

        let result_value = self
            .interactor
            .query()
            .to(self.state.current_address())
            .typed(proxy::TournamentHubProxy)
            .get_user_tournaments_created(user_address)
            .returns(ReturnsResultUnmanaged)
            .run()
            .await;

        println!("User tournaments created: {result_value:?}");
    }

    pub async fn get_user_tournaments_joined(&mut self) {
        let user_address =
            bech32::decode("erd1qyu5wthldzr8wx5c9ucg8kjagg0jfs53s8nr3zpz3hypefsdd8ssycr6th");

        let result_value = self
            .interactor
            .query()
            .to(self.state.current_address())
            .typed(proxy::TournamentHubProxy)
            .get_user_tournaments_joined(user_address)
            .returns(ReturnsResultUnmanaged)
            .run()
            .await;

        println!("User tournaments joined: {result_value:?}");
    }

    pub async fn get_user_tournaments_won(&mut self) {
        let user_address =
            bech32::decode("erd1qyu5wthldzr8wx5c9ucg8kjagg0jfs53s8nr3zpz3hypefsdd8ssycr6th");

        let result_value = self
            .interactor
            .query()
            .to(self.state.current_address())
            .typed(proxy::TournamentHubProxy)
            .get_user_tournaments_won(user_address)
            .returns(ReturnsResultUnmanaged)
            .run()
            .await;

        println!("User tournaments won: {result_value:?}");
    }

    pub async fn get_total_tournaments_created(&mut self) {
        let result_value = self
            .interactor
            .query()
            .to(self.state.current_address())
            .typed(proxy::TournamentHubProxy)
            .get_total_tournaments_created()
            .returns(ReturnsResultUnmanaged)
            .run()
            .await;

        println!("Total tournaments created: {result_value:?}");
    }

    pub async fn get_total_tournaments_completed(&mut self) {
        let result_value = self
            .interactor
            .query()
            .to(self.state.current_address())
            .typed(proxy::TournamentHubProxy)
            .get_total_tournaments_completed()
            .returns(ReturnsResultUnmanaged)
            .run()
            .await;

        println!("Total tournaments completed: {result_value:?}");
    }

    pub async fn get_tournament_stats(&mut self) {
        let result_value = self
            .interactor
            .query()
            .to(self.state.current_address())
            .typed(proxy::TournamentHubProxy)
            .get_tournament_stats()
            .returns(ReturnsResultUnmanaged)
            .run()
            .await;

        println!("Tournament stats: {result_value:?}");
    }

    pub async fn get_prize_pool(&mut self) {
        let tournament_id = 1usize;

        let result_value = self
            .interactor
            .query()
            .to(self.state.current_address())
            .typed(proxy::TournamentHubProxy)
            .get_prize_pool(tournament_id)
            .returns(ReturnsResultUnmanaged)
            .run()
            .await;

        println!("Prize pool: {result_value:?}");
    }

    // Additional utility view functions
    pub async fn get_house_fee_percentage(&mut self) {
        let result_value = self
            .interactor
            .query()
            .to(self.state.current_address())
            .typed(proxy::TournamentHubProxy)
            .get_house_fee_percentage()
            .returns(ReturnsResultUnmanaged)
            .run()
            .await;

        println!("House fee percentage: {result_value:?}");
    }

    pub async fn get_all_tournaments(&mut self) {
        let num_tournaments = self
            .interactor
            .query()
            .to(self.state.current_address())
            .typed(proxy::TournamentHubProxy)
            .get_number_of_tournaments()
            .returns(ReturnsResultUnmanaged)
            .run()
            .await;

        println!("Total tournaments: {num_tournaments:?}");

        // Get all tournament IDs
        let tournament_ids = self
            .interactor
            .query()
            .to(self.state.current_address())
            .typed(proxy::TournamentHubProxy)
            .get_active_tournament_ids()
            .returns(ReturnsResultUnmanaged)
            .run()
            .await;

        println!("Tournament IDs: {tournament_ids:?}");

        // Get basic info for each tournament
        for id in 1..=num_tournaments {
            let tournament_info = self
                .interactor
                .query()
                .to(self.state.current_address())
                .typed(proxy::TournamentHubProxy)
                .get_tournament_basic_info(id as usize)
                .returns(ReturnsResultUnmanaged)
                .run()
                .await;

            println!("Tournament {} info: {tournament_info:?}", id);
        }
    }

    pub async fn get_all_games(&mut self) {
        let num_games = self
            .interactor
            .query()
            .to(self.state.current_address())
            .typed(proxy::TournamentHubProxy)
            .get_number_of_games()
            .returns(ReturnsResultUnmanaged)
            .run()
            .await;

        println!("Total games: {num_games:?}");

        // Get config for each game
        for game_id in 1..=num_games {
            let game_config = self
                .interactor
                .query()
                .to(self.state.current_address())
                .typed(proxy::TournamentHubProxy)
                .get_game_config(game_id as usize)
                .returns(ReturnsResultUnmanaged)
                .run()
                .await;

            println!("Game {} config: {game_config:?}", game_id);
        }
    }

    pub async fn get_tournament_by_status(&mut self) {
        let stats = self
            .interactor
            .query()
            .to(self.state.current_address())
            .typed(proxy::TournamentHubProxy)
            .get_tournament_stats()
            .returns(ReturnsResultUnmanaged)
            .run()
            .await;

        println!("Tournament status breakdown: {stats:?}");
    }

    pub async fn get_user_stats_by_address(&mut self) {
        let args: Vec<String> = std::env::args().collect();
        let user_address = if args.len() > 2 {
            &args[2]
        } else {
            "erd1qyu5wthldzr8wx5c9ucg8kjagg0jfs53s8nr3zpz3hypefsdd8ssycr6th"
        };

        let user_address_decoded = bech32::decode(user_address);

        let result_value = self
            .interactor
            .query()
            .to(self.state.current_address())
            .typed(proxy::TournamentHubProxy)
            .get_user_stats(user_address_decoded)
            .returns(ReturnsResultUnmanaged)
            .run()
            .await;

        println!("User stats for {}: {result_value:?}", user_address);
    }

    pub async fn get_tournament_basic_info_by_id(&mut self) {
        let args: Vec<String> = std::env::args().collect();
        let tournament_id = if args.len() > 2 {
            args[2].parse::<usize>().unwrap_or(1)
        } else {
            1
        };

        let result_value = self
            .interactor
            .query()
            .to(self.state.current_address())
            .typed(proxy::TournamentHubProxy)
            .get_tournament_basic_info(tournament_id)
            .returns(ReturnsResultUnmanaged)
            .run()
            .await;

        println!("Tournament {} basic info: {result_value:?}", tournament_id);
    }

    pub async fn get_prize_pool_by_id(&mut self) {
        let args: Vec<String> = std::env::args().collect();
        let tournament_id = if args.len() > 2 {
            args[2].parse::<usize>().unwrap_or(1)
        } else {
            1
        };

        let result_value = self
            .interactor
            .query()
            .to(self.state.current_address())
            .typed(proxy::TournamentHubProxy)
            .get_prize_pool(tournament_id)
            .returns(ReturnsResultUnmanaged)
            .run()
            .await;

        println!(
            "Prize pool for tournament {}: {result_value:?}",
            tournament_id
        );
    }

    pub async fn get_prize_stats(&mut self) {
        let result_value = self
            .interactor
            .query()
            .to(self.state.current_address())
            .typed(proxy::TournamentHubProxy)
            .get_prize_stats()
            .returns(ReturnsResultUnmanaged)
            .run()
            .await;

        println!("Prize stats: {result_value:?}");
    }
}
