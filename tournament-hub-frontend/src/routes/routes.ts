import { RouteNamesEnum } from 'localConstants';
import { Dashboard, Disclaimer, Home, Unlock, Tournaments, TournamentDetails, CreateTournament, GameSession } from 'pages';
import { RouteType } from 'types';

interface RouteWithTitleType extends RouteType {
  title: string;
  authenticatedRoute?: boolean;
  children?: RouteWithTitleType[];
}

export const routes: RouteWithTitleType[] = [
  {
    path: RouteNamesEnum.home,
    title: 'Home',
    component: Home,
    children: [
      {
        path: RouteNamesEnum.unlock,
        title: 'Unlock',
        component: Unlock
      }
    ]
  },
  {
    path: '/tournaments',
    title: 'Tournaments',
    component: Tournaments
  },
  {
    path: '/tournaments/:id',
    title: 'Tournament Details',
    component: TournamentDetails
  },
  {
    path: '/tournaments/create',
    title: 'Create Tournament',
    component: CreateTournament
  },
  {
    path: RouteNamesEnum.gameSession,
    title: 'Game Session',
    component: GameSession
  },
  {
    path: '/game/chess/:tournamentId',
    title: 'Chess Game',
    component: GameSession
  },
  {
    path: '/game/tictactoe/:tournamentId',
    title: 'Tic Tac Toe Game',
    component: GameSession
  },
  {
    path: '/game/cryptobubbles/:tournamentId',
    title: 'CryptoBubbles Game',
    component: GameSession
  },
  {
    path: RouteNamesEnum.disclaimer,
    title: 'Disclaimer',
    component: Disclaimer
  }
];
