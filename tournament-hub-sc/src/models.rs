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
#[repr(u32)]
pub enum TournamentStatus {
    Joining = 0,           // Players can join, waiting for minimum players
    ReadyToStart = 1,      // Minimum players reached, ready to start
    Active = 2,            // Game is active and running
    ProcessingResults = 3, // Game finished, processing results
    Completed = 4,         // Results processed, prizes distributed
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
    pub name: ManagedBuffer<M>,
    pub created_at: u64,
    pub result_tx_hash: Option<ManagedBuffer<M>>, // Transaction hash when results are submitted
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

#[type_abi]
#[derive(
    TopEncode, TopDecode, ManagedVecItem, NestedEncode, NestedDecode, Clone, Debug, PartialEq,
)]
pub struct UserStats<M: ManagedTypeApi> {
    pub games_played: u32,
    pub wins: u32,
    pub losses: u32,
    pub win_rate: u32,
    pub tokens_won: BigUint<M>,
    pub tokens_spent: BigUint<M>,
    pub tournaments_created: u32,
    pub tournaments_won: u32,
    pub current_streak: u32,
    pub best_streak: u32,
    pub last_activity: u64, // timestamp
    pub member_since: u64,  // timestamp
    pub telo_rating: u32,   // Tournament ELO rating (starts at 1500)
}

// Old UserStats struct for migration (without telo_rating)
#[derive(TopEncode, TopDecode, Clone, Debug, PartialEq)]
pub struct OldUserStats<M: ManagedTypeApi> {
    pub games_played: u32,
    pub wins: u32,
    pub losses: u32,
    pub win_rate: u32,
    pub tokens_won: BigUint<M>,
    pub tokens_spent: BigUint<M>,
    pub tournaments_created: u32,
    pub tournaments_won: u32,
    pub current_streak: u32,
    pub best_streak: u32,
    pub last_activity: u64, // timestamp
    pub member_since: u64,  // timestamp
}

impl<M: ManagedTypeApi> UserStats<M> {
    // Migration function to convert old stats to new format
    pub fn from_old_format(old_stats: OldUserStats<M>) -> Self {
        UserStats {
            games_played: old_stats.games_played,
            wins: old_stats.wins,
            losses: old_stats.losses,
            win_rate: old_stats.win_rate,
            tokens_won: old_stats.tokens_won,
            tokens_spent: old_stats.tokens_spent,
            tournaments_created: old_stats.tournaments_created,
            tournaments_won: old_stats.tournaments_won,
            current_streak: old_stats.current_streak,
            best_streak: old_stats.best_streak,
            last_activity: old_stats.last_activity,
            member_since: old_stats.member_since,
            telo_rating: 1500, // Default TELO rating for migrated users
        }
    }
}

#[type_abi]
#[derive(
    TopEncode, TopDecode, ManagedVecItem, NestedEncode, NestedDecode, Clone, Debug, PartialEq,
)]
pub struct TournamentBasicInfo<M: ManagedTypeApi> {
    pub tournament_id: u64,
    pub game_id: u64,
    pub status: u32,
    pub participants: ManagedVec<M, ManagedAddress<M>>,
    pub creator: ManagedAddress<M>,
    pub max_players: u32,
    pub min_players: u32,
    pub entry_fee: BigUint<M>,
    pub name: ManagedBuffer<M>,
    pub created_at: u64,
}

#[type_abi]
#[derive(
    TopEncode, TopDecode, ManagedVecItem, NestedEncode, NestedDecode, Clone, Debug, PartialEq,
)]
pub struct TournamentStatusInfo {
    pub tournament_id: u64,
    pub status: u32,
}

#[type_abi]
#[derive(
    TopEncode, TopDecode, ManagedVecItem, NestedEncode, NestedDecode, Clone, Debug, PartialEq,
)]
pub struct UserStatsInfo<M: ManagedTypeApi> {
    pub address: ManagedAddress<M>,
    pub stats: UserStats<M>,
}
