use crate::models::{
    GameConfig, SpectatorBet, Tournament, TournamentBasicInfo, TournamentStatus, UserStats,
};

multiversx_sc::imports!();
multiversx_sc::derive_imports!();

#[multiversx_sc::module]
pub trait ViewsModule: crate::storage::StorageModule {
    #[view(getGameConfig)]
    fn get_game_config(&self, game_index: usize) -> GameConfig<Self::Api> {
        let games_len = self.registered_games().len();
        require!(
            game_index > 0 && game_index <= games_len,
            "Invalid game index"
        );

        self.registered_games().get(game_index).clone()
    }

    #[view(getTournament)]
    fn get_tournament(&self, tournament_index: usize) -> Tournament<Self::Api> {
        let tournaments_len = self.active_tournaments().len();
        require!(
            tournament_index > 0 && tournament_index <= tournaments_len,
            "Tournament does not exist"
        );

        self.active_tournaments().get(tournament_index).clone()
    }

    #[view(getNumberOfTournaments)]
    fn get_number_of_tournaments(&self) -> usize {
        self.active_tournaments().len()
    }

    #[view(getNumberOfGames)]
    fn get_number_of_games(&self) -> usize {
        self.registered_games().len()
    }

    #[view(getActiveTournamentIds)]
    fn get_active_tournament_ids(&self) -> ManagedVec<Self::Api, u64> {
        let mut ids = ManagedVec::new();
        let no_of_tournaments = self.active_tournaments().len();

        // Return IDs for all tournaments (1-based IDs)
        for id in 1..=no_of_tournaments {
            ids.push(id as u64);
        }
        ids
    }

    // Bulk endpoint: Get tournament basic info for UI (returns serialized data)
    #[view(getTournamentBasicInfo)]
    fn get_tournament_basic_info(
        &self,
        tournament_id: usize,
    ) -> (
        u64,
        u64,
        u32,
        ManagedVec<Self::Api, ManagedAddress<Self::Api>>,
        ManagedAddress<Self::Api>,
        u32,
        u32,
        BigUint<Self::Api>,
        ManagedBuffer<Self::Api>,
        u64,
    ) {
        let tournament = self.active_tournaments().get(tournament_id);
        let status_num = match tournament.status {
            TournamentStatus::Joining => 0u32,
            TournamentStatus::ReadyToStart => 1u32,
            TournamentStatus::Active => 2u32,
            TournamentStatus::ProcessingResults => 3u32,
            TournamentStatus::Completed => 4u32,
        };

        (
            tournament_id as u64,
            tournament.game_id,
            status_num,
            tournament.participants,
            tournament.creator,
            tournament.max_players,
            tournament.min_players,
            tournament.entry_fee,
            tournament.name,
            tournament.created_at,
        )
    }

    // Bulk endpoint: Get tournaments for a specific user (created or participated)
    #[view(getUserTournaments)]
    fn get_user_tournaments(
        &self,
        user_address: &ManagedAddress<Self::Api>,
    ) -> (ManagedVec<Self::Api, u64>, ManagedVec<Self::Api, u64>) {
        let mut created_tournaments = ManagedVec::new();
        let mut participated_tournaments = ManagedVec::new();

        let no_of_tournaments = self.active_tournaments().len();
        for id in 1..=no_of_tournaments {
            let tournament = self.active_tournaments().get(id);

            // Check if user created this tournament
            if &tournament.creator == user_address {
                created_tournaments.push(id as u64);
            }

            // Check if user participated in this tournament
            for participant in tournament.participants.iter() {
                if participant == user_address.into() {
                    participated_tournaments.push(id as u64);
                    break;
                }
            }
        }

        (created_tournaments, participated_tournaments)
    }

    #[view(getSpectatorBets)]
    fn get_spectator_bets(
        &self,
        tournament_index: usize,
        player: &ManagedAddress,
    ) -> ManagedVec<Self::Api, SpectatorBet<Self::Api>> {
        self.spectator_bets(&(tournament_index as u64), player)
            .get()
    }

    #[view(getSpectatorPoolTotal)]
    fn get_spectator_pool_total(&self, tournament_index: usize) -> BigUint<Self::Api> {
        self.spectator_pool_total(&(tournament_index as u64)).get()
    }

    #[view(getAccumulatedHouseFees)]
    fn get_accumulated_house_fees(&self) -> BigUint<Self::Api> {
        self.accumulated_house_fees().get()
    }

    #[view(getTournamentFee)]
    fn get_tournament_fee(&self) -> BigUint<Self::Api> {
        self.tournament_fee().get()
    }

    #[view(getHouseFeePercentage)]
    fn get_house_fee_percentage(&self) -> u32 {
        self.house_fee_percentage().get()
    }

    // User statistics views
    #[view(getUserStats)]
    fn get_user_stats(&self, user: &ManagedAddress) -> UserStats<Self::Api> {
        if self.user_stats(user).is_empty() {
            // Return default stats for new user
            UserStats {
                games_played: 0,
                wins: 0,
                losses: 0,
                win_rate: 0,
                tokens_won: BigUint::zero(),
                tokens_spent: BigUint::zero(),
                tournaments_created: 0,
                tournaments_won: 0,
                current_streak: 0,
                best_streak: 0,
                last_activity: 0,
                member_since: 0,
            }
        } else {
            self.user_stats(user).get()
        }
    }

