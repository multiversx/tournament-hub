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
    time::{SystemTime, UNIX_EPOCH},
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
        "getGameConfig" => interact.get_game_config().await,
        "getTournament" => interact.get_tournament().await,
        "getSpectatorBets" => interact.get_spectator_bets().await,
        "getSpectatorPoolTotal" => interact.get_spectator_pool_total().await,
        "getAccumulatedHouseFees" => interact.get_accumulated_house_fees().await,
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
        let tournament_id = 18usize;
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
        let game_index = 5u64;
        let max_players = 4u32;
        let entry_fee = BigUint::from(1u64).mul(10u64.pow(17)); // 0.1 EGLD
        let duration = 86400u64; // 24 hours in seconds
        let name = ManagedBuffer::new_from_bytes(b"Test Tournament (Creator Auto-Joined)");

        let response = self
            .interactor
            .tx()
            .from(&self.wallet_address)
            .to(self.state.current_address())
            .gas(100_000_000u64)
            .typed(proxy::TournamentHubProxy)
            .create_tournament(game_index, max_players, entry_fee, duration, name)
            .returns(ReturnsResultUnmanaged)
            .run()
            .await;

        println!("Result: {response:?}");
    }

    pub async fn join_tournament(&mut self) {
        let egld_amount = BigUint::<StaticApi>::from(0u128);

        let tournament_id = 3usize;

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
        let game_id = 0usize;

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
        let tournament_id = 0usize;

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
}
