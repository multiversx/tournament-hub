#![allow(dead_code)]
use multiversx_sc::derive_imports::*;
use multiversx_sc::imports::*;

#[type_abi]
#[derive(TopEncode, TopDecode, NestedEncode, NestedDecode, Clone, Debug, PartialEq)]
pub struct GameConfig<M: ManagedTypeApi> {
    pub signing_server_address: ManagedAddress<M>,
    pub podium_size: u32,
    pub prize_distribution_percentages: ManagedVec<M, u32>, // percentages in basis points (e.g., [5000, 3000, 2000] for 50.00%, 30.00%, 20.00%)
    pub house_fee_percentage: u32,                          // in basis points (e.g., 1234 = 12.34%)
    pub allow_late_join: bool,
}

#[type_abi]
#[derive(TopEncode, TopDecode, NestedEncode, NestedDecode, Clone, Debug, PartialEq)]
pub enum TournamentStatus {
    Joining,           // Players can join, waiting for minimum players
    ReadyToStart,      // Minimum players reached, ready to start
    Active,            // Game is active and running
    ProcessingResults, // Game finished, processing results
    Completed,         // Results processed, prizes distributed
}

#[type_abi]
#[derive(TopEncode, TopDecode, NestedEncode, NestedDecode, Clone, Debug, PartialEq)]
pub struct Tournament<M: ManagedTypeApi> {
    pub game_id: u64,
    pub status: TournamentStatus,
    pub participants: ManagedVec<M, ManagedAddress<M>>,
    pub final_podium: ManagedVec<M, ManagedAddress<M>>,
    pub creator: ManagedAddress<M>,
    pub max_players: u32,
    pub min_players: u32, // Minimum players required to start the game
    pub entry_fee: BigUint<M>,
    pub duration: u64, // duration in seconds
    pub name: ManagedBuffer<M>,
    pub created_at: u64,
}

#[type_abi]
#[derive(
    TopEncode, TopDecode, ManagedVecItem, NestedEncode, NestedDecode, Clone, Debug, PartialEq,
)]
pub struct SpectatorBet<M: ManagedTypeApi> {
    pub bettor_address: ManagedAddress<M>,
    pub amount: BigUint<M>,
}

#[type_abi]
#[derive(TopEncode, TopDecode, Clone, Debug, PartialEq)]
pub struct SpectatorClaim<M: ManagedTypeApi> {
    pub tournament_id: u64,
    pub bettor_address: ManagedAddress<M>,
    pub has_claimed: bool,
}
