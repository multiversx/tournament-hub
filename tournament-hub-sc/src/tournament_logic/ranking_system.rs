multiversx_sc::imports!();
multiversx_sc::derive_imports!();

/// TELO (Tournament ELO) Ranking System Module
///
/// This module implements a ranking system similar to ELO but optimized for tournaments.
/// - Players start with 1500 TELO points
/// - Point changes range from 2 to 20 based on rating difference
/// - Winners gain points, losers lose points
/// - Larger rating differences result in smaller point changes (when favorite wins)
/// - Smaller rating differences or upsets result in larger point changes

#[multiversx_sc::module]
pub trait RankingSystemModule: crate::storage::StorageModule {
    /// Calculate TELO rating change for a match result
    ///
    /// # Arguments
    /// * `winner_rating` - Current TELO rating of the winner
    /// * `loser_rating` - Current TELO rating of the loser
    ///
    /// # Returns
    /// Points to add to winner (and subtract from loser)
    fn calculate_telo_change(&self, winner_rating: u32, loser_rating: u32) -> u32 {
        const MIN_POINTS: u32 = 2;
        const MAX_POINTS: u32 = 20;

        let rating_diff = winner_rating as i32 - loser_rating as i32;

        // Calculate expected outcome (0.0 to 1.0)
        // Using a simplified formula: expected = 1 / (1 + 10^(rating_diff / 400))
        // We'll approximate this with integer math

        // For positive rating_diff (favorite wins): smaller point change
        // For negative rating_diff (underdog wins): larger point change

        let points = if rating_diff >= 400 {
            // Huge favorite wins - minimum points
            MIN_POINTS
        } else if rating_diff >= 200 {
            // Strong favorite wins - small points
            MIN_POINTS + 3
        } else if rating_diff >= 100 {
            // Moderate favorite wins - medium-small points
            MIN_POINTS + 6
        } else if rating_diff >= 50 {
            // Slight favorite wins - medium points
            MIN_POINTS + 9
        } else if rating_diff >= -50 {
            // Even match - medium-high points
            MIN_POINTS + 11
        } else if rating_diff >= -100 {
            // Slight underdog wins - high points
            MIN_POINTS + 13
        } else if rating_diff >= -200 {
            // Moderate underdog wins - higher points
            MIN_POINTS + 15
        } else if rating_diff >= -400 {
            // Strong underdog wins - very high points
            MIN_POINTS + 17
        } else {
            // Huge underdog wins - maximum points
            MAX_POINTS
        };

        points
    }

    /// Update TELO ratings for all participants in a tournament
    ///
    /// # Arguments
    /// * `participants` - All tournament participants
    /// * `winners` - Winners in order (1st, 2nd, 3rd, etc.)
    ///
    /// This function updates ratings based on tournament results:
    /// - Winners gain points from losers
    /// - Higher placed winners gain more points
    /// - Rating changes are calculated pairwise between winners and losers
    fn update_tournament_ratings(
        &self,
        participants: &ManagedVec<ManagedAddress>,
        winners: &ManagedVec<ManagedAddress>,
    ) {
        // Skip rating updates for draws (no winners)
        if winners.is_empty() {
            return;
        }

        // Separate winners and losers
        let mut losers: ManagedVec<Self::Api, ManagedAddress<Self::Api>> = ManagedVec::new();
        for participant in participants.iter() {
            let mut is_winner = false;
            for winner in winners.iter() {
                if &participant == &winner {
                    is_winner = true;
                    break;
                }
            }
            if !is_winner {
                losers.push(participant.clone());
            }
        }

        // If no losers (everyone won?), skip rating updates
        if losers.len() == 0 {
            return;
        }

        // Calculate average loser rating for comparison
        let mut total_loser_rating: u32 = 0;
        let mut loser_count: u32 = 0;
        for loser in losers.iter() {
            let loser_rating = if self.user_stats(&loser).is_empty() {
                1500 // Default TELO rating
            } else {
                self.user_stats(&loser).get().telo_rating
            };
            total_loser_rating += loser_rating;
            loser_count += 1;
        }
        let avg_loser_rating = if loser_count > 0 {
            total_loser_rating / loser_count
        } else {
            1500
        };

        // Update winner ratings (gain points)
        for (position, winner) in winners.iter().enumerate() {
            let current_rating = if self.user_stats(&winner).is_empty() {
                1500 // Default TELO rating
            } else {
                self.user_stats(&winner).get().telo_rating
            };

            // Calculate points gained based on position
            // 1st place gets full points, 2nd gets 75%, 3rd gets 50%, etc.
            let points_gained = self.calculate_telo_change(current_rating, avg_loser_rating);
            let position_multiplier = match position {
                0 => 100, // 1st place: 100%
                1 => 75,  // 2nd place: 75%
                2 => 50,  // 3rd place: 50%
                _ => 25,  // 4th+ place: 25%
            };
            let adjusted_points = (points_gained * position_multiplier) / 100;
            let adjusted_points = if adjusted_points < 2 {
                2
            } else {
                adjusted_points
            }; // Minimum 2 points

            // Update the winner's TELO rating
            if !self.user_stats(&winner).is_empty() {
                let mut stats = self.user_stats(&winner).get();
                stats.telo_rating += adjusted_points;
                self.user_stats(&winner).set(&stats);
            }
        }

        // Calculate average winner rating for comparison
        let mut total_winner_rating: u32 = 0;
        let mut winner_count: u32 = 0;
        for winner in winners.iter() {
            let winner_rating = if self.user_stats(&winner).is_empty() {
                1500 // Default TELO rating
            } else {
                self.user_stats(&winner).get().telo_rating
            };
            total_winner_rating += winner_rating;
            winner_count += 1;
        }
        let avg_winner_rating = if winner_count > 0 {
            total_winner_rating / winner_count
        } else {
            1500
        };

        // Update loser ratings (lose points)
        for loser in losers.iter() {
            let current_rating = if self.user_stats(&loser).is_empty() {
                1500 // Default TELO rating
            } else {
                self.user_stats(&loser).get().telo_rating
            };

            // Calculate points lost (inverse of winner calculation)
            let points_lost = self.calculate_telo_change(avg_winner_rating, current_rating);

            // Update the loser's TELO rating
            if !self.user_stats(&loser).is_empty() {
                let mut stats = self.user_stats(&loser).get();
                // Ensure rating doesn't go below a minimum (e.g., 100)
                if stats.telo_rating > points_lost + 100 {
                    stats.telo_rating -= points_lost;
                } else {
                    stats.telo_rating = 100; // Floor rating at 100
                }
                self.user_stats(&loser).set(&stats);
            }
        }
    }
}
