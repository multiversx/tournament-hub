#![no_std]

multiversx_sc::imports!();

mod events;
mod helpers;
mod models;
mod storage;
pub mod tournament_hub_proxy;
mod views;
mod tournament_logic {
    pub mod game_registration;
    pub mod results_management;
    pub mod spectator_betting;
    pub mod tournament_management;
}

#[multiversx_sc::contract]
pub trait TournamentHub:
    storage::StorageModule
    + helpers::HelperModule
    + tournament_logic::game_registration::GameRegistrationModule
    + tournament_logic::results_management::ResultsManagementModule
    + tournament_logic::spectator_betting::SpectatorBettingModule
    + tournament_logic::tournament_management::TournamentManagementModule
    + views::ViewsModule
    + events::EventsModule
{
    #[init]
    fn init(&self) {}

    #[upgrade]
    fn upgrade(&self) {}
}