    #[view(getUserTournamentsCreated)]
    fn get_user_tournaments_created(
        &self,
        user: &ManagedAddress<Self::Api>,
    ) -> ManagedVec<Self::Api, u64> {
        let mut tournaments = ManagedVec::new();
        for tournament_id in self.user_tournaments_created(user).iter() {
            tournaments.push(tournament_id);
        }
        tournaments
    }

    #[view(getUserTournamentsJoined)]
    fn get_user_tournaments_joined(
        &self,
        user: &ManagedAddress<Self::Api>,
    ) -> ManagedVec<Self::Api, u64> {
        let mut tournaments = ManagedVec::new();
        for tournament_id in self.user_tournaments_joined(user).iter() {
            tournaments.push(tournament_id);
        }
        tournaments
    }

    #[view(getUserTournamentsWon)]
    fn get_user_tournaments_won(
        &self,
        user: &ManagedAddress<Self::Api>,
    ) -> ManagedVec<Self::Api, u64> {
        let mut tournaments = ManagedVec::new();
        for tournament_id in self.user_tournaments_won(user).iter() {
            tournaments.push(tournament_id);
        }
        tournaments
    }

    #[view(getTotalTournamentsCreated)]
    fn get_total_tournaments_created(&self) -> u64 {
        self.total_tournaments_created().get()
    }

    #[view(getTotalTournamentsCompleted)]
    fn get_total_tournaments_completed(&self) -> u64 {
        self.total_tournaments_completed().get()
    }

    #[view(getTournamentStats)]
    fn get_tournament_stats(&self) -> (u64, u64, u64, u64, u64) {
        let total_created = self.total_tournaments_created().get();
        let _total_completed = self.total_tournaments_completed().get();
        let total_active = self.active_tournaments().len() as u64;

        // Count tournaments by status
        let mut joining = 0u64;
        let mut ready_to_start = 0u64;
        let mut active = 0u64;
        let mut completed = 0u64;

        for i in 0..total_active as usize {
            let tournament = self.active_tournaments().get(i);
            match tournament.status {
                crate::models::TournamentStatus::Joining => joining += 1,
                crate::models::TournamentStatus::ReadyToStart => ready_to_start += 1,
                crate::models::TournamentStatus::Active => active += 1,
                crate::models::TournamentStatus::Completed => completed += 1,
                crate::models::TournamentStatus::ProcessingResults => {} // Skip processing
            }
        }

        (joining, ready_to_start, active, completed, total_created)
    }

    #[view(getMaxPrizeWon)]
    fn get_max_prize_won(&self) -> BigUint<Self::Api> {
        self.max_prize_won().get()
    }

    #[view(getTotalPrizeDistributed)]
    fn get_total_prize_distributed(&self) -> BigUint<Self::Api> {
        self.total_prize_distributed().get()
    }

    #[view(getPrizeStats)]
    fn get_prize_stats(&self) -> (BigUint<Self::Api>, BigUint<Self::Api>) {
        (
            self.max_prize_won().get(),
            self.total_prize_distributed().get(),
        )
    }

    // Bulk endpoint: Get multiple tournaments basic info at once
    // #[view(getTournamentsBasicInfo)]
    // fn get_tournaments_basic_info(
    //     &self,
    //     tournament_ids: &[u64],
    // ) -> ManagedVec<Self::Api, TournamentBasicInfo<Self::Api>> {
    //     let mut results = ManagedVec::new();
    //     let tournaments_len = self.active_tournaments().len();

    //     for &tournament_id in tournament_ids {
    //         if tournament_id > 0 && tournament_id <= tournaments_len as u64 {
    //             let tournament = self.active_tournaments().get(tournament_id as usize);
    //             let status_num = match tournament.status {
    //                 TournamentStatus::Joining => 0u32,
    //                 TournamentStatus::ReadyToStart => 1u32,
    //                 TournamentStatus::Active => 2u32,
    //                 TournamentStatus::ProcessingResults => 3u32,
    //                 TournamentStatus::Completed => 4u32,
    //             };

    //             let info = TournamentBasicInfo {
    //                 tournament_id,
    //                 game_id: tournament.game_id,
    //                 status: status_num,
    //                 participants: tournament.participants,
    //                 creator: tournament.creator,
    //                 max_players: tournament.max_players,
    //                 min_players: tournament.min_players,
    //                 entry_fee: tournament.entry_fee,
    //                 name: tournament.name,
    //                 created_at: tournament.created_at,
    //             };

    //             results.push(info);
    //         }
    //     }

    //     results
    // }

    // Bulk endpoint: Get all active tournaments basic info
    #[view(getAllActiveTournamentsBasicInfo)]
    fn get_all_active_tournaments_basic_info(
        &self,
    ) -> ManagedVec<Self::Api, TournamentBasicInfo<Self::Api>> {
        let mut results = ManagedVec::new();
        let tournaments_len = self.active_tournaments().len();

        for id in 1..=tournaments_len {
            let tournament = self.active_tournaments().get(id);
            let status_num = match tournament.status {
                TournamentStatus::Joining => 0u32,
                TournamentStatus::ReadyToStart => 1u32,
                TournamentStatus::Active => 2u32,
                TournamentStatus::ProcessingResults => 3u32,
                TournamentStatus::Completed => 4u32,
            };

            let info = TournamentBasicInfo {
                tournament_id: id as u64,
                game_id: tournament.game_id,
                status: status_num,
                participants: tournament.participants,
                creator: tournament.creator,
                max_players: tournament.max_players,
                min_players: tournament.min_players,
                entry_fee: tournament.entry_fee,
                name: tournament.name,
                created_at: tournament.created_at,
            };

            results.push(info);
        }

        results
    }

    // Bulk endpoint: Get tournament statuses for multiple tournaments
    // #[view(getTournamentsStatus)]
    // fn get_tournaments_status(
    //     &self,
    //     tournament_ids: &[u64],
    // ) -> ManagedVec<Self::Api, TournamentStatusInfo> {
    //     let mut results = ManagedVec::new();
    //     let tournaments_len = self.active_tournaments().len();

    //     for &tournament_id in tournament_ids {
    //         if tournament_id > 0 && tournament_id <= tournaments_len as u64 {
    //             let tournament = self.active_tournaments().get(tournament_id as usize);
    //             let status_num = match tournament.status {
    //                 TournamentStatus::Joining => 0u32,
    //                 TournamentStatus::ReadyToStart => 1u32,
    //                 TournamentStatus::Active => 2u32,
    //                 TournamentStatus::ProcessingResults => 3u32,
    //                 TournamentStatus::Completed => 4u32,
    //             };

    //             let status_info = TournamentStatusInfo {
    //                 tournament_id,
    //                 status: status_num,
    //             };

    //             results.push(status_info);
    //         }
    //     }

    //     results
    // }

    // Alternative implementation: Get tournament status for a single tournament
    #[view(getTournamentStatusSingle)]
    fn get_tournament_status_single(&self, tournament_id: usize) -> u32 {
        let tournaments_len = self.active_tournaments().len();

        if tournament_id > 0 && tournament_id <= tournaments_len {
            let tournament = self.active_tournaments().get(tournament_id);
            match tournament.status {
                TournamentStatus::Joining => 0u32,
                TournamentStatus::ReadyToStart => 1u32,
                TournamentStatus::Active => 2u32,
                TournamentStatus::ProcessingResults => 3u32,
                TournamentStatus::Completed => 4u32,
            }
        } else {
            0u32 // Invalid tournament ID
        }
    }

    // Alternative implementation: Get tournament basic info for a single tournament
    #[view(getTournamentBasicInfoSingle)]
    fn get_tournament_basic_info_single(
        &self,
        tournament_id: usize,
    ) -> TournamentBasicInfo<Self::Api> {
        let tournaments_len = self.active_tournaments().len();

        if tournament_id > 0 && tournament_id <= tournaments_len {
            let tournament = self.active_tournaments().get(tournament_id);
            let status_num = match tournament.status {
                TournamentStatus::Joining => 0u32,
                TournamentStatus::ReadyToStart => 1u32,
                TournamentStatus::Active => 2u32,
                TournamentStatus::ProcessingResults => 3u32,
                TournamentStatus::Completed => 4u32,
            };

            TournamentBasicInfo {
                tournament_id: tournament_id as u64,
                game_id: tournament.game_id,
                status: status_num,
                participants: tournament.participants,
                creator: tournament.creator,
                max_players: tournament.max_players,
                min_players: tournament.min_players,
                entry_fee: tournament.entry_fee,
                name: tournament.name,
                created_at: tournament.created_at,
            }
        } else {
            // Return empty/default info for invalid tournament ID
            TournamentBasicInfo {
                tournament_id: 0,
                game_id: 0,
                status: 0,
                participants: ManagedVec::new(),
                creator: ManagedAddress::zero(),
                max_players: 0,
                min_players: 0,
                entry_fee: BigUint::zero(),
                name: ManagedBuffer::new(),
                created_at: 0,
            }
        }
    }

    // Alternative implementation: Get user stats for a single user
    #[view(getUserStatsSingle)]
    fn get_user_stats_single(
        &self,
        user_address: &ManagedAddress<Self::Api>,
    ) -> UserStats<Self::Api> {
        if self.user_stats(user_address).is_empty() {
            // Return default stats for new user
            UserStats {
                games_played: 0,
                wins: 0,
                losses: 0,
                win_rate: 0,
                tokens_won: BigUint::zero(),
                tokens_spent: BigUint::zero(),
                tournaments_created: 0,
                tournaments_won: 0,
                current_streak: 0,
                best_streak: 0,
                last_activity: 0,
                member_since: 0,
            }
        } else {
            self.user_stats(user_address).get()
        }
    }
}
